import uuid
from unittest.mock import patch
from app.models.user import User
from app.models.customer import Customer
from app.models.error_log import ErrorLog
from app.models.customer_health import CustomerHealth
from app.square.client import SquareAPIError


def _make_user(db):
    u = User(
        email=f"{uuid.uuid4().hex}@t.com",
        hashed_password="x",
        business_name="B",
        square_access_token="encrypted-fake-token",
        square_location_id="LOC1",
    )
    db.add(u)
    db.commit()
    return u


def test_sync_customers_logs_error_on_api_failure(db):
    user = _make_user(db)

    with patch("app.square.sync.get_square_client") as mock_client, \
         patch("app.square.sync.decrypt_token", return_value="raw-token"):
        mock_client.return_value.customers.list_customers.side_effect = SquareAPIError("boom", status_code=503)

        from app.square.sync import sync_customers
        sync_customers(user, db)

    row = db.query(ErrorLog).filter(
        ErrorLog.user_id == user.id,
        ErrorLog.operation == "square_sync",
    ).first()
    assert row is not None
    assert row.resolved is False


def test_sync_customers_skips_health_flagged_customer(db):
    user = _make_user(db)
    c = Customer(user_id=user.id, square_customer_id="sq_1", given_name="Old")
    db.add(c)
    db.commit()
    health = CustomerHealth(customer_id=c.id, sync_skip=True, sync_fail_count=3)
    db.add(health)
    db.commit()

    sq_customer_data = [{"id": "sq_1", "given_name": "New", "email_address": "x@x.com"}]
    mock_body = {"customers": sq_customer_data}

    with patch("app.square.sync._list_customers_page", return_value=mock_body), \
         patch("app.square.sync.decrypt_token", return_value="raw-token"):
        from app.square.sync import sync_customers
        sync_customers(user, db)

    db.refresh(c)
    assert c.given_name == "Old"


def test_connect_square_encrypts_token(db):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.database import get_db

    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        email = f"{uuid.uuid4().hex}@t.com"
        r = client.post("/auth/register", json={"email": email, "password": "Test1234", "business_name": "B"})
        token = r.json()["access_token"]

        raw_token = "sq0atp-plaintexttoken"
        r = client.post(
            "/square/connect",
            json={"access_token": raw_token, "location_id": "LOC1"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200

        user = db.query(User).filter(User.email == email).first()
        assert user.square_access_token != raw_token
        assert len(user.square_access_token) > 20
    finally:
        app.dependency_overrides.clear()
