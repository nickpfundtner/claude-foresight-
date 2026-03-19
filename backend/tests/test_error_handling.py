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
