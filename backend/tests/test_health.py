import uuid
from datetime import datetime, timezone, timedelta
from app.core.health import on_sync_failure, on_sync_success, on_prediction_failure, on_prediction_success, auto_reset_sync
from app.models.customer_health import CustomerHealth
from app.models.user import User
from app.models.customer import Customer


def _make_customer(db):
    u = User(email=f"{uuid.uuid4().hex}@t.com", hashed_password="x", business_name="B")
    db.add(u)
    db.commit()
    c = Customer(user_id=u.id, square_customer_id=uuid.uuid4().hex, given_name="T")
    db.add(c)
    db.commit()
    return c


def test_sync_failure_increments_count(db):
    c = _make_customer(db)
    on_sync_failure(db, c.id)
    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == c.id).first()
    assert health.sync_fail_count == 1
    assert health.sync_skip is False


def test_sync_failure_skips_at_3(db):
    c = _make_customer(db)
    on_sync_failure(db, c.id)
    on_sync_failure(db, c.id)
    on_sync_failure(db, c.id)
    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == c.id).first()
    assert health.sync_skip is True
    assert health.sync_skip_until is not None


def test_sync_success_decrements_count(db):
    c = _make_customer(db)
    on_sync_failure(db, c.id)
    on_sync_failure(db, c.id)
    on_sync_success(db, c.id)
    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == c.id).first()
    assert health.sync_fail_count == 1


def test_sync_success_clears_skip_at_zero(db):
    c = _make_customer(db)
    on_sync_failure(db, c.id)
    on_sync_success(db, c.id)
    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == c.id).first()
    assert health.sync_fail_count == 0
    assert health.sync_skip is False


def test_prediction_failure_sets_fallback_at_3(db):
    c = _make_customer(db)
    on_prediction_failure(db, c.id)
    on_prediction_failure(db, c.id)
    on_prediction_failure(db, c.id)
    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == c.id).first()
    assert health.prediction_fallback is True


def test_prediction_success_clears_fallback(db):
    c = _make_customer(db)
    on_prediction_failure(db, c.id)
    on_prediction_failure(db, c.id)
    on_prediction_failure(db, c.id)
    on_prediction_success(db, c.id)
    on_prediction_success(db, c.id)
    on_prediction_success(db, c.id)
    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == c.id).first()
    assert health.prediction_fallback is False
    assert health.prediction_fail_count == 0


def test_auto_reset_clears_expired_skip(db):
    c = _make_customer(db)
    on_sync_failure(db, c.id)
    on_sync_failure(db, c.id)
    on_sync_failure(db, c.id)
    # manually set skip_until to the past
    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == c.id).first()
    health.sync_skip_until = datetime.now(timezone.utc) - timedelta(days=1)
    db.commit()

    auto_reset_sync(db, c.id)

    db.refresh(health)
    assert health.sync_skip is False
    assert health.sync_fail_count == 0
