import pytest
from unittest.mock import patch, MagicMock
from app.core.retry import square_retry, anthropic_retry, is_retryable
from app.square.client import SquareAPIError, raise_square_error


def test_is_retryable_returns_true_for_503():
    exc = SquareAPIError("server error", status_code=503)
    assert is_retryable(exc) is True


def test_is_retryable_returns_false_for_401():
    exc = SquareAPIError("unauthorized", status_code=401)
    assert is_retryable(exc) is False


def test_is_retryable_returns_true_for_plain_exception():
    exc = ConnectionError("network down")
    assert is_retryable(exc) is True


def test_raise_square_error_permanent_for_unauthorized():
    with pytest.raises(SquareAPIError) as exc_info:
        raise_square_error([{"code": "UNAUTHORIZED"}])
    assert exc_info.value.status_code == 401


def test_raise_square_error_transient_for_unknown():
    with pytest.raises(SquareAPIError) as exc_info:
        raise_square_error([{"code": "SERVICE_UNAVAILABLE"}])
    assert exc_info.value.status_code == 503


def test_raise_square_error_permanent_for_not_found():
    with pytest.raises(SquareAPIError) as exc_info:
        raise_square_error([{"code": "NOT_FOUND"}])
    assert exc_info.value.status_code == 404


def test_square_retry_retries_on_503():
    call_count = 0

    @square_retry
    def flaky():
        nonlocal call_count
        call_count += 1
        raise SquareAPIError("server error", status_code=503)

    with patch("tenacity.nap.time"):
        with pytest.raises(SquareAPIError):
            flaky()
    assert call_count == 3  # retried 3 times total


def test_square_retry_does_not_retry_on_401():
    call_count = 0

    @square_retry
    def permanent_fail():
        nonlocal call_count
        call_count += 1
        raise SquareAPIError("unauthorized", status_code=401)

    with pytest.raises(SquareAPIError):
        permanent_fail()
    assert call_count == 1  # never retried


import uuid
from app.core.errors import log_error, resolve_errors, resolve_errors_by_email
from app.models.error_log import ErrorLog
from app.models.user import User


def test_log_error_creates_row(db):
    u = User(email=f"{uuid.uuid4().hex}@t.com", hashed_password="x")
    db.add(u)
    db.commit()

    exc = SquareAPIError("timeout", status_code=503)
    log_error(db, "square_sync", exc, user_id=u.id)

    row = db.query(ErrorLog).filter(ErrorLog.user_id == u.id).first()
    assert row is not None
    assert row.operation == "square_sync"
    assert row.resolved is False
    assert row.alert_sent is False
    assert row.error_code == "503"  # stored as string for typed errors


def test_log_error_stores_none_for_plain_exceptions(db):
    u = User(email=f"{uuid.uuid4().hex}@t.com", hashed_password="x")
    db.add(u)
    db.commit()

    log_error(db, "square_sync", Exception("something broke"), user_id=u.id)

    row = db.query(ErrorLog).filter(ErrorLog.user_id == u.id).first()
    assert row.error_code is None  # NULL, not the string "None"


def test_resolve_errors_marks_resolved_and_resets_alert_sent(db):
    u = User(email=f"{uuid.uuid4().hex}@t.com", hashed_password="x")
    db.add(u)
    db.commit()

    log_error(db, "square_sync", Exception("err"), user_id=u.id)
    # simulate alert was already sent
    row = db.query(ErrorLog).filter(ErrorLog.user_id == u.id).first()
    row.alert_sent = True
    db.commit()

    resolve_errors(db, "square_sync", user_id=u.id)

    db.refresh(row)
    assert row.resolved is True
    assert row.alert_sent is False  # reset so future errors can alert again


def test_resolve_errors_by_email_clears_null_user_id_rows(db):
    email = f"{uuid.uuid4().hex}@t.com"
    log_error(db, "auth_login", Exception("bad pw"), context={"email": email})

    resolve_errors_by_email(db, "auth_login", email=email)

    row = db.query(ErrorLog).filter(
        ErrorLog.operation == "auth_login",
        ErrorLog.context["email"].astext == email,
    ).first()
    assert row.resolved is True
    assert row.alert_sent is False
