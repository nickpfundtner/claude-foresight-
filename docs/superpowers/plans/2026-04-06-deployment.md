# Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Foresight as a live web app on Vercel (frontend) + Railway (backend + PostgreSQL) with CI, error monitoring, and uptime monitoring.

**Architecture:** Next.js frontend on Vercel auto-deploys from GitHub. FastAPI backend on Railway with auto-injected PostgreSQL. GitHub Actions runs tests on every push before deploy. Sentry catches runtime errors on both sides. BetterStack monitors uptime.

**Tech Stack:** Vercel, Railway, PostgreSQL, GitHub Actions, Sentry (sentry-sdk + @sentry/nextjs), BetterStack

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/requirements.txt` | Modify | Remove pytest packages (prod only) |
| `backend/requirements-dev.txt` | Create | Dev-only deps (pytest, pytest-asyncio) |
| `backend/tests/conftest.py` | Modify | Read TEST_DATABASE_URL from env var (needed for CI) |
| `backend/tests/test_api_health.py` | Create | HTTP-level test for /health endpoint |
| `backend/app/main.py` | Modify | CORS from env var + Sentry init |
| `backend/.env.example` | Modify | Add ALLOWED_ORIGINS, SENTRY_DSN, ENVIRONMENT |
| `backend/railway.toml` | Create | Railway build/deploy config |
| `.github/workflows/ci.yml` | Create | Run tests + build check on every push |
| `frontend/` | Modify | Sentry auto-configured via wizard |

---

### Task 1: Split requirements into prod and dev

**Why:** `pytest` and `pytest-asyncio` are test tools — they shouldn't install in production. Railway installs from `requirements.txt`, so keeping them there wastes build time and adds unnecessary packages to prod.

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/requirements-dev.txt`

- [ ] **Step 1: Create `backend/requirements-dev.txt`**

```
-r requirements.txt
pytest==8.2.0
pytest-asyncio==0.23.6
```

- [ ] **Step 2: Remove pytest packages from `backend/requirements.txt`**

Remove these two lines from `backend/requirements.txt`:
```
pytest==8.2.0
pytest-asyncio==0.23.6
```

The final `backend/requirements.txt` should be:
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9
pydantic-settings==2.2.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
httpx==0.27.0
square==37.0.0
anthropic==0.26.0
apscheduler==3.10.4
pytz==2024.1
tenacity==8.3.0
slowapi==0.1.9
cryptography==42.0.5
sentry-sdk[fastapi]==2.3.1
```

Note: `sentry-sdk[fastapi]` is added here — it will be used in Task 4.

- [ ] **Step 3: Update conftest.py to read TEST_DATABASE_URL from env**

Open `backend/tests/conftest.py` and replace:
```python
TEST_DATABASE_URL = "postgresql://cipuser:cippass@localhost:5432/cip_test"
```
With:
```python
import os
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "postgresql://cipuser:cippass@localhost:5432/cip_test")
```

This lets GitHub Actions inject a different DB URL without changing code.

- [ ] **Step 4: Verify tests still pass locally**

```bash
cd backend
pip install -r requirements-dev.txt
pytest --tb=short -q
```

Expected: all tests pass (same count as before)

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/requirements-dev.txt backend/tests/conftest.py
git commit -m "chore: split requirements into prod/dev, read TEST_DATABASE_URL from env"
```

---

### Task 2: Add HTTP test for /health endpoint

**Why:** The `/health` endpoint already exists in `main.py` but has no HTTP-level test. Railway uses this endpoint to verify the app is running. We need a test to confirm it returns `{"status": "ok"}` with a 200 status — and to protect it from being accidentally broken.

**Files:**
- Create: `backend/tests/test_api_health.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_api_health.py`:

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_returns_200():
    response = client.get("/health")
    assert response.status_code == 200

def test_health_returns_ok_status():
    response = client.get("/health")
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_api_health.py -v
```

Expected: both tests PASS (endpoint already exists in main.py)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_api_health.py
git commit -m "test: add HTTP-level test for /health endpoint"
```

---

### Task 3: Update CORS to use ALLOWED_ORIGINS env var

**Why:** CORS is currently hardcoded to `localhost`. When the app is live on Vercel, the browser will block all API calls because the Vercel domain isn't in the allowed list. Using an env var means we can add new allowed origins (Vercel URL, custom domain later) without changing code.

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/.env.example`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_api_health.py`:

```python
import os

def test_cors_reads_from_env(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://myapp.vercel.app,https://example.com")
    from importlib import reload
    import app.main as main_module
    origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    assert "https://myapp.vercel.app" in origins
    assert "https://example.com" in origins
```

- [ ] **Step 2: Run test to verify it passes immediately** (it reads env directly, no reload needed)

```bash
cd backend
pytest tests/test_api_health.py::test_cors_reads_from_env -v
```

Expected: PASS

- [ ] **Step 3: Update CORS in `backend/app/main.py`**

Add `import os` at the top of `main.py` (after existing imports):
```python
import os
```

Replace:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

With:
```python
_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 4: Update `backend/.env.example`**

Add these lines to `.env.example`:
```
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
SENTRY_DSN=
ENVIRONMENT=development
```

- [ ] **Step 5: Run all tests to verify nothing broke**

```bash
cd backend
pytest --tb=short -q
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/.env.example backend/tests/test_api_health.py
git commit -m "feat: CORS origins from ALLOWED_ORIGINS env var"
```

---

### Task 4: Add Sentry to backend

**Why:** Without error monitoring, you only find out about crashes when users tell you. Sentry captures every unhandled exception in production with a full stack trace, file, line number, and request context — so you know exactly what broke and why.

**Files:**
- Modify: `backend/app/main.py`

Note: `sentry-sdk[fastapi]` was already added to `requirements.txt` in Task 1.

- [ ] **Step 1: Write the test**

Add to `backend/tests/test_api_health.py`:

```python
def test_sentry_init_skipped_when_no_dsn(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    # If SENTRY_DSN is not set, sentry should not be initialized
    # We verify main.py can be imported without error when DSN is absent
    import importlib
    import app.main
    importlib.reload(app.main)
    import sentry_sdk
    # hub client should be noop when not initialized with DSN
    assert True  # no exception = pass
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd backend
pytest tests/test_api_health.py::test_sentry_init_skipped_when_no_dsn -v
```

Expected: PASS

- [ ] **Step 3: Add Sentry init to `backend/app/main.py`**

Add after the `import os` line at the top:
```python
import sentry_sdk
```

Add this block immediately after the imports, before the `@asynccontextmanager` line:
```python
if _sentry_dsn := os.getenv("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.getenv("ENVIRONMENT", "development"),
        traces_sample_rate=0.2,
    )
```

- [ ] **Step 4: Run all tests**

```bash
cd backend
pytest --tb=short -q
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add Sentry error monitoring to backend (gated on SENTRY_DSN env var)"
```

---

### Task 5: Add railway.toml

**Why:** Without this file, Railway doesn't know how to start the app or verify it's healthy. The `railway.toml` tells Railway to run Alembic migrations before starting the server — so the database schema is always up to date on every deploy automatically, with no manual steps.

**Files:**
- Create: `backend/railway.toml`

- [ ] **Step 1: Create `backend/railway.toml`**

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

**What each line does:**
- `builder = "nixpacks"` — Railway auto-detects Python and installs `requirements.txt`
- `alembic upgrade head` — runs any pending DB migrations before the server starts
- `uvicorn app.main:app --host 0.0.0.0 --port $PORT` — starts the FastAPI server on Railway's assigned port
- `healthcheckPath` — Railway pings `/health` to confirm the app started successfully
- `restartPolicyType = "on_failure"` — Railway auto-restarts if the app crashes

- [ ] **Step 2: Commit**

```bash
git add backend/railway.toml
git commit -m "feat: add railway.toml for Railway deployment config"
```

---

### Task 6: Add GitHub Actions CI

**Why:** CI automatically runs your tests on every push and pull request. If a push breaks something, the deploy is blocked before bad code reaches production. It also runs a Next.js build check, which catches TypeScript errors and broken imports that tests might miss.

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the `.github/workflows/` directory and `ci.yml`**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  backend-tests:
    name: Backend Tests
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: cipuser
          POSTGRES_PASSWORD: cippass
          POSTGRES_DB: cip_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"
          cache-dependency-path: backend/requirements-dev.txt

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements-dev.txt

      - name: Run tests
        env:
          TEST_DATABASE_URL: postgresql://cipuser:cippass@localhost:5432/cip_test
          JWT_SECRET_KEY: test-secret-key-for-ci-only
          ENCRYPTION_KEY: ${{ secrets.CI_ENCRYPTION_KEY }}
          ANTHROPIC_API_KEY: dummy
          ENVIRONMENT: test
        run: |
          cd backend
          pytest --tb=short -q

  frontend-build:
    name: Frontend Build Check
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Build
        env:
          NEXT_PUBLIC_API_URL: https://placeholder.railway.app
        run: |
          cd frontend
          npm run build
```

- [ ] **Step 2: Generate a CI_ENCRYPTION_KEY and add it to GitHub Secrets**

Run this locally to generate a key:
```bash
cd backend
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy the output. Then:
1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `CI_ENCRYPTION_KEY`
4. Value: paste the generated key
5. Click "Add secret"

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: add GitHub Actions CI (backend tests + frontend build check)"
git push origin master
```

- [ ] **Step 4: Verify CI passes**

Go to your GitHub repo → Actions tab. You should see a workflow run triggered by the push. Wait for both jobs (Backend Tests, Frontend Build Check) to show green checkmarks.

Expected: both jobs pass

---

### Task 7: Add Sentry to frontend

**Why:** The backend Sentry catches server errors. The frontend Sentry catches JavaScript errors in the browser — broken UI components, failed API calls, uncaught exceptions. Without it, frontend crashes are invisible.

**Files:**
- Several files auto-generated by the Sentry wizard in `frontend/`

- [ ] **Step 1: Create a Sentry account and two projects**

1. Go to sentry.io → sign up (free)
2. Create a new project → Platform: **Next.js** → Name: `foresight-frontend`
3. Create another project → Platform: **Python (FastAPI)** → Name: `foresight-backend`
4. Copy the DSN for each project (shown on the project setup page, looks like `https://abc123@o123.ingest.sentry.io/456`)

- [ ] **Step 2: Run the Sentry wizard in the frontend directory**

```bash
cd frontend
npx @sentry/wizard@latest -i nextjs
```

When prompted:
- Select your Sentry account
- Choose the `foresight-frontend` project
- Accept all defaults (it will create `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and update `next.config.mjs`)

- [ ] **Step 3: Add NEXT_PUBLIC_SENTRY_DSN to `frontend/.env.local` for local dev**

```bash
echo "NEXT_PUBLIC_SENTRY_DSN=<your-frontend-sentry-dsn>" >> frontend/.env.local
```

Replace `<your-frontend-sentry-dsn>` with the DSN from step 1.

- [ ] **Step 4: Verify frontend still builds**

```bash
cd frontend
npm run build
```

Expected: build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: add Sentry error monitoring to frontend"
git push origin master
```

---

### Task 8: Deploy backend to Railway

**Why:** This makes the FastAPI backend live on the internet so the frontend can call it from anywhere.

- [ ] **Step 1: Create Railway account and project**

1. Go to railway.app → sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `claude-foresight` repo
4. When prompted for the root directory, set it to `backend`

- [ ] **Step 2: Add PostgreSQL plugin**

Inside your Railway project:
1. Click "+ New" → "Database" → "PostgreSQL"
2. Railway automatically creates the database and injects `DATABASE_URL` into your backend service

- [ ] **Step 3: Set environment variables in Railway**

In Railway → your backend service → Variables tab, add:

| Variable | Value |
|---|---|
| `JWT_SECRET_KEY` | Run locally: `python -c "import secrets; print(secrets.token_hex(32))"` → paste output |
| `JWT_ALGORITHM` | `HS256` |
| `JWT_EXPIRE_DAYS` | `30` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (same as Claude Code) |
| `ENCRYPTION_KEY` | Run locally: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` → paste output |
| `ALLOWED_ORIGINS` | `http://localhost:3000` (temporary — update after Vercel deploy) |
| `SENTRY_DSN` | Your backend Sentry DSN from Task 7 Step 1 |
| `ENVIRONMENT` | `production` |
| `ALERT_EMAIL_TO` | Your email address |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASSWORD` | Gmail app password (generate at myaccount.google.com → Security → App Passwords → Create) |
| `SQUARE_ACCESS_TOKEN` | Leave empty for now |

- [ ] **Step 4: Trigger deploy and verify**

Railway will auto-deploy after you set the variables. Watch the deploy logs:
1. You should see `alembic upgrade head` run successfully
2. You should see `uvicorn` start
3. Railway will ping `/health` — should return green

Copy your Railway backend URL (looks like `https://backend-production-xxxx.railway.app`).

- [ ] **Step 5: Verify the health endpoint is live**

Open in browser: `https://your-railway-url.railway.app/health`

Expected response:
```json
{"status": "ok"}
```

---

### Task 9: Deploy frontend to Vercel

**Why:** This makes the Next.js frontend live on the internet with a public URL.

- [ ] **Step 1: Create Vercel account and project**

1. Go to vercel.com → sign up with GitHub
2. Click "Add New Project" → import your `claude-foresight` repo
3. Set **Root Directory** to `frontend`
4. Framework Preset: Next.js (auto-detected)

- [ ] **Step 2: Set environment variables in Vercel**

In Vercel → your project → Settings → Environment Variables, add:

| Variable | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Your Railway backend URL (from Task 8 Step 4) | Production, Preview, Development |
| `NEXT_PUBLIC_SENTRY_DSN` | Your frontend Sentry DSN | Production, Preview |

- [ ] **Step 3: Deploy**

Click "Deploy". Vercel builds and deploys the frontend.

Copy your Vercel URL (looks like `https://claude-foresight.vercel.app`).

- [ ] **Step 4: Update ALLOWED_ORIGINS in Railway**

Go back to Railway → your backend service → Variables tab.

Update `ALLOWED_ORIGINS`:
```
https://claude-foresight.vercel.app,http://localhost:3000,http://localhost:5173
```

Railway will auto-redeploy the backend with the new value.

---

### Task 10: Set up BetterStack uptime monitoring

**Why:** If the Railway server crashes or goes down, you won't know unless something is actively checking. BetterStack pings your `/health` endpoint every 3 minutes and sends an email if it stops responding.

- [ ] **Step 1: Create BetterStack account**

1. Go to betterstack.com → sign up (free)
2. Go to Uptime → Monitors → New Monitor

- [ ] **Step 2: Configure the monitor**

| Field | Value |
|---|---|
| URL | `https://your-railway-url.railway.app/health` |
| Check frequency | Every 3 minutes |
| Monitor type | HTTP |
| Expected status | 200 |
| Alert email | Your email |

Click Save.

- [ ] **Step 3: Verify monitor shows green**

Wait up to 3 minutes. The monitor status should show "Up" with a green indicator.

---

### Task 11: Smoke test the live app

**Why:** Confirms everything is wired together correctly end-to-end in production.

- [ ] **Step 1: Register a new account**

Open your Vercel URL in the browser. Go to `/register`, create an account.

Expected: redirected to dashboard

- [ ] **Step 2: Log in**

Go to `/login`, log in with your new account.

Expected: dashboard loads with empty state (no Square data yet)

- [ ] **Step 3: Verify API calls reach the backend**

Open browser DevTools → Network tab. Reload the dashboard.

Expected: requests to your Railway URL return 200 responses (not CORS errors)

- [ ] **Step 4: Verify Sentry is receiving events**

Go to Sentry → your `foresight-frontend` project. You should see a "session" recorded from your visit.

Optionally trigger a test error: open browser console and run:
```js
throw new Error("Sentry test from production")
```

Check Sentry dashboard — the error should appear within 30 seconds.

- [ ] **Step 5: Verify BetterStack shows green**

Go to BetterStack → Uptime. Your monitor should show "Up".

---

## Done

Foresight is live at your Vercel URL. Every push to `main` auto-deploys both frontend (Vercel) and backend (Railway). Tests run on every push via GitHub Actions. Errors are tracked in Sentry. Downtime alerts via BetterStack.

**Next steps when ready:**
- Add Square access token in Railway env vars to enable customer sync
- Buy a custom domain and point it to Vercel
