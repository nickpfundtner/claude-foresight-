from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

RETRYABLE_CODES = {429, 500, 502, 503, 504}


def is_retryable(exc: Exception) -> bool:
    """Return True if the exception is transient and worth retrying."""
    if hasattr(exc, "status_code"):
        return exc.status_code in RETRYABLE_CODES
    return True  # plain network / connection errors are always retryable


square_retry = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception(is_retryable),
    reraise=True,
)

anthropic_retry = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=16),
    retry=retry_if_exception(is_retryable),
    reraise=True,
)
