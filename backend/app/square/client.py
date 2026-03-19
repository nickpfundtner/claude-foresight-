try:
    from square.client import Client as SquareClient
except ImportError:
    # Fallback for when square SDK is not available
    class SquareClient:
        """Mock Square client when SDK is unavailable"""
        def __init__(self, access_token: str, environment: str = "production"):
            self.access_token = access_token
            self.environment = environment


class SquareAPIError(Exception):
    """Typed exception for Square API failures with an HTTP status_code attribute.
    The retry filter reads status_code to decide whether to retry."""

    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


def raise_square_error(errors: list) -> None:
    """Convert a Square error list into a SquareAPIError with the right status_code.
    Permanent failures (401, 404) are never retried. Everything else is treated as transient."""
    code = errors[0].get("code", "") if errors else ""
    if code in ("UNAUTHORIZED", "ACCESS_TOKEN_EXPIRED", "FORBIDDEN"):
        raise SquareAPIError(str(errors), status_code=401)
    if code in ("NOT_FOUND",):
        raise SquareAPIError(str(errors), status_code=404)
    raise SquareAPIError(str(errors), status_code=503)


def get_square_client(access_token: str) -> SquareClient:
    """Return a Square client for a given user's decrypted access token."""
    return SquareClient(access_token=access_token, environment="production")
