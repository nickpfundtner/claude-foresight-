# Error Handling, Self-Healing & Security — Design Spec

**Date:** 2026-03-19
**Project:** Customer Intelligence Platform
**Status:** Approved

---

## Goal

Add three interlocking layers to the Customer Intelligence Platform:

1. **Smart error handling** — retry transient failures automatically, log all unrecoverable failures with full context
2. **Self-healing behavior** — track per-customer failure history and adapt future behavior (skip, fallback prompt, gradual trust rebuild)
3. **Top-tier security** — encrypt sensitive data at rest, rate-limit auth endpoints, strip PII before sending to Anthropic, add security headers

---

## Architecture Overview

All three layers bolt onto the existing FastAPI + PostgreSQL + APScheduler stack. No new infrastructure is required. Two new DB tables are added (`error_logs`, `customer_health`). New modules added under `core/` and `alerts/`. One new APScheduler job handles alerting.

```
Request → Security Middleware (rate limit, headers)
        → Route Handler
        → core/retry.py wraps external API calls (Square, Anthropic)
              → on failure: core/errors.py logs to error_logs table
              → core/health.py updates CustomerHealth (fail counts, flags)
        → core/pii.py strips PII before Anthropic prompt
        → APScheduler: hourly alert checker queries error_logs → SMTP email
```

---

## Section 1: New Database Tables

### `error_logs`

Tracks every unrecoverable error (all retries exhausted) with full context.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | nullable |
| `customer_id` | UUID FK → customers | nullable |
| `operation` | String | `"square_sync"`, `"anthropic_prediction"`, `"auth_login"` |
| `error_message` | Text | raw exception message |
| `error_code` | String | nullable — HTTP status or custom code |
| `context` | JSON | nullable — extra context dict (e.g., `{"email": "user@x.com"}` for auth failures) |
| `resolved` | Boolean | default False; set True when next attempt succeeds |
| `alert_sent` | Boolean | default False; prevents duplicate alerts; reset to False when `resolved` is set |
| `created_at` | DateTime(tz) | |

> **Note on `context` column:** Used specifically for `auth_login` failures to store `{"email": "attempted@email.com"}` since `user_id` is null for failed logins against nonexistent accounts. The brute force lockout query filters by `context->>'email'` (PostgreSQL JSON operator).

### `customer_health`

Tracks per-customer failure counts and adaptive flags.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `customer_id` | UUID FK → customers | unique |
| `sync_fail_count` | Integer | default 0 |
| `sync_skip` | Boolean | default False; set True at 3rd sync failure |
| `sync_skip_until` | DateTime(tz) | nullable; now + 7 days when skipped |
| `prediction_fail_count` | Integer | default 0 |
| `prediction_fallback` | Boolean | default False; set True at 3rd prediction failure |
| `last_error_at` | DateTime(tz) | nullable |
| `updated_at` | DateTime(tz) | `onupdate=func.now()` — auto-updated on every change |

> **Note:** `customer_health` has no `user_id` column. To query health for a specific user's customers, JOIN through `customers`: `JOIN customers ON customer_health.customer_id = customers.id WHERE customers.user_id = :user_id`.

### Alembic Migration

After creating both model files, run:

```bash
cd backend
alembic revision --autogenerate -m "add error_logs and customer_health tables"
alembic upgrade head
```

---

## Section 2: Error Handling

### Typed Square Exception (`backend/app/square/client.py`)

The Square SDK raises plain `Exception` strings with no `status_code` attribute, making the retry filter unable to distinguish a retryable 503 from a permanent 401. Fix: wrap Square API results in a typed exception before raising.

```python
class SquareAPIError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code

def raise_square_error(errors: list):
    """Convert Square error list into a typed exception with status_code."""
    code = errors[0].get("code", "") if errors else ""
    # permanent failures — do not retry
    if code in ("UNAUTHORIZED", "ACCESS_TOKEN_EXPIRED", "FORBIDDEN"):
        raise SquareAPIError(str(errors), status_code=401)
    if code in ("NOT_FOUND",):
        raise SquareAPIError(str(errors), status_code=404)
    # transient — retry
    raise SquareAPIError(str(errors), status_code=503)
```

All calls in `sync.py` that currently do `raise Exception(f"Square error: {result.errors}")` must be updated to call `raise_square_error(result.errors)` instead.

### Retry Logic (`backend/app/core/retry.py`)

Uses `tenacity` to wrap all external API calls.

**Retry policy:**
- Max 3 attempts
- Exponential backoff: 1s → 2s → 4s between attempts
- Retries on: network errors, timeouts, HTTP 429 (rate limit), HTTP 500/502/503/504
- Does NOT retry on: HTTP 401 (bad credentials), HTTP 404 (not found), HTTP 400 (bad request) — permanent failures

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

RETRYABLE_CODES = {429, 500, 502, 503, 504}

def is_retryable(exc):
    if hasattr(exc, "status_code"):
        return exc.status_code in RETRYABLE_CODES
    return True  # plain network errors always retryable

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

### Error Logging (`backend/app/core/errors.py`)

A single `log_error()` function called in every except block. `resolve_errors()` marks prior errors resolved AND resets `alert_sent=False` so re-alerting works correctly after recovery.

```python
def log_error(db, operation, error, user_id=None, customer_id=None, context=None):
    db.add(ErrorLog(
        user_id=user_id,
        customer_id=customer_id,
        operation=operation,
        error_message=str(error),
        error_code=getattr(error, "status_code", None),
        context=context,  # e.g. {"email": "user@x.com"} for auth failures
    ))
    db.commit()

def resolve_errors(db, operation, user_id=None, customer_id=None):
    """Mark prior errors resolved on success. Also resets alert_sent so
    future errors for this operation can trigger new alerts."""
    query = db.query(ErrorLog).filter(
        ErrorLog.operation == operation,
        ErrorLog.resolved == False,
    )
    if user_id:
        query = query.filter(ErrorLog.user_id == user_id)
    if customer_id:
        query = query.filter(ErrorLog.customer_id == customer_id)
    query.update({"resolved": True, "alert_sent": False})  # reset both
    db.commit()
```

### Global FastAPI Exception Handler

Registered in `main.py`. Returns consistent JSON for all unhandled exceptions — never raw Python tracebacks:

```json
{
  "error": "internal_server_error",
  "message": "Something went wrong. Our team has been notified.",
  "code": 500
}
```

Auth errors (401), validation errors (422), and 404s also return structured responses.

---

## Section 3: Self-Healing (CustomerHealth)

### Rules Engine (`backend/app/core/health.py`)

Evaluated after every sync and prediction attempt.

**On failure:**
1. Get or create `CustomerHealth` row for the customer
2. Increment `sync_fail_count` or `prediction_fail_count`
3. Set `last_error_at = now()`
4. If `sync_fail_count >= 3`: set `sync_skip=True`, `sync_skip_until = now() + 7 days`
5. If `prediction_fail_count >= 3`: set `prediction_fallback=True`

**On success:**
1. Decrement fail count by 1 (min 0) — gradual trust rebuild, not instant reset
2. If `sync_fail_count == 0`: clear `sync_skip=False`, clear `sync_skip_until=None`
3. If `prediction_fail_count == 0`: clear `prediction_fallback=False`

**Auto-reset check (runs at start of each nightly sync):**
- If `sync_skip=True` and `sync_skip_until < now()`: set `sync_skip=False`, `sync_fail_count=0`

### Fallback Prompt

When `prediction_fallback=True`, the AI prompt switches to aggregate-only data.

**Normal prompt includes:** full transaction list + dates + item names + totals + customer name line

**Fallback prompt includes:** `total_visits`, `total_spent`, `avg_order_value`, `days_since_last_visit` — no transaction list

> **Important:** The existing `_build_prompt` in `predictions/engine.py` currently includes the line:
> `Customer: {customer.given_name or ''} {customer.family_name or ''}`
> This line **must be removed** when PII stripping is applied (Section 4.4). The fallback prompt must also never include this line. The `_build_prompt` function will be rewritten to accept the anonymized dict from `strip_pii()` instead of the raw `Customer` object.

---

## Section 4: Security

### 4.1 Fernet Encryption for Square Tokens

**Module:** `backend/app/core/security.py`

Square access tokens encrypted before writing to DB, decrypted only at sync time in memory.

```python
from cryptography.fernet import Fernet

def get_fernet():
    key = settings.encryption_key.encode()
    return Fernet(key)

def encrypt_token(token: str) -> str:
    return get_fernet().encrypt(token.encode()).decode()

def decrypt_token(ciphertext: str) -> str:
    return get_fernet().decrypt(ciphertext.encode()).decode()
```

**Key management:**
- `ENCRYPTION_KEY` in `.env` only — never in DB, never logged
- Generated once: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- If key is lost, Square tokens must be re-entered by each business owner

**Flow:**
- `POST /square/connect` → `encrypt_token(body.access_token)` → store ciphertext in DB
- `sync_customers()` / `sync_transactions()` → `decrypt_token(user.square_access_token)` → pass to Square SDK → discard

### 4.2 Rate Limiting (`slowapi`)

Applied via `slowapi` in `main.py`:

| Endpoint | Limit | Scope |
|---|---|---|
| `POST /auth/login` | 5/minute | per IP |
| `POST /auth/register` | 3/minute | per IP |
| All other endpoints | 60/minute | per user (JWT sub) |

Rate limit exceeded → HTTP 429 with `Retry-After` header.

### 4.3 Brute Force Lockout

Tracked via `error_logs.context` JSON column — no Redis needed.

**On failed login:**
```python
log_error(db, "auth_login", exc, user_id=user.id if user else None,
          context={"email": body.email})
```

**At each login attempt, before checking password:**
```python
# count failed attempts for this email in last 15 min using JSON operator
recent_failures = db.query(ErrorLog).filter(
    ErrorLog.operation == "auth_login",
    ErrorLog.resolved == False,
    ErrorLog.context["email"].astext == body.email,
    ErrorLog.created_at >= datetime.now(timezone.utc) - timedelta(minutes=15),
).count()
if recent_failures >= 10:
    raise HTTPException(429, "Account temporarily locked. Try again in 15 minutes.")
```

**On successful login**, resolve by both `user_id` (for existing-account failures) AND by `email` via `context` (for pre-auth nonexistent-account failures). Both calls are needed — orphaned rows with `user_id=NULL` only clear via the email path:

```python
resolve_errors(db, "auth_login", user_id=user.id)
resolve_errors_by_email(db, "auth_login", email=body.email)
```

Add `resolve_errors_by_email()` to `core/errors.py`:

```python
def resolve_errors_by_email(db, operation: str, email: str):
    """Resolve auth_login failures logged before the user existed (user_id=NULL).
    These rows are only queryable by context['email']."""
    db.query(ErrorLog).filter(
        ErrorLog.operation == operation,
        ErrorLog.resolved == False,
        ErrorLog.context["email"].astext == email,
    ).update({"resolved": True, "alert_sent": False}, synchronize_session=False)
    db.commit()
```

### 4.4 PII Stripping Before Anthropic (`backend/app/core/pii.py`)

Returns anonymized dict — **replaces** the raw `Customer` object in all Anthropic prompt construction.

```python
def strip_pii(customer: Customer) -> dict:
    return {
        "id": f"Customer #{abs(hash(str(customer.id))) % 10000}",
        "total_visits": customer.total_visits,
        "total_spent": customer.total_spent,
        "first_visit_at": customer.first_visit_at,
        "last_visit_at": customer.last_visit_at,
        # given_name, family_name, email, phone — NEVER sent to Anthropic
    }
```

**`_build_prompt` rewrite rule:** The function signature changes from `_build_prompt(customer: Customer, ...)` to `_build_prompt(customer_data: dict, ...)`. The `customer_data` argument is always the output of `strip_pii()`. The line `Customer: {customer.given_name} {customer.family_name}` is **removed entirely** and replaced with `Customer ID: {customer_data['id']}`.

Item names from transactions ARE sent (e.g., "Coffee", "Muffin") — behavioral data, not identity.

### 4.5 Security Headers Middleware

```python
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response
```

### 4.6 Password Strength Validation

In `auth/schemas.py` via Pydantic `field_validator`:
- Minimum 8 characters
- At least one digit
- Returns clear error: `"Password must be at least 8 characters and contain at least one number"`

### 4.7 New Config Fields (`backend/app/config.py`)

Add these fields to `Settings`:

```python
encryption_key: str                         # Fernet key for Square token encryption
alert_email_to: str = ""                    # recipient for critical alerts
smtp_host: str = "smtp.gmail.com"
smtp_port: int = 587
smtp_user: str = ""
smtp_password: str = ""
```

And add to `.env.example`:
```
ENCRYPTION_KEY=                             # generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ALERT_EMAIL_TO=you@youremail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourapp@gmail.com
SMTP_PASSWORD=your_app_password
```

---

## Section 5: Alerting

### Alert Checker Job

Runs **hourly** inside APScheduler. All three patterns query only `error_logs`. The "nightly sync broken" pattern identifies the user via `error_logs.user_id` (not via `customer_health`) and JOINs `users` to get `business_name` for the email subject.

| Pattern | Query | Alert message |
|---|---|---|
| 3+ unresolved errors for same `user_id` + `operation` in last 1 hour | `error_logs` grouped by `user_id, operation` | "Square sync failing repeatedly for [business_name]" |
| Same `user_id` has unresolved `square_sync` errors on 2 consecutive nightly runs | `error_logs WHERE operation='square_sync' AND resolved=False` ordered by time | "Nightly sync broken for [business_name]" |
| Count of unresolved `anthropic_prediction` errors in last batch ≥ 50% of total predictions attempted | `error_logs` count vs scheduler batch size | "AI predictions degraded — Anthropic may be down" |

**Deduplication:** Before sending, check that no row in the matching error batch has `alert_sent=True`. If any do, skip. After sending, set `alert_sent=True` on all matching rows. When `resolve_errors()` runs, it resets `alert_sent=False` — so future errors for the same pattern can trigger a new alert.

**SMTP sent via `smtplib`** (Python built-in — no extra package needed):

```python
import smtplib
from email.mime.text import MIMEText

def send_alert(subject: str, body: str):
    if not settings.smtp_user or not settings.alert_email_to:
        return  # alerting not configured, skip silently
    msg = MIMEText(body)
    msg["Subject"] = f"[CIP Alert] {subject}"
    msg["From"] = settings.smtp_user
    msg["To"] = settings.alert_email_to
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
```

**Email format:**
```
Subject: [CIP Alert] Square sync failing for Joe's Coffee Shop

3 unresolved Square sync errors in the last hour.
Last error: Invalid access token
Time: 2026-03-19 14:32 UTC

Review error logs at: http://localhost:8000/docs#/errors
```

---

## New Files

| File | Responsibility |
|---|---|
| `backend/app/core/__init__.py` | Package marker |
| `backend/app/core/retry.py` | tenacity retry decorators for Square + Anthropic |
| `backend/app/core/errors.py` | `log_error()`, `resolve_errors()`, `resolve_errors_by_email()`, global exception handler |
| `backend/app/core/security.py` | Fernet encrypt/decrypt for Square tokens |
| `backend/app/core/pii.py` | `strip_pii()` — anonymize customer before Anthropic prompt |
| `backend/app/core/health.py` | CustomerHealth rules engine (on_failure, on_success, auto_reset) |
| `backend/app/models/error_log.py` | `ErrorLog` SQLAlchemy model |
| `backend/app/models/customer_health.py` | `CustomerHealth` SQLAlchemy model |
| `backend/app/alerts/__init__.py` | Package marker |
| `backend/app/alerts/smtp.py` | `send_alert()` via Python smtplib |
| `backend/app/alerts/checker.py` | Hourly alert pattern queries against `error_logs` |
| `backend/tests/test_error_handling.py` | Tests for retry, logging, resolution |
| `backend/tests/test_security.py` | Tests for encryption, PII stripping, rate limits |
| `backend/tests/test_health.py` | Tests for CustomerHealth rules engine |

## Modified Files

| File | Change |
|---|---|
| `backend/requirements.txt` | Add `tenacity==8.3.0`, `slowapi==0.1.9`, `cryptography==42.0.5` |
| `backend/.env.example` | Add `ENCRYPTION_KEY`, SMTP fields |
| `backend/app/config.py` | Add `encryption_key`, `alert_email_to`, SMTP settings |
| `backend/app/main.py` | Register global exception handler, rate limiter, security headers middleware |
| `backend/app/square/client.py` | Add `SquareAPIError` typed exception + `raise_square_error()` |
| `backend/app/square/sync.py` | Use `raise_square_error()`, wrap with `square_retry`, call `log_error`/`resolve_errors`, check `CustomerHealth.sync_skip` |
| `backend/app/predictions/engine.py` | Wrap Anthropic call with `anthropic_retry`, rewrite `_build_prompt` to accept `strip_pii()` output (remove name line), use fallback prompt when `CustomerHealth.prediction_fallback=True` |
| `backend/app/auth/router.py` | Add brute force lockout check via `error_logs.context`, call `log_error` with `context={"email": body.email}` on failed logins |
| `backend/app/predictions/scheduler.py` | Add hourly alert checker job |
| `backend/app/models/__init__.py` | Import `ErrorLog`, `CustomerHealth` |

---

## Dependencies to Add

```
tenacity==8.3.0
slowapi==0.1.9
cryptography==42.0.5
```

SMTP uses Python's built-in `smtplib` — no additional package needed.

---

## Testing Strategy

**Error handling tests (`test_error_handling.py`):**
- Mock Square to raise `SquareAPIError(status_code=503)` → verify retry fires 3 times → verify `error_logs` row created
- Mock Square to raise `SquareAPIError(status_code=401)` → verify NO retry (permanent failure)
- Mock Square to succeed after prior failures → verify `resolved=True` and `alert_sent=False` set

**Security tests (`test_security.py`):**
- Encrypt a token → decrypt it → assert round-trip equality
- Send customer with name/email to `strip_pii` → assert neither `given_name` nor `email` appears in output dict
- Call `_build_prompt` with `strip_pii` output → assert "Customer #" format used, no real name present
- 10 failed login attempts for same email → assert 11th returns 429

**Health tests (`test_health.py`):**
- Call `on_failure` 3 times for a customer → assert `sync_skip=True`, `sync_skip_until` set
- Call `on_success` once → assert `sync_fail_count` decremented to 2, `sync_skip` still True
- Call `on_success` twice more → assert `sync_fail_count=0`, `sync_skip=False`
- Set `sync_skip_until` to past → call `auto_reset` → assert `sync_skip=False`, `sync_fail_count=0`

---

## Non-Goals (out of scope)

- Redis or external cache
- Sentry or third-party error tracking
- OAuth2 for Square (using manual access tokens)
- Frontend error dashboard (errors are backend-only for now)
- HSTS / Content-Security-Policy headers (deferred until HTTPS is configured)
