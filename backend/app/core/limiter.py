from slowapi import Limiter
from slowapi.util import get_remote_address

# Single shared limiter instance.
# Both main.py (app.state.limiter) and auth/router.py (@limiter.limit) import from here.
# Using two separate Limiter() instances causes slowapi to silently ignore per-route limits.
# default_limits applies a 60/minute per-IP cap on all routes that don't have an explicit limit.
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
