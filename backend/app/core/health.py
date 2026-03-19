from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models.customer_health import CustomerHealth

SYNC_SKIP_DAYS = 7
FAIL_THRESHOLD = 3


def _get_or_create(db: Session, customer_id) -> CustomerHealth:
    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == customer_id).first()
    if not health:
        health = CustomerHealth(customer_id=customer_id)
        db.add(health)
        db.flush()
    return health


def on_sync_failure(db: Session, customer_id) -> None:
    health = _get_or_create(db, customer_id)
    health.sync_fail_count += 1
    health.last_error_at = datetime.now(timezone.utc)
    if health.sync_fail_count >= FAIL_THRESHOLD:
        health.sync_skip = True
        health.sync_skip_until = datetime.now(timezone.utc) + timedelta(days=SYNC_SKIP_DAYS)
    db.commit()


def on_sync_success(db: Session, customer_id) -> None:
    health = _get_or_create(db, customer_id)
    health.sync_fail_count = max(0, health.sync_fail_count - 1)
    if health.sync_fail_count == 0:
        health.sync_skip = False
        health.sync_skip_until = None
    db.commit()


def on_prediction_failure(db: Session, customer_id) -> None:
    health = _get_or_create(db, customer_id)
    health.prediction_fail_count += 1
    health.last_error_at = datetime.now(timezone.utc)
    if health.prediction_fail_count >= FAIL_THRESHOLD:
        health.prediction_fallback = True
    db.commit()


def on_prediction_success(db: Session, customer_id) -> None:
    health = _get_or_create(db, customer_id)
    health.prediction_fail_count = max(0, health.prediction_fail_count - 1)
    if health.prediction_fail_count == 0:
        health.prediction_fallback = False
    db.commit()


def auto_reset_sync(db: Session, customer_id) -> None:
    """Call at the start of each sync. Clears sync_skip if the 7-day window has expired."""
    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == customer_id).first()
    if not health:
        return
    if health.sync_skip and health.sync_skip_until and health.sync_skip_until < datetime.now(timezone.utc):
        health.sync_skip = False
        health.sync_fail_count = 0
        health.sync_skip_until = None
        db.commit()
