from datetime import datetime
from sqlalchemy.orm import Session
from app.models.customer import Customer
from app.models.customer_health import CustomerHealth
from app.models.transaction import Transaction
from app.models.user import User
from app.square.client import get_square_client, raise_square_error
from app.core.retry import square_retry
from app.core.errors import log_error, resolve_errors
from app.core.health import on_sync_failure, on_sync_success, auto_reset_sync
from app.core.security import decrypt_token


@square_retry
def _list_customers_page(client, cursor=None):
    kwargs = {"cursor": cursor} if cursor else {}
    result = client.customers.list_customers(**kwargs)
    if result.is_error():
        raise_square_error(result.errors)
    return result.body


@square_retry
def _search_orders_page(client, location_id, cursor=None):
    body = {
        "location_ids": [location_id],
        "query": {"filter": {"state_filter": {"states": ["COMPLETED"]}}},
    }
    if cursor:
        body["cursor"] = cursor
    result = client.orders.search_orders(body=body)
    if result.is_error():
        raise_square_error(result.errors)
    return result.body


def sync_customers(user: User, db: Session) -> int:
    client = get_square_client(decrypt_token(user.square_access_token))
    synced = 0
    cursor = None
    had_error = False

    existing_customers = {
        c.square_customer_id: c
        for c in db.query(Customer).filter(Customer.user_id == user.id).all()
    }

    while True:
        try:
            body = _list_customers_page(client, cursor=cursor)
        except Exception as e:
            log_error(db, "square_sync", e, user_id=user.id)
            had_error = True
            break

        for sq_customer in (body.get("customers") or []):
            sq_id = sq_customer["id"]
            existing = existing_customers.get(sq_id)
            if not existing:
                existing = Customer(user_id=user.id, square_customer_id=sq_id)
                db.add(existing)
                db.flush()

            auto_reset_sync(db, existing.id)
            health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == existing.id).first()
            if health and health.sync_skip:
                continue  # skipped — too many prior failures, 7-day cooldown active

            try:
                existing.given_name = sq_customer.get("given_name")
                existing.family_name = sq_customer.get("family_name")
                existing.email = sq_customer.get("email_address")
                existing.phone = sq_customer.get("phone_number")
                on_sync_success(db, existing.id)
                synced += 1
            except Exception as e:
                on_sync_failure(db, existing.id)
                log_error(db, "square_sync", e, user_id=user.id, customer_id=existing.id)

        cursor = body.get("cursor")
        if not cursor:
            break

    db.commit()
    if not had_error:
        resolve_errors(db, "square_sync", user_id=user.id)
    return synced


def sync_transactions(user: User, db: Session) -> int:
    client = get_square_client(decrypt_token(user.square_access_token))
    synced = 0
    cursor = None

    while True:
        try:
            body = _search_orders_page(client, user.square_location_id, cursor=cursor)
        except Exception as e:
            log_error(db, "square_sync", e, user_id=user.id)
            break

        for order in (body.get("orders") or []):
            if db.query(Transaction).filter(Transaction.square_order_id == order["id"]).first():
                continue
            sq_cust_id = order.get("customer_id")
            customer = None
            if sq_cust_id:
                customer = db.query(Customer).filter(
                    Customer.user_id == user.id,
                    Customer.square_customer_id == sq_cust_id,
                ).first()
            amount = order.get("total_money", {}).get("amount", 0) / 100.0
            items = [
                {"name": li.get("name"), "quantity": li.get("quantity"),
                 "price": li.get("base_price_money", {}).get("amount", 0) / 100.0}
                for li in order.get("line_items", [])
            ]
            tx = Transaction(
                user_id=user.id,
                customer_id=customer.id if customer else None,
                square_order_id=order["id"],
                amount=amount,
                items=items,
                transacted_at=datetime.fromisoformat(order["created_at"].replace("Z", "+00:00")),
            )
            db.add(tx)
            synced += 1

        cursor = body.get("cursor")
        if not cursor:
            break

    for customer in db.query(Customer).filter(Customer.user_id == user.id).all():
        txs = db.query(Transaction).filter(Transaction.customer_id == customer.id).all()
        customer.total_visits = len(txs)
        customer.total_spent = sum(t.amount for t in txs)
        if txs:
            dates = [t.transacted_at for t in txs]
            customer.first_visit_at = min(dates)
            customer.last_visit_at = max(dates)

    db.commit()
    return synced
