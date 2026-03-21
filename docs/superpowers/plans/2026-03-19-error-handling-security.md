# Error Handling, Self-Healing & Security — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic retry with exponential backoff, per-customer self-healing health tracking, Fernet-encrypted Square tokens, PII stripping before Anthropic, brute-force lockout, rate limiting, security headers, and SMTP alerting to the Customer Intelligence Platform.

**Architecture:** Three new layers bolt onto the existing FastAPI + PostgreSQL stack with no new infrastructure. `core/` modules handle retry, error logging, health rules, encryption, PII stripping, and the shared rate limiter. `alerts/` handles SMTP. Two new DB tables (`error_logs`, `customer_health`) store all state. Existing Square sync and prediction engine are updated to use these layers.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, tenacity 8.3, slowapi 0.1.9, cryptography 42.0.5, smtplib (built-in), Alembic, PostgreSQL 15

**Prerequisites:** This plan extends the Customer Intelligence Platform. The platform plan must be executed first. In particular, `backend/tests/conftest.py` must exist with `test_engine` and `db` pytest fixtures (created in the platform plan's Task 0). Verify it exists before starting Task 2.

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `backend/app/core/__init__.py` | Package marker |
| `backend/app/core/limiter.py` | Shared slowapi `Limiter` instance (prevents dual-instance conflict) |
| `backend/app/core/retry.py` | tenacity retry decorators (`square_retry`, `anthropic_retry`) |
| `backend/app/core/errors.py` | `log_error()`, `resolve_errors()`, `resolve_errors_by_email()` |
| `backend/app/core/security.py` | Fernet `encrypt_token()` / `decrypt_token()` |
| `backend/app/core/pii.py` | `strip_pii()` — anonymize Customer before Anthropic |
| `backend/app/core/health.py` | CustomerHealth rules engine: `on_sync_failure`, `on_sync_success`, `on_prediction_failure`, `on_prediction_success`, `auto_reset_sync` |
| `backend/app/models/error_log.py` | `ErrorLog` SQLAlchemy model |
| `backend/app/models/customer_health.py` | `CustomerHealth` SQLAlchemy model |
| `backend/app/alerts/__init__.py` | Package marker |
| `backend/app/alerts/smtp.py` | `send_alert(subject, body)` via smtplib |
| `backend/app/alerts/checker.py` | `check_and_alert(db)` — three critical-pattern queries |
| `backend/tests/test_error_handling.py` | Tests for retry, logging, resolution |
| `backend/tests/test_security.py` | Tests for encryption, PII stripping, brute force lockout, PII-in-prompt |
| `backend/tests/test_health.py` | Tests for CustomerHealth rules engine |
| `backend/tests/test_square_sync_wired.py` | Tests for wired Square sync (retry, health skip, error logging) |
| `backend/tests/test_predictions_wired.py` | Tests for wired predictions engine (PII stripping, fallback) |
| `backend/tests/test_alerts.py` | Tests for alert checker patterns |

### Modified Files

| File | Change |
|---|---|
| `backend/requirements.txt` | Add tenacity, slowapi, cryptography |
| `backend/.env.example` | Add ENCRYPTION_KEY + SMTP fields |
| `backend/app/config.py` | Add 6 new settings fields |
| `backend/app/models/__init__.py` | Import ErrorLog, CustomerHealth |
| `backend/app/main.py` | Global exception handler + shared rate limiter + security headers |
| `backend/app/square/client.py` | Add `SquareAPIError` + `raise_square_error()` |
| `backend/app/square/sync.py` | Use `raise_square_error`, `square_retry`, health checks, `log_error`/`resolve_errors` |
| `backend/app/auth/router.py` | Brute force lockout + `log_error` on failed logins + rate limit decorators |
| `backend/app/auth/schemas.py` | Password strength validator |
| `backend/app/predictions/engine.py` | Use `anthropic_retry`, `strip_pii`, fallback prompt, health checks |
| `backend/app/predictions/scheduler.py` | Add hourly alert checker job |

---

## Task 1: Dependencies + Config

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/.env.example`
- Modify: `backend/app/config.py`

- [ ] **Step 1: Add new packages to `backend/requirements.txt`**

Append these three lines:
```
tenacity==8.3.0
slowapi==0.1.9
cryptography==42.0.5
```

- [ ] **Step 2: Add new fields to `backend/.env.example`**

Append:
```
ENCRYPTION_KEY=                             # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ALERT_EMAIL_TO=you@youremail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourapp@gmail.com
SMTP_PASSWORD=your_app_password
```

- [ ] **Step 3: Update `backend/app/config.py`**

Replace the full file with:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30
    square_access_token: str = ""
    anthropic_api_key: str = ""
    encryption_key: str = ""
    alert_email_to: str = ""
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 4: Install new packages**

```bash
cd /c/Users/Owner/customer-intelligence/backend && pip install tenacity==8.3.0 slowapi==0.1.9 cryptography==42.0.5
```
Expected: All three packages install without errors.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Owner/customer-intelligence
git add backend/requirements.txt backend/.env.example backend/app/config.py
git commit -m "chore: add tenacity, slowapi, cryptography deps + config fields"
```

---

## Task 2: New DB Models + Migration

**Files:**
- Create: `backend/app/models/error_log.py`
- Create: `backend/app/models/customer_health.py`
- Modify: `backend/app/models/__init__.py`

> **Prerequisite check:** Verify `backend/tests/conftest.py` exists and contains `test_engine` and `db` fixtures. This file was created in the platform implementation plan's Task 0. If it's missing, go back and run that plan's Task 0 first.

```bash
grep -l "test_engine\|def db" /c/Users/Owner/customer-intelligence/backend/tests/conftest.py
```
Expected: `conftest.py` is printed. If you get an error, stop and set up conftest.py first.

- [ ] **Step 1: Write failing test for new tables**

Create `backend/tests/test_new_models.py`:
```python
from sqlalchemy import inspect


def test_error_logs_table_created(test_engine):
    inspector = inspect(test_engine)
    cols = {c["name"] for c in inspector.get_columns("error_logs")}
    assert "id" in cols
    assert "operation" in cols
    assert "context" in cols
    assert "alert_sent" in cols
    assert "resolved" in cols


def test_customer_health_table_created(test_engine):
    inspector = inspect(test_engine)
    cols = {c["name"] for c in inspector.get_columns("customer_health")}
    assert "customer_id" in cols
    assert "sync_skip" in cols
    assert "prediction_fallback" in cols
    assert "sync_skip_until" in cols
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_new_models.py -v
```
Expected: FAIL — tables don't exist yet.

- [ ] **Step 3: Create `backend/app/models/error_log.py`**

```python
import uuid
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.sql import func
from app.database import Base


class ErrorLog(Base):
    __tablename__ = "error_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True)
    operation = Column(String, nullable=False, index=True)
    error_message = Column(Text, nullable=False)
    error_code = Column(String, nullable=True)
    context = Column(JSON, nullable=True)
    resolved = Column(Boolean, default=False, nullable=False)
    alert_sent = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 4: Create `backend/app/models/customer_health.py`**

```python
import uuid
from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class CustomerHealth(Base):
    __tablename__ = "customer_health"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, unique=True, index=True)
    sync_fail_count = Column(Integer, default=0, nullable=False)
    sync_skip = Column(Boolean, default=False, nullable=False)
    sync_skip_until = Column(DateTime(timezone=True), nullable=True)
    prediction_fail_count = Column(Integer, default=0, nullable=False)
    prediction_fallback = Column(Boolean, default=False, nullable=False)
    last_error_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

- [ ] **Step 5: Update `backend/app/models/__init__.py`**

```python
from app.models.user import User
from app.models.customer import Customer
from app.models.transaction import Transaction
from app.models.prediction import Prediction
from app.models.error_log import ErrorLog
from app.models.customer_health import CustomerHealth
```

- [ ] **Step 6: Run test — verify it passes**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_new_models.py -v
```
Expected: Both tests PASS.

- [ ] **Step 7: Generate and run Alembic migration**

```bash
cd /c/Users/Owner/customer-intelligence/backend
alembic revision --autogenerate -m "add error_logs and customer_health tables"
alembic upgrade head
```
Expected: Migration file created, `alembic upgrade head` prints `Running upgrade ... -> ...` with no errors.

- [ ] **Step 8: Commit**

```bash
cd /c/Users/Owner/customer-intelligence
git add backend/app/models/error_log.py backend/app/models/customer_health.py backend/app/models/__init__.py backend/alembic/ backend/tests/test_new_models.py
git commit -m "feat: ErrorLog and CustomerHealth models + migration"
```

---

## Task 3: Retry Logic + Typed Square Exception

**Files:**
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/limiter.py`
- Create: `backend/app/core/retry.py`
- Modify: `backend/app/square/client.py`
- Test: `backend/tests/test_error_handling.py`

- [ ] **Step 1: Create `backend/app/core/__init__.py`** (empty package marker)

Create an empty file at `backend/app/core/__init__.py`.

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -c "import app.core; print('core package OK')"
```
Expected: `core package OK`

- [ ] **Step 2: Write failing retry tests**

Create `backend/tests/test_error_handling.py`:
```python
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
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_error_handling.py -v
```
Expected: FAIL — modules not found yet.

- [ ] **Step 4: Create `backend/app/core/limiter.py`**

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

# Single shared limiter instance.
# Both main.py (app.state.limiter) and auth/router.py (@limiter.limit) import from here.
# Using two separate Limiter() instances causes slowapi to silently ignore per-route limits.
# default_limits applies a 60/minute per-IP cap on all routes that don't have an explicit limit.
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
```

- [ ] **Step 5: Create `backend/app/core/retry.py`**

```python
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
```

- [ ] **Step 6: Update `backend/app/square/client.py`**

Replace the full file with:
```python
from square.client import Client as SquareClient


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
```

- [ ] **Step 7: Run tests — verify they pass**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_error_handling.py -v
```
Expected: All 8 tests PASS.

- [ ] **Step 8: Commit**

```bash
cd /c/Users/Owner/customer-intelligence
git add backend/app/core/ backend/app/square/client.py backend/tests/test_error_handling.py
git commit -m "feat: tenacity retry logic + shared limiter + typed SquareAPIError"
```

---

## Task 4: Error Logging (`core/errors.py`)

**Files:**
- Create: `backend/app/core/errors.py`
- Test: `backend/tests/test_error_handling.py` (extend)

- [ ] **Step 1: Write failing tests for error logging**

Append to `backend/tests/test_error_handling.py`:
```python
import uuid
from app.core.errors import log_error, resolve_errors, resolve_errors_by_email
from app.models.error_log import ErrorLog
from app.models.user import User


def test_log_error_creates_row(db):
    u = User(email=f"{uuid.uuid4().hex}@t.com", hashed_password="x", business_name="B")
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
    u = User(email=f"{uuid.uuid4().hex}@t.com", hashed_password="x", business_name="B")
    db.add(u)
    db.commit()

    log_error(db, "square_sync", Exception("something broke"), user_id=u.id)

    row = db.query(ErrorLog).filter(ErrorLog.user_id == u.id).first()
    assert row.error_code is None  # NULL, not the string "None"


def test_resolve_errors_marks_resolved_and_resets_alert_sent(db):
    u = User(email=f"{uuid.uuid4().hex}@t.com", hashed_password="x", business_name="B")
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_error_handling.py::test_log_error_creates_row -v
```
Expected: FAIL — `app.core.errors` not found.

- [ ] **Step 3: Create `backend/app/core/errors.py`**

```python
from __future__ import annotations
from sqlalchemy.orm import Session
from app.models.error_log import ErrorLog


def log_error(
    db: Session,
    operation: str,
    error: Exception,
    user_id=None,
    customer_id=None,
    context: dict | None = None,
) -> None:
    """Write one ErrorLog row. Called in every except block after retries are exhausted.
    error_code is stored as a string when the exception has a status_code attribute,
    or NULL (Python None) for plain exceptions — never the string "None"."""
    status_code = getattr(error, "status_code", None)
    db.add(ErrorLog(
        user_id=user_id,
        customer_id=customer_id,
        operation=operation,
        error_message=str(error),
        error_code=str(status_code) if status_code is not None else None,
        context=context,
    ))
    db.commit()


def resolve_errors(
    db: Session,
    operation: str,
    user_id=None,
    customer_id=None,
) -> None:
    """Mark matching open errors as resolved and reset alert_sent.
    Resetting alert_sent ensures future errors for this operation can trigger new alerts."""
    query = db.query(ErrorLog).filter(
        ErrorLog.operation == operation,
        ErrorLog.resolved == False,
    )
    if user_id is not None:
        query = query.filter(ErrorLog.user_id == user_id)
    if customer_id is not None:
        query = query.filter(ErrorLog.customer_id == customer_id)
    query.update({"resolved": True, "alert_sent": False})
    db.commit()


def resolve_errors_by_email(db: Session, operation: str, email: str) -> None:
    """Resolve auth_login failures where user_id=NULL (pre-auth, nonexistent account).
    These rows are only queryable by context['email'] via PostgreSQL JSON operator."""
    db.query(ErrorLog).filter(
        ErrorLog.operation == operation,
        ErrorLog.resolved == False,
        ErrorLog.context["email"].astext == email,
    ).update({"resolved": True, "alert_sent": False}, synchronize_session=False)
    db.commit()
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_error_handling.py -v
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Owner/customer-intelligence
git add backend/app/core/errors.py backend/tests/test_error_handling.py
git commit -m "feat: error logging - log_error, resolve_errors, resolve_errors_by_email"
```

---

## Task 5: CustomerHealth Rules Engine (`core/health.py`)

**Files:**
- Create: `backend/app/core/health.py`
- Test: `backend/tests/test_health.py`

- [ ] **Step 1: Write failing health tests**

Create `backend/tests/test_health.py`:
```python
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_health.py -v
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/app/core/health.py`**

```python
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_health.py -v
```
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Owner/customer-intelligence
git add backend/app/core/health.py backend/tests/test_health.py
git commit -m "feat: CustomerHealth rules engine - sync/prediction fail tracking + auto-reset"
```

---

## Task 6: Security — Encryption + PII Stripping

**Files:**
- Create: `backend/app/core/security.py`
- Create: `backend/app/core/pii.py`
- Test: `backend/tests/test_security.py`

- [ ] **Step 1: Write failing security tests**

Create `backend/tests/test_security.py`:
```python
import uuid
from app.core.security import encrypt_token, decrypt_token
from app.core.pii import strip_pii
from app.models.customer import Customer
from app.predictions.engine import _build_prompt


def test_encrypt_decrypt_round_trip():
    original = "sq0atp-super-secret-token-abc123"
    ciphertext = encrypt_token(original)
    assert ciphertext != original  # it's actually encrypted
    assert decrypt_token(ciphertext) == original


def test_encrypt_produces_different_ciphertext_each_time():
    """Fernet uses a random IV — same input should never produce same output."""
    token = "same-token"
    assert encrypt_token(token) != encrypt_token(token)


def test_strip_pii_removes_name_email_phone():
    c = Customer(
        id=uuid.uuid4(),
        given_name="Alice",
        family_name="Smith",
        email="alice@example.com",
        phone="+15551234567",
        total_visits=10,
        total_spent=250.0,
    )
    result = strip_pii(c)
    assert "Alice" not in str(result)
    assert "Smith" not in str(result)
    assert "alice@example.com" not in str(result)
    assert "+15551234567" not in str(result)


def test_strip_pii_keeps_behavioral_fields():
    c = Customer(
        id=uuid.uuid4(),
        given_name="Bob",
        total_visits=5,
        total_spent=120.0,
    )
    result = strip_pii(c)
    assert result["total_visits"] == 5
    assert result["total_spent"] == 120.0
    assert result["id"].startswith("Customer #")


def test_build_prompt_never_includes_real_name():
    """PII stripping + _build_prompt integration: the real customer name must never appear in the prompt."""
    c = Customer(
        id=uuid.uuid4(),
        given_name="SecretName",
        family_name="SecretFamily",
        email="secret@example.com",
        total_visits=3,
        total_spent=90.0,
    )
    customer_data = strip_pii(c)
    prompt = _build_prompt(customer_data, transactions=[], fallback=False)
    assert "SecretName" not in prompt
    assert "SecretFamily" not in prompt
    assert "secret@example.com" not in prompt
    assert "Customer #" in prompt  # anonymous ID format is used
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_security.py -v
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Generate an encryption key and add it to your `.env` file**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Expected: A base64 key is printed, e.g. `dGhpcyBpcyBhIHRlc3Qga2V5IGZvciBGZXJuZXQ=`

Copy the output. Open `backend/.env` and add (or update):
```
ENCRYPTION_KEY=<paste-your-generated-key-here>
```

- [ ] **Step 4: Create `backend/app/core/security.py`**

```python
from cryptography.fernet import Fernet
from app.config import settings


def _fernet() -> Fernet:
    return Fernet(settings.encryption_key.encode())


def encrypt_token(token: str) -> str:
    """Encrypt a Square access token before storing in the database."""
    return _fernet().encrypt(token.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a Square access token at sync time. Never store the result."""
    return _fernet().decrypt(ciphertext.encode()).decode()
```

- [ ] **Step 5: Create `backend/app/core/pii.py`**

```python
from app.models.customer import Customer


def strip_pii(customer: Customer) -> dict:
    """Return anonymized customer data safe to send to Anthropic.
    Never includes name, email, or phone. Only behavioral data."""
    return {
        "id": f"Customer #{abs(hash(str(customer.id))) % 10000}",
        "total_visits": customer.total_visits,
        "total_spent": customer.total_spent,
        "first_visit_at": customer.first_visit_at,
        "last_visit_at": customer.last_visit_at,
    }
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_security.py -v
```
Expected: All 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/Owner/customer-intelligence
git add backend/app/core/security.py backend/app/core/pii.py backend/tests/test_security.py
git commit -m "feat: Fernet encryption for Square tokens + PII stripping before Anthropic"
```

---

## Task 7: Auth Hardening — Password Validation + Brute Force Lockout + Rate Limiting

**Files:**
- Modify: `backend/app/auth/schemas.py`
- Modify: `backend/app/auth/router.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_security.py` (extend)

- [ ] **Step 1: Write failing auth security tests**

Append to `backend/tests/test_security.py`:
```python
import uuid as _uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_password_too_short_rejected():
    r = client.post("/auth/register", json={
        "email": f"{_uuid.uuid4().hex}@t.com",
        "password": "short1",
        "business_name": "B"
    })
    assert r.status_code == 422


def test_password_no_digit_rejected():
    r = client.post("/auth/register", json={
        "email": f"{_uuid.uuid4().hex}@t.com",
        "password": "nodigitshere",
        "business_name": "B"
    })
    assert r.status_code == 422


def test_brute_force_lockout():
    email = f"{_uuid.uuid4().hex}@t.com"
    # register a real account
    client.post("/auth/register", json={"email": email, "password": "Valid123", "business_name": "B"})
    # hammer it with wrong passwords
    for _ in range(10):
        client.post("/auth/login", json={"email": email, "password": "wrongpassword1"})
    # 11th attempt should be locked
    r = client.post("/auth/login", json={"email": email, "password": "wrongpassword1"})
    assert r.status_code == 429
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_security.py::test_password_too_short_rejected tests/test_security.py::test_brute_force_lockout -v
```
Expected: FAIL.

- [ ] **Step 3: Update `backend/app/auth/schemas.py`** — add password validator

```python
from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    business_name: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters and contain at least one number")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must be at least 8 characters and contain at least one number")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    business_name: str
```

- [ ] **Step 4: Update `backend/app/auth/router.py`** — add brute force lockout + rate limit decorators

```python
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.error_log import ErrorLog
from app.auth.schemas import RegisterRequest, LoginRequest, TokenResponse
from app.auth.utils import hash_password, verify_password, create_access_token
from app.core.errors import log_error, resolve_errors, resolve_errors_by_email
from app.core.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

LOCKOUT_ATTEMPTS = 10
LOCKOUT_WINDOW_MINUTES = 15


def _check_brute_force(db: Session, email: str) -> None:
    """Raise 429 if this email has 10+ failed login attempts in the last 15 minutes."""
    recent = db.query(ErrorLog).filter(
        ErrorLog.operation == "auth_login",
        ErrorLog.resolved == False,
        ErrorLog.context["email"].astext == email,
        ErrorLog.created_at >= datetime.now(timezone.utc) - timedelta(minutes=LOCKOUT_WINDOW_MINUTES),
    ).count()
    if recent >= LOCKOUT_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked. Try again in 15 minutes.",
        )


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("3/minute")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        business_name=body.business_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user_id=str(user.id), business_name=user.business_name)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    _check_brute_force(db, body.email)
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        log_error(
            db, "auth_login", Exception("invalid credentials"),
            user_id=user.id if user else None,
            context={"email": body.email},
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # success — resolve prior lockout rows for this user
    resolve_errors(db, "auth_login", user_id=user.id)
    resolve_errors_by_email(db, "auth_login", email=body.email)
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user_id=str(user.id), business_name=user.business_name)
```

> **Note on rate limiting:** `@limiter.limit("3/minute")` on register and `@limiter.limit("5/minute")` on login use the shared `limiter` from `core/limiter.py`. The `default_limits=["60/minute"]` set on that limiter automatically applies to all other endpoints. The `request: Request` parameter is required by slowapi — it must be the first parameter after `self` (for class-based views) or the first positional parameter.

- [ ] **Step 5: Update `backend/app/main.py`** — add security headers + rate limiter + global exception handler

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter
from app.auth.router import router as auth_router
from app.square.router import router as square_router
from app.predictions.router import router as predictions_router
from app.dashboard.router import router as dashboard_router
from app.predictions.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app):
    scheduler = start_scheduler()
    yield
    scheduler.shutdown()


app = FastAPI(title="Customer Intelligence Platform", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "message": "Something went wrong. Our team has been notified.", "code": 500},
    )


app.include_router(auth_router)
app.include_router(square_router)
app.include_router(predictions_router)
app.include_router(dashboard_router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_security.py -v
```
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/Owner/customer-intelligence
git add backend/app/auth/schemas.py backend/app/auth/router.py backend/app/main.py backend/tests/test_security.py
git commit -m "feat: password validation, brute force lockout, rate limiting, security headers"
```

---

## Task 8: Wire Square Sync to Retry + Health + Error Logging

**Files:**
- Modify: `backend/app/square/sync.py`
- Modify: `backend/app/square/router.py`
- Test: `backend/tests/test_square_sync_wired.py`

- [ ] **Step 1: Write failing tests for wired sync behavior**

Create `backend/tests/test_square_sync_wired.py`:
```python
import uuid
from unittest.mock import patch, MagicMock
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
    """When Square API raises on the first page, an ErrorLog row must be written."""
    user = _make_user(db)

    with patch("app.square.sync.get_square_client") as mock_client, \
         patch("app.core.security.decrypt_token", return_value="raw-token"):
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
    """A customer with sync_skip=True must be skipped — no update, no health calls."""
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
         patch("app.core.security.decrypt_token", return_value="raw-token"):
        from app.square.sync import sync_customers
        sync_customers(user, db)

    db.refresh(c)
    assert c.given_name == "Old"  # not updated


def test_connect_square_encrypts_token(db):
    """The /square/connect endpoint must store an encrypted token, not the raw value."""
    from fastapi.testclient import TestClient
    from app.main import app
    import uuid

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
    assert user.square_access_token != raw_token  # must be encrypted
    assert len(user.square_access_token) > 20  # Fernet ciphertext is long
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_square_sync_wired.py -v
```
Expected: FAIL — sync.py doesn't have retry/health wiring yet.

- [ ] **Step 3: Update `backend/app/square/sync.py`**

Replace the full file:
```python
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

    existing_customers = {
        c.square_customer_id: c
        for c in db.query(Customer).filter(Customer.user_id == user.id).all()
    }

    while True:
        try:
            body = _list_customers_page(client, cursor=cursor)
        except Exception as e:
            log_error(db, "square_sync", e, user_id=user.id)
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
```

- [ ] **Step 4: Update `backend/app/square/router.py`** — encrypt token on connect

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.square.schemas import ConnectSquareRequest, SyncResponse
from app.square.sync import sync_customers, sync_transactions
from app.core.security import encrypt_token

router = APIRouter(prefix="/square", tags=["square"])


@router.post("/connect")
def connect_square(body: ConnectSquareRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.square_access_token = encrypt_token(body.access_token)
    user.square_location_id = body.location_id
    db.commit()
    return {"message": "Square connected"}


@router.post("/sync", response_model=SyncResponse)
def sync_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.square_access_token:
        raise HTTPException(status_code=400, detail="Square not connected")
    customers = sync_customers(user, db)
    transactions = sync_transactions(user, db)
    return SyncResponse(customers_synced=customers, transactions_synced=transactions)
```

- [ ] **Step 5: Run all sync tests — verify they pass**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_square_sync.py tests/test_square_sync_wired.py -v
```
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Owner/customer-intelligence
git add backend/app/square/sync.py backend/app/square/router.py backend/tests/test_square_sync_wired.py
git commit -m "feat: Square sync - retry, health checks, encrypted token decrypt, error logging"
```

---

## Task 9: Wire Predictions Engine to Retry + Health + PII

**Files:**
- Modify: `backend/app/predictions/engine.py`
- Test: `backend/tests/test_predictions_wired.py`

- [ ] **Step 1: Write failing tests for wired predictions behavior**

Create `backend/tests/test_predictions_wired.py`:
```python
import uuid
import json
from unittest.mock import patch, MagicMock
from app.models.user import User
from app.models.customer import Customer
from app.models.customer_health import CustomerHealth
from app.models.error_log import ErrorLog
from app.core.pii import strip_pii
from app.predictions.engine import _build_prompt


def _make_customer(db):
    u = User(email=f"{uuid.uuid4().hex}@t.com", hashed_password="x", business_name="B")
    db.add(u)
    db.commit()
    c = Customer(
        user_id=u.id,
        square_customer_id=uuid.uuid4().hex,
        given_name="RealName",
        family_name="RealFamily",
        email="real@email.com",
        total_visits=5,
        total_spent=200.0,
    )
    db.add(c)
    db.commit()
    return c


def test_build_prompt_uses_anonymous_id_not_real_name():
    """strip_pii output → _build_prompt must never include the real customer name."""
    c = Customer(
        id=uuid.uuid4(),
        given_name="RealName",
        family_name="RealFamily",
        email="real@email.com",
        total_visits=5,
        total_spent=200.0,
    )
    customer_data = strip_pii(c)
    prompt = _build_prompt(customer_data, transactions=[], fallback=False)
    assert "RealName" not in prompt
    assert "RealFamily" not in prompt
    assert "real@email.com" not in prompt
    assert "Customer #" in prompt


def test_build_prompt_fallback_omits_transaction_list():
    """In fallback mode, prompt must use aggregate stats, not transaction history."""
    c = Customer(
        id=uuid.uuid4(),
        given_name="X",
        total_visits=10,
        total_spent=500.0,
    )
    customer_data = strip_pii(c)
    prompt = _build_prompt(customer_data, transactions=[], fallback=True)
    assert "avg_order_value" in prompt
    assert "Transaction history" not in prompt


def test_generate_prediction_logs_error_and_increments_health_on_failure(db):
    """When Anthropic raises, an ErrorLog row must be written and health counter incremented."""
    c = _make_customer(db)

    with patch("app.predictions.engine._call_anthropic", side_effect=Exception("anthropic down")):
        from app.predictions.engine import generate_prediction
        try:
            generate_prediction(c, db)
        except ValueError:
            pass  # expected

    row = db.query(ErrorLog).filter(
        ErrorLog.customer_id == c.id,
        ErrorLog.operation == "anthropic_prediction",
    ).first()
    assert row is not None

    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == c.id).first()
    assert health is not None
    assert health.prediction_fail_count == 1


def test_generate_prediction_uses_fallback_prompt_when_flagged(db):
    """When prediction_fallback=True, _build_prompt must be called with fallback=True."""
    c = _make_customer(db)
    health = CustomerHealth(customer_id=c.id, prediction_fallback=True, prediction_fail_count=3)
    db.add(health)
    db.commit()

    mock_response = {
        "churn_risk": "low", "churn_risk_score": 0.1,
        "predicted_next_visit_days": 7, "predicted_ltv": 300.0,
        "top_products": None, "insight_summary": "Good customer"
    }

    with patch("app.predictions.engine._call_anthropic", return_value=mock_response) as mock_call, \
         patch("app.predictions.engine._build_prompt", wraps=lambda data, txs, fallback: _build_prompt(data, txs, fallback)) as mock_prompt:
        from app.predictions.engine import generate_prediction
        generate_prediction(c, db)
        _, kwargs = mock_prompt.call_args
        assert kwargs.get("fallback") is True or mock_prompt.call_args[0][2] is True
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_predictions_wired.py -v
```
Expected: FAIL — engine.py doesn't have retry/health/PII wiring yet.

- [ ] **Step 3: Replace `backend/app/predictions/engine.py`**

```python
import json
from datetime import datetime, timezone
from anthropic import Anthropic
from sqlalchemy.orm import Session
from app.config import settings
from app.models.customer import Customer
from app.models.transaction import Transaction
from app.models.prediction import Prediction
from app.models.customer_health import CustomerHealth
from app.core.retry import anthropic_retry
from app.core.errors import log_error, resolve_errors
from app.core.health import on_prediction_failure, on_prediction_success
from app.core.pii import strip_pii

anthropic = Anthropic(api_key=settings.anthropic_api_key)


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0]
    return text.strip()


def _build_prompt(customer_data: dict, transactions: list, fallback: bool) -> str:
    """Build the Anthropic prompt using anonymized customer_data from strip_pii().
    customer_data MUST come from strip_pii() — never pass a raw Customer object here.
    When fallback=True, omit transaction list (used when full history causes failures)."""
    days_since_last = None
    if customer_data.get("last_visit_at"):
        days_since_last = (datetime.now(timezone.utc) - customer_data["last_visit_at"]).days

    if fallback:
        avg_order = (customer_data["total_spent"] / customer_data["total_visits"]
                     if customer_data["total_visits"] else 0)
        history_section = (
            f"avg_order_value: ${avg_order:.2f}\n"
            f"days_since_last_visit: {days_since_last}"
        )
    else:
        tx_list = "\n".join(
            f"- {t.transacted_at.strftime('%Y-%m-%d')}: ${t.amount:.2f}, items: {json.dumps(t.items or [])}"
            for t in sorted(transactions, key=lambda x: x.transacted_at)
        )
        history_section = tx_list if tx_list else "No transactions yet"

    return f"""You are a customer analytics AI for small businesses. Analyze this customer's purchase history and return a JSON prediction.

Customer ID: {customer_data['id']}
Total visits: {customer_data['total_visits']}
Total spent: ${customer_data['total_spent']:.2f}
First visit: {customer_data['first_visit_at']}
Last visit: {customer_data['last_visit_at']}
Days since last visit: {days_since_last}

Transaction history:
{history_section}

Return ONLY valid JSON with these exact keys:
{{
  "churn_risk": "low" | "medium" | "high",
  "churn_risk_score": 0.0 to 1.0,
  "predicted_next_visit_days": number or null,
  "predicted_ltv": number in dollars or null,
  "top_products": "comma-separated product names" or null,
  "insight_summary": "1-2 sentence human-readable insight"
}}"""


@anthropic_retry
def _call_anthropic(prompt: str) -> dict:
    message = anthropic.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = _strip_fences(message.content[0].text)
    return json.loads(raw)


def generate_prediction(customer: Customer, db: Session) -> Prediction:
    transactions = db.query(Transaction).filter(Transaction.customer_id == customer.id).all()
    customer_data = strip_pii(customer)  # anonymize before sending to Anthropic

    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == customer.id).first()
    use_fallback = bool(health and health.prediction_fallback)

    prompt = _build_prompt(customer_data, transactions, fallback=use_fallback)

    try:
        data = _call_anthropic(prompt)
    except Exception as e:
        on_prediction_failure(db, customer.id)
        log_error(db, "anthropic_prediction", e, customer_id=customer.id)
        raise ValueError(f"AI prediction failed: {e}")

    pred = db.query(Prediction).filter(Prediction.customer_id == customer.id).first()
    if not pred:
        pred = Prediction(customer_id=customer.id)
        db.add(pred)

    pred.churn_risk = data["churn_risk"]
    pred.churn_risk_score = float(data["churn_risk_score"])
    pred.predicted_next_visit_days = data.get("predicted_next_visit_days")
    pred.predicted_ltv = data.get("predicted_ltv")
    pred.top_products = data.get("top_products")
    pred.insight_summary = data.get("insight_summary")
    pred.generated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pred)

    on_prediction_success(db, customer.id)
    resolve_errors(db, "anthropic_prediction", customer_id=customer.id)
    return pred
```

- [ ] **Step 4: Run all prediction tests — verify they pass**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_predictions.py tests/test_predictions_wired.py -v
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Owner/customer-intelligence
git add backend/app/predictions/engine.py backend/tests/test_predictions_wired.py
git commit -m "feat: predictions - anthropic retry, PII stripping, health fallback, error logging"
```

---

## Task 10: SMTP Alerting

**Files:**
- Create: `backend/app/alerts/__init__.py`
- Create: `backend/app/alerts/smtp.py`
- Create: `backend/app/alerts/checker.py`
- Modify: `backend/app/predictions/scheduler.py`
- Test: `backend/tests/test_alerts.py`

- [ ] **Step 1: Create `backend/app/alerts/__init__.py`** (empty package marker)

Create an empty file at `backend/app/alerts/__init__.py`.

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -c "import app.alerts; print('alerts package OK')"
```
Expected: `alerts package OK`

- [ ] **Step 2: Write failing alert tests**

Create `backend/tests/test_alerts.py`:
```python
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
    """If any row in the batch already has alert_sent=True, skip this incident (spec deduplication)."""
    user = _make_user(db)
    rows = _add_sync_errors(db, user.id, 3)
    rows[0].alert_sent = True  # simulate prior alert
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
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_alerts.py -v
```
Expected: FAIL — modules not found.

- [ ] **Step 4: Create `backend/app/alerts/smtp.py`**

```python
import smtplib
import logging
from email.mime.text import MIMEText
from app.config import settings

logger = logging.getLogger(__name__)


def send_alert(subject: str, body: str) -> None:
    """Send a critical alert email. Silently skips if SMTP is not configured."""
    if not settings.smtp_user or not settings.alert_email_to:
        logger.warning("Alert skipped — SMTP not configured. Subject: %s", subject)
        return
    try:
        msg = MIMEText(body)
        msg["Subject"] = f"[CIP Alert] {subject}"
        msg["From"] = settings.smtp_user
        msg["To"] = settings.alert_email_to
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        logger.info("Alert sent: %s", subject)
    except Exception as e:
        logger.error("Failed to send alert email: %s", e)
```

- [ ] **Step 5: Create `backend/app/alerts/checker.py`**

```python
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models.error_log import ErrorLog
from app.models.user import User
from app.alerts.smtp import send_alert
import logging

logger = logging.getLogger(__name__)

ONE_HOUR = timedelta(hours=1)


def _format_time(dt) -> str:
    return dt.strftime("%Y-%m-%d %H:%M UTC") if dt else "unknown"


def check_and_alert(db: Session) -> None:
    """Run all three critical alert patterns. Called hourly by APScheduler."""
    _check_repeated_sync_failures(db)
    _check_nightly_sync_broken(db)
    _check_anthropic_degraded(db)


def _check_repeated_sync_failures(db: Session) -> None:
    """Alert if any user has 3+ unresolved square_sync errors in the last hour.
    Skip if any row in the batch already has alert_sent=True (deduplication — already alerted for this incident)."""
    since = datetime.now(timezone.utc) - ONE_HOUR
    rows = db.query(ErrorLog).filter(
        ErrorLog.operation == "square_sync",
        ErrorLog.resolved == False,
        ErrorLog.created_at >= since,
    ).all()

    by_user: dict = {}
    for row in rows:
        if row.user_id:
            by_user.setdefault(str(row.user_id), []).append(row)

    for user_id, errors in by_user.items():
        # Deduplication: if any row was already alerted, this incident was already reported
        if any(e.alert_sent for e in errors):
            continue
        if len(errors) >= 3:
            user = db.query(User).filter(User.id == user_id).first()
            business = user.business_name if user else user_id
            last_err = max(e.created_at for e in errors)
            body = (
                f"{len(errors)} unresolved Square sync errors in the last hour.\n"
                f"Last error: {errors[-1].error_message}\n"
                f"Time: {_format_time(last_err)}\n\n"
                f"Review error logs at: http://localhost:8000/docs"
            )
            send_alert(f"Square sync failing for {business}", body)
            for e in errors:
                e.alert_sent = True
    db.commit()


def _check_nightly_sync_broken(db: Session) -> None:
    """Alert if a user has unresolved square_sync errors spanning 2+ hours (consecutive nightly failures).
    Skip if any row in the batch already has alert_sent=True (deduplication)."""
    since = datetime.now(timezone.utc) - timedelta(hours=26)
    rows = db.query(ErrorLog).filter(
        ErrorLog.operation == "square_sync",
        ErrorLog.resolved == False,
        ErrorLog.created_at >= since,
    ).order_by(ErrorLog.created_at).all()

    by_user: dict = {}
    for row in rows:
        if row.user_id:
            by_user.setdefault(str(row.user_id), []).append(row)

    for user_id, errors in by_user.items():
        if any(e.alert_sent for e in errors):
            continue
        if len(errors) >= 2:
            first_err = errors[0].created_at
            last_err = errors[-1].created_at
            if (last_err - first_err) >= timedelta(hours=2):
                user = db.query(User).filter(User.id == user_id).first()
                business = user.business_name if user else user_id
                body = (
                    f"Square sync has been failing since {_format_time(first_err)}.\n"
                    f"Last error: {errors[-1].error_message}\n\n"
                    f"Review error logs at: http://localhost:8000/docs"
                )
                send_alert(f"Nightly sync broken for {business}", body)
                for e in errors:
                    e.alert_sent = True
    db.commit()


def _check_anthropic_degraded(db: Session) -> None:
    """Alert if 50%+ of anthropic_prediction errors in last hour vs total predictions attempted.
    Skip if any error row in the batch already has alert_sent=True (deduplication)."""
    since = datetime.now(timezone.utc) - ONE_HOUR
    error_rows = db.query(ErrorLog).filter(
        ErrorLog.operation == "anthropic_prediction",
        ErrorLog.resolved == False,
        ErrorLog.created_at >= since,
    ).all()

    if len(error_rows) < 5:
        return  # not enough data to conclude degradation

    # Deduplication: if any row was already alerted, this incident was already reported
    if any(e.alert_sent for e in error_rows):
        return

    from app.models.prediction import Prediction
    recent_predictions = db.query(Prediction).filter(
        Prediction.generated_at >= since,
    ).count()

    total = recent_predictions + len(error_rows)
    if total > 0 and (len(error_rows) / total) >= 0.5:
        body = (
            f"{len(error_rows)} of {total} AI predictions failed in the last hour.\n"
            f"Anthropic may be experiencing issues.\n\n"
            f"Review error logs at: http://localhost:8000/docs"
        )
        send_alert("AI predictions degraded — Anthropic may be down", body)
        for e in error_rows:
            e.alert_sent = True
        db.commit()
```

- [ ] **Step 6: Update `backend/app/predictions/scheduler.py`** — add hourly alert job

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.models.customer import Customer
from app.square.sync import sync_customers, sync_transactions
from app.predictions.engine import generate_prediction
from app.alerts.checker import check_and_alert
import logging

logger = logging.getLogger(__name__)


def nightly_job():
    """Sync Square data and refresh predictions for all connected users."""
    db: Session = SessionLocal()
    try:
        users = db.query(User).filter(User.square_access_token != None).all()
        for user in users:
            try:
                sync_customers(user, db)
                sync_transactions(user, db)
                customers = db.query(Customer).filter(Customer.user_id == user.id).all()
                for customer in customers:
                    try:
                        generate_prediction(customer, db)
                    except Exception as e:
                        logger.error("Prediction failed for customer %s: %s", customer.id, e)
                logger.info("Nightly job complete for %s", user.email)
            except Exception as e:
                logger.error("Nightly job failed for %s: %s", user.email, e)
    finally:
        db.close()


def hourly_alert_job():
    """Check error_logs for critical patterns and send SMTP alerts."""
    db: Session = SessionLocal()
    try:
        check_and_alert(db)
    except Exception as e:
        logger.error("Alert checker failed: %s", e)
    finally:
        db.close()


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(nightly_job, CronTrigger(hour=2, minute=0))
    scheduler.add_job(hourly_alert_job, IntervalTrigger(hours=1))
    scheduler.start()
    return scheduler
```

- [ ] **Step 7: Run alert tests — verify they pass**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/test_alerts.py -v
```
Expected: All 7 tests PASS.

- [ ] **Step 8: Commit**

```bash
cd /c/Users/Owner/customer-intelligence
git add backend/app/alerts/ backend/app/predictions/scheduler.py backend/tests/test_alerts.py
git commit -m "feat: SMTP alerting with 3 critical patterns + hourly APScheduler job"
```

---

## Task 11: Run Full Test Suite

- [ ] **Step 1: Run all backend tests**

```bash
cd /c/Users/Owner/customer-intelligence/backend && python -m pytest tests/ -v
```
Expected: All tests PASS. Note the count — should include tests from:
- `test_models.py`
- `test_new_models.py`
- `test_auth.py`
- `test_square_sync.py`
- `test_square_sync_wired.py`
- `test_predictions.py`
- `test_predictions_wired.py`
- `test_dashboard.py`
- `test_error_handling.py`
- `test_security.py`
- `test_health.py`
- `test_alerts.py`

- [ ] **Step 2: Start the full stack and do a smoke test**

Terminal 1:
```bash
cd /c/Users/Owner/customer-intelligence && docker-compose up -d
```

Terminal 2:
```bash
cd /c/Users/Owner/customer-intelligence/backend && uvicorn app.main:app --reload
```

Visit `http://localhost:8000/health` — should return `{"status": "ok"}`.

Check security headers are present:
```bash
curl -I http://localhost:8000/health
```
Expected: Response includes `x-frame-options: DENY` and `x-content-type-options: nosniff`.

- [ ] **Step 3: Final commit**

> **Note:** `.env` must be in `.gitignore` — never commit it. The `ENCRYPTION_KEY` it contains is a secret.

```bash
cd /c/Users/Owner/customer-intelligence
git add backend/app/ backend/tests/ backend/alembic/
git commit -m "chore: final wiring - error handling, self-healing, and security complete"
```
