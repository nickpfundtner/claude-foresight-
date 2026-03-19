import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
from app.models.user import User
from app.models.error_log import ErrorLog
from app.alerts.checker import check_and_alert, _check_repeated_sync_failures, _check_nightly_sync_broken, _check_anthropic_degraded


def _make_user(db):
    u = User(email=f"{uuid.uuid4().hex}@t.com", hashed_password="x", business_name="TestBiz")
    db.add(u)
    db.commit()
    return u


def _add_sync_errors(db, user_id, count, created_at=None):
    now = created_at or datetime.now(timezone.utc)
    rows = []
    for i in range(count):
        row = ErrorLog(
            user_id=user_id,
            operation="square_sync",
            error_message=f"error {i}",
            resolved=False,
            alert_sent=False,
            created_at=now,
        )
        db.add(row)
        rows.append(row)
    db.commit()
    return rows


def test_check_repeated_sync_failures_sends_alert_at_3(db):
    user = _make_user(db)
    _add_sync_errors(db, user.id, 3)

    with patch("app.alerts.checker.send_alert") as mock_send:
        _check_repeated_sync_failures(db)
        mock_send.assert_called_once()
        assert "TestBiz" in mock_send.call_args[0][0]


def test_check_repeated_sync_failures_does_not_alert_below_3(db):
    user = _make_user(db)
    _add_sync_errors(db, user.id, 2)

    with patch("app.alerts.checker.send_alert") as mock_send:
        _check_repeated_sync_failures(db)
        mock_send.assert_not_called()


def test_check_repeated_sync_failures_skips_if_already_alerted(db):
    user = _make_user(db)
    rows = _add_sync_errors(db, user.id, 3)
    rows[0].alert_sent = True
    db.commit()

    with patch("app.alerts.checker.send_alert") as mock_send:
        _check_repeated_sync_failures(db)
        mock_send.assert_not_called()


def test_check_nightly_sync_broken_sends_alert_spanning_2_hours(db):
    user = _make_user(db)
    now = datetime.now(timezone.utc)
    _add_sync_errors(db, user.id, 1, created_at=now - timedelta(hours=3))
    _add_sync_errors(db, user.id, 1, created_at=now)

    with patch("app.alerts.checker.send_alert") as mock_send:
        _check_nightly_sync_broken(db)
        mock_send.assert_called_once()


def test_check_nightly_sync_broken_skips_if_already_alerted(db):
    user = _make_user(db)
    now = datetime.now(timezone.utc)
    rows = _add_sync_errors(db, user.id, 1, created_at=now - timedelta(hours=3))
    rows[0].alert_sent = True
    db.commit()
    _add_sync_errors(db, user.id, 1, created_at=now)

    with patch("app.alerts.checker.send_alert") as mock_send:
        _check_nightly_sync_broken(db)
        mock_send.assert_not_called()


def test_check_anthropic_degraded_sends_alert_at_50_percent(db):
    from app.models.prediction import Prediction
    from app.models.customer import Customer
    now = datetime.now(timezone.utc)
    user = _make_user(db)
    c = Customer(user_id=user.id, square_customer_id=uuid.uuid4().hex)
    db.add(c)
    db.commit()

    for i in range(6):
        db.add(ErrorLog(
            operation="anthropic_prediction",
            error_message=f"err {i}",
            resolved=False,
            alert_sent=False,
            created_at=now,
        ))
    for i in range(4):
        db.add(Prediction(
            customer_id=c.id,
            churn_risk="low",
            churn_risk_score=0.1,
            generated_at=now,
        ))
    db.commit()

    with patch("app.alerts.checker.send_alert") as mock_send:
        _check_anthropic_degraded(db)
        mock_send.assert_called_once()


def test_check_and_alert_runs_all_three_checks(db):
    with patch("app.alerts.checker._check_repeated_sync_failures") as m1, \
         patch("app.alerts.checker._check_nightly_sync_broken") as m2, \
         patch("app.alerts.checker._check_anthropic_degraded") as m3:
        check_and_alert(db)
        m1.assert_called_once_with(db)
        m2.assert_called_once_with(db)
        m3.assert_called_once_with(db)
