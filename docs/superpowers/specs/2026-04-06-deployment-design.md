# Deployment Design — Foresight

**Date:** 2026-04-06  
**Status:** Approved

---

## Overview

Deploy Foresight as a live web application using Vercel (frontend) + Railway (backend + PostgreSQL). Free Vercel subdomain for now; custom domain deferred until ready to share with real users.

---

## Architecture

```
User → foresight-xyz.vercel.app (Next.js on Vercel)
           ↓ NEXT_PUBLIC_API_URL
       foresight-api.railway.app (FastAPI on Railway)
           ↓ DATABASE_URL (auto-injected)
       PostgreSQL (Railway managed plugin)
```

---

## Services

### Frontend — Vercel (free)
- Connect GitHub repo to Vercel
- Root directory: `frontend/`
- Framework preset: Next.js
- Env var: `NEXT_PUBLIC_API_URL=https://<railway-backend-url>`
- Auto-deploys on every push to `main`

### Backend — Railway (~$5/mo, free trial)
- Connect same GitHub repo to Railway
- Root directory: `backend/`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Config via `railway.toml` in `backend/`
- Env vars set in Railway dashboard (see below)

### Database — Railway PostgreSQL plugin
- Add PostgreSQL plugin inside Railway project
- Railway auto-injects `DATABASE_URL` into backend service
- Run Alembic migrations once after first deploy: `alembic upgrade head`

---

## Environment Variables

### Backend (set in Railway dashboard)
| Variable | Value |
|---|---|
| `DATABASE_URL` | Auto-injected by Railway PostgreSQL plugin |
| `JWT_SECRET_KEY` | Long random string (generate fresh for prod) |
| `JWT_ALGORITHM` | `HS256` |
| `JWT_EXPIRE_DAYS` | `30` |
| `ANTHROPIC_API_KEY` | From Anthropic console |
| `SQUARE_ACCESS_TOKEN` | Leave empty for now (Square sync won't work until added) |
| `ENCRYPTION_KEY` | Generate with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `ALERT_EMAIL_TO` | Owner's email |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | App Gmail address |
| `SMTP_PASSWORD` | Gmail app password |

### Frontend (set in Vercel dashboard)
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Railway backend public URL |

---

## Code Changes Required

### 1. Add `railway.toml` to `backend/`
Tells Railway how to build and start the FastAPI app.

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
```

### 2. Add `/health` endpoint to FastAPI
Simple endpoint Railway uses to verify the service is running.

### 3. Update CORS in `backend/app/main.py`
Add the Vercel production URL to `allow_origins`. Use an env var so it's configurable without code changes:

```python
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
```

Set `ALLOWED_ORIGINS` in Railway dashboard to include the Vercel URL.

### 4. Verify `requirements.txt` is complete
Ensure all packages used in production are listed.

---

## Deployment Steps (high level)

1. Make code changes (railway.toml, health endpoint, CORS env var)
2. Push to GitHub
3. Create Railway project → connect repo → add PostgreSQL plugin → set env vars → deploy
4. Run `alembic upgrade head` via Railway shell
5. Create Vercel project → connect repo → set root dir + env var → deploy
6. Smoke test: register, login, view dashboard

---

## Out of Scope
- Custom domain (deferred — use free Vercel/Railway subdomains for now)
- Square integration (requires access token — connect later)
- Mobile app (separate future project)
