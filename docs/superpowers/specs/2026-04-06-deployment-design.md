# Deployment Design — Foresight

**Date:** 2026-04-06  
**Status:** Approved

---

## Overview

Deploy Foresight as a live web application using Vercel (frontend) + Railway (backend + PostgreSQL). Free Vercel subdomain for now; custom domain deferred until ready to share with real users.

Includes CI (GitHub Actions), error monitoring (Sentry), and uptime monitoring (BetterStack) for a production-grade setup from day one.

---

## Architecture

```
User → foresight-xyz.vercel.app (Next.js on Vercel)
           ↓ NEXT_PUBLIC_API_URL
       foresight-api.railway.app (FastAPI on Railway)
           ↓ DATABASE_URL (auto-injected)
       PostgreSQL (Railway managed plugin)

GitHub push → GitHub Actions CI (run tests) → Vercel + Railway auto-deploy
Sentry → catches errors in both frontend and backend
BetterStack → pings /health every 3 min, emails on downtime
```

---

## Services

### Frontend — Vercel (free)
- Connect GitHub repo to Vercel
- Root directory: `frontend/`
- Framework preset: Next.js
- Env vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SENTRY_DSN`
- Auto-deploys on every push to `main`
- **Preview deployments**: Vercel auto-creates a live preview URL for every PR — test before merging

### Backend — Railway (~$5/mo, free trial)
- Connect same GitHub repo to Railway
- Root directory: `backend/`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Config via `railway.toml` in `backend/`
- Alembic migrations run automatically on each deploy (via `railway.toml` deploy command)
- Env vars set in Railway dashboard (see below)

### Database — Railway PostgreSQL plugin
- Add PostgreSQL plugin inside Railway project
- Railway auto-injects `DATABASE_URL` into backend service
- Automatic daily backups included in Railway

### Error Monitoring — Sentry (free)
- Frontend: `@sentry/nextjs` captures unhandled errors + slow page loads
- Backend: `sentry-sdk` captures unhandled exceptions with full stack traces
- Free tier: 5,000 errors/month — more than enough for early stage
- Alerts sent to email on new errors

### Uptime Monitoring — BetterStack (free)
- Pings `/health` endpoint every 3 minutes
- Emails alert if site goes down
- Free tier covers everything needed at this stage

### CI — GitHub Actions
- Runs on every push and PR to `main`
- Runs all 43 backend tests (`pytest`)
- If tests fail, deploy is blocked (Railway won't deploy broken code)
- Frontend: `npm run build` check (catches type errors and build failures)

---

## Environment Variables

### Backend (set in Railway dashboard)
| Variable | Value |
|---|---|
| `DATABASE_URL` | Auto-injected by Railway PostgreSQL plugin |
| `JWT_SECRET_KEY` | Long random string — generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_ALGORITHM` | `HS256` |
| `JWT_EXPIRE_DAYS` | `30` |
| `ANTHROPIC_API_KEY` | From Anthropic console (same key used in Claude Code) |
| `SQUARE_ACCESS_TOKEN` | Leave empty for now — Square sync disabled until connected |
| `ENCRYPTION_KEY` | Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `ALLOWED_ORIGINS` | `https://foresight-xyz.vercel.app` (update after Vercel deploy) |
| `ALERT_EMAIL_TO` | Owner's email |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | App Gmail address |
| `SMTP_PASSWORD` | Gmail app password (generate at myaccount.google.com → Security → App Passwords) |
| `SENTRY_DSN` | From Sentry dashboard after creating project |
| `ENVIRONMENT` | `production` |

### Frontend (set in Vercel dashboard)
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Railway backend public URL |
| `NEXT_PUBLIC_SENTRY_DSN` | From Sentry dashboard (frontend project) |

---

## Code Changes Required

### 1. Split `requirements.txt` into prod + dev
`pytest`, `pytest-asyncio` belong in dev only — they shouldn't install in production.

- `requirements.txt` — prod dependencies only
- `requirements-dev.txt` — includes `-r requirements.txt` + pytest packages

### 2. Add `railway.toml` to `backend/`
Tells Railway how to build, migrate, and start the app.

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

### 3. Add `/health` endpoint to FastAPI
Railway and BetterStack use this to verify the service is alive.

```python
@app.get("/health")
def health():
    return {"status": "ok"}
```

### 4. Update CORS to use env var
Replace hardcoded localhost origins with an env var so production URLs can be added without code changes.

```python
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173"
).split(",")
```

### 5. Add Sentry to backend
Initialize in `main.py` before app startup, gated on `SENTRY_DSN` env var so local dev isn't affected.

```python
import sentry_sdk
if dsn := os.getenv("SENTRY_DSN"):
    sentry_sdk.init(dsn=dsn, environment=os.getenv("ENVIRONMENT", "development"))
```

### 6. Add Sentry to frontend
Run `npx @sentry/wizard@latest -i nextjs` — it auto-configures everything.

### 7. Add GitHub Actions CI workflow
`.github/workflows/ci.yml` — runs backend tests + frontend build check on every push.

---

## Deployment Steps (high level)

1. Make all code changes (railway.toml, health endpoint, CORS, Sentry, split requirements)
2. Push to GitHub — CI runs automatically
3. Create Sentry account → create two projects (Python + Next.js) → copy DSNs
4. Create Railway project → connect repo → add PostgreSQL plugin → set all env vars → deploy (migrations run automatically)
5. Create Vercel project → connect repo → set root dir + env vars → deploy
6. Update `ALLOWED_ORIGINS` in Railway with the actual Vercel URL
7. Set up BetterStack → add monitor pointing to Railway `/health` URL
8. Smoke test: register, login, view dashboard, trigger an error to verify Sentry catches it

---

## Out of Scope
- Custom domain (deferred — use free Vercel/Railway subdomains for now)
- Square integration (requires access token — connect later via dashboard)
- Mobile app (separate future project)
- Seed/demo data (add later when showing to potential customers)
