# Customer Intelligence Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack SaaS platform that helps small business owners predict customer future visits, purchases, and behaviors using their Square POS data and Claude AI.

**Architecture:** FastAPI backend with PostgreSQL (SQLAlchemy + Alembic) storing synced Square customer/transaction data. An Anthropic-powered prediction engine analyzes each customer's history and scores churn risk, predicted next visit, and lifetime value. APScheduler keeps data fresh automatically. A React frontend presents a clean dashboard per business.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL 15, python-jose (JWT), Square Python SDK, Anthropic SDK, APScheduler, React 18, TailwindCSS

---

## Known Gotchas (read before executing)

| # | Issue | Where | Fix Applied |
|---|---|---|---|
| 1 | `email-validator` not in requirements — `EmailStr` crashes at import | `requirements.txt` | Added below |
| 2 | `__init__.py` missing in all module dirs | `auth/`, `square/`, `predictions/`, `dashboard/`, `tests/` | Added to each task |
| 3 | No `conftest.py` / `pytest.ini` — `ModuleNotFoundError: app` | All tests | Added Task 0 |
| 4 | Claude sometimes wraps JSON in ` ```json ``` ` fences | `predictions/engine.py` | Strip fences before parsing |
| 5 | No error handling around Anthropic API call | `predictions/engine.py` | try/except added |
| 6 | Square `list_customers` and `search_orders` are paginated — only page 1 fetched | `square/sync.py` | Cursor loop added |
| 7 | N+1 query in dashboard `/customers` — one query per customer for prediction | `dashboard/router.py` | Bulk load via JOIN |
| 8 | Duplicate `PredictionResponse` construction copy-pasted twice | `predictions/router.py` | Extracted helper `_to_response` |
| 9 | Unused `import uuid` in `predictions/schemas.py` | `predictions/schemas.py` | Removed |
| 10 | No Square Connect UI in frontend — users must use raw API | Frontend | Added `SquareConnect` modal to Dashboard |
| 11 | No error handling in Dashboard sync or CustomerDetail | Frontend | Added try/catch + error states |

---

## Task 0: Project Configuration (do this first)

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Add missing `email-validator` to `requirements.txt`**

Append to `backend/requirements.txt`:
```
email-validator==2.1.1
```

- [ ] **Step 2: Create `backend/pytest.ini`** so pytest finds the `app` module

```ini
[pytest]
pythonpath = .
asyncio_mode = auto
```

- [ ] **Step 3: Create `backend/tests/__init__.py`** (empty file — marks tests as a package)

```python
```

- [ ] **Step 4: Create `backend/tests/conftest.py`** with shared DB engine and fixtures

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
import app.models  # noqa: F401 — registers all models

TEST_DB_URL = "postgresql://cipuser:cippass@localhost:5432/cip"

@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(TEST_DB_URL)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

@pytest.fixture
def db(test_engine):
    Session = sessionmaker(bind=test_engine)
    session = Session()
    yield session
    session.rollback()
    session.close()
```

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini backend/tests/
git commit -m "chore: pytest config, email-validator dependency, test conftest"
```

---

## File Map

### Backend (`backend/app/`)

| File | Responsibility |
|---|---|
| `models/user.py` | Business owner account (SQLAlchemy model) |
| `models/customer.py` | Customer record synced from Square |
| `models/transaction.py` | Purchase/visit record synced from Square |
| `models/prediction.py` | AI prediction scores per customer |
| `models/__init__.py` | Import all models so Alembic detects them |
| `database.py` | SQLAlchemy engine + session factory |
| `auth/router.py` | `/auth/register`, `/auth/login` endpoints |
| `auth/utils.py` | Password hashing, JWT create/verify |
| `auth/deps.py` | `get_current_user` FastAPI dependency |
| `square/client.py` | Thin wrapper around Square SDK |
| `square/sync.py` | Pull customers + transactions, upsert to DB |
| `square/router.py` | `/square/connect`, `/square/sync` endpoints |
| `predictions/engine.py` | Call Anthropic, build prompt, parse result |
| `predictions/router.py` | `/predictions/{customer_id}` endpoint |
| `predictions/scheduler.py` | APScheduler job: nightly sync + predictions |
| `dashboard/router.py` | `/dashboard/overview`, `/dashboard/customers` |
| `main.py` | FastAPI app factory, mount all routers |
| `alembic/` | Alembic migration environment |
| `tests/` | pytest test files mirroring app structure |

### Frontend (`frontend/src/`)

| File | Responsibility |
|---|---|
| `api/client.ts` | Axios instance with JWT interceptor |
| `api/auth.ts` | login/register API calls |
| `api/customers.ts` | customer list + detail API calls |
| `api/dashboard.ts` | overview stats API calls |
| `context/AuthContext.tsx` | JWT storage + user state |
| `pages/Login.tsx` | Login/Register form |
| `pages/Dashboard.tsx` | Overview stats (top-level) |
| `pages/Customers.tsx` | Customer list with churn risk badges |
| `pages/CustomerDetail.tsx` | Single customer — visits, predictions |
| `components/PredictionCard.tsx` | Reusable AI insight display card |
| `components/RiskBadge.tsx` | Color-coded churn risk badge |
| `App.tsx` | Router + AuthContext provider |
| `main.tsx` | React entry point |
| `package.json` | React 18 + Vite + TailwindCSS |

---

## Task 1: Database Setup + Models

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/customer.py`
- Create: `backend/app/models/transaction.py`
- Create: `backend/app/models/prediction.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Test: `backend/tests/test_models.py`

> Note: Each subdirectory (`auth/`, `square/`, `predictions/`, `dashboard/`) needs an empty `__init__.py` file or Python can't import it. This is created in the respective tasks below.

- [ ] **Step 1: Create `backend/app/database.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: Create `backend/app/models/user.py`**

```python
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    business_name = Column(String, nullable=False)
    square_access_token = Column(String, nullable=True)
    square_location_id = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 3: Create `backend/app/models/customer.py`**

```python
from sqlalchemy import Column, String, DateTime, Float, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base

class Customer(Base):
    __tablename__ = "customers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    square_customer_id = Column(String, nullable=False, index=True)
    given_name = Column(String, nullable=True)
    family_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    total_visits = Column(Integer, default=0)
    total_spent = Column(Float, default=0.0)
    first_visit_at = Column(DateTime(timezone=True), nullable=True)
    last_visit_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

- [ ] **Step 4: Create `backend/app/models/transaction.py`**

```python
from sqlalchemy import Column, String, DateTime, Float, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True)
    square_order_id = Column(String, nullable=False, unique=True)
    amount = Column(Float, nullable=False)
    items = Column(JSON, nullable=True)  # list of {name, quantity, price}
    transacted_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 5: Create `backend/app/models/prediction.py`**

```python
from sqlalchemy import Column, String, DateTime, Float, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base

class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, index=True)
    churn_risk = Column(String, nullable=False)        # "low" | "medium" | "high"
    churn_risk_score = Column(Float, nullable=False)   # 0.0 - 1.0
    predicted_next_visit_days = Column(Float, nullable=True)  # days from now
    predicted_ltv = Column(Float, nullable=True)       # lifetime value $
    top_products = Column(String, nullable=True)       # comma-separated
    insight_summary = Column(Text, nullable=True)      # 1-2 sentence human summary
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 6: Create `backend/app/models/__init__.py`**

```python
from app.models.user import User
from app.models.customer import Customer
from app.models.transaction import Transaction
from app.models.prediction import Prediction
```

- [ ] **Step 7: Write test to verify models import + tables create**

Create `backend/tests/test_models.py`:
```python
from sqlalchemy import inspect

def test_all_tables_created(test_engine):
    # test_engine fixture from conftest.py creates all tables
    inspector = inspect(test_engine)
    tables = inspector.get_table_names()
    assert "users" in tables
    assert "customers" in tables
    assert "transactions" in tables
    assert "predictions" in tables
```

- [ ] **Step 8: Run test to verify it fails (DB not yet running)**

```bash
cd backend && python -m pytest tests/test_models.py -v
```
Expected: FAIL or connection error — this is correct.

- [ ] **Step 9: Start the database**

```bash
cd /c/Users/Owner/customer-intelligence && docker-compose up -d
```

- [ ] **Step 10: Run test again — should pass**

```bash
cd backend && python -m pytest tests/test_models.py -v
```
Expected: PASS

- [ ] **Step 11: Initialize Alembic**

```bash
cd backend && alembic init alembic
```

Edit `alembic/env.py` — find the `target_metadata` line and replace with:
```python
from app.database import Base
import app.models  # noqa: F401 — registers all models
target_metadata = Base.metadata
```

Also set `sqlalchemy.url` in `alembic.ini` to match your `.env` DATABASE_URL, or load dynamically from config.

- [ ] **Step 12: Create and run initial migration**

```bash
cd backend && alembic revision --autogenerate -m "initial tables"
alembic upgrade head
```

- [ ] **Step 13: Commit**

```bash
git add backend/app/database.py backend/app/models/ backend/tests/test_models.py backend/alembic.ini backend/alembic/
git commit -m "feat: database models for users, customers, transactions, predictions"
```

---

## Task 2: Auth System (Register + Login)

**Files:**
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/utils.py`
- Create: `backend/app/auth/deps.py`
- Create: `backend/app/auth/router.py`
- Create: `backend/app/auth/schemas.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_auth.py`

- [ ] **Step 1: Create `backend/app/auth/__init__.py`** (empty — marks directory as package)

```python
```

- [ ] **Step 2: Create `backend/app/auth/utils.py`**

```python
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.jwt_expire_days)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

def decode_token(token: str) -> str:
    """Returns user_id (str) or raises JWTError."""
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    return payload["sub"]
```

- [ ] **Step 2: Create `backend/app/auth/deps.py`**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError
from app.database import get_db
from app.models.user import User
from app.auth.utils import decode_token

bearer = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    try:
        user_id = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
```

- [ ] **Step 3: Create `backend/app/auth/schemas.py`**

```python
from pydantic import BaseModel, EmailStr

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    business_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    business_name: str
```

- [ ] **Step 4: Create `backend/app/auth/router.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.auth.schemas import RegisterRequest, LoginRequest, TokenResponse
from app.auth.utils import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
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
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user_id=str(user.id), business_name=user.business_name)
```

- [ ] **Step 5: Create `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.auth.router import router as auth_router

app = FastAPI(title="Customer Intelligence Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Write auth tests**

Create `backend/tests/test_auth.py`:
```python
import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def _unique_email():
    return f"test_{uuid.uuid4().hex[:8]}@test.com"

def test_register():
    r = client.post("/auth/register", json={
        "email": _unique_email(),
        "password": "secret123",
        "business_name": "Test Cafe"
    })
    assert r.status_code == 201
    assert "access_token" in r.json()

def test_register_duplicate_email():
    email = _unique_email()
    client.post("/auth/register", json={"email": email, "password": "x", "business_name": "B"})
    r = client.post("/auth/register", json={"email": email, "password": "x", "business_name": "B"})
    assert r.status_code == 400

def test_login():
    email = _unique_email()
    client.post("/auth/register", json={"email": email, "password": "pass123", "business_name": "B"})
    r = client.post("/auth/login", json={"email": email, "password": "pass123"})
    assert r.status_code == 200
    assert "access_token" in r.json()

def test_login_wrong_password():
    email = _unique_email()
    client.post("/auth/register", json={"email": email, "password": "pass123", "business_name": "B"})
    r = client.post("/auth/login", json={"email": email, "password": "wrong"})
    assert r.status_code == 401
```

Note: Tests use unique emails per call so they never conflict, even across repeated runs.

- [ ] **Step 7: Run tests**

```bash
cd backend && python -m pytest tests/test_auth.py -v
```
Expected: All 4 PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/auth/ backend/app/main.py backend/tests/test_auth.py
git commit -m "feat: auth system - register and login with JWT"
```

---

## Task 3: Square Integration — Sync Customers + Transactions

**Files:**
- Create: `backend/app/square/__init__.py`
- Create: `backend/app/square/client.py`
- Create: `backend/app/square/sync.py`
- Create: `backend/app/square/router.py`
- Create: `backend/app/square/schemas.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_square_sync.py`

- [ ] **Step 1: Create `backend/app/square/__init__.py`** (empty)

```python
```

- [ ] **Step 2: Create `backend/app/square/client.py`**

```python
from square.client import Client as SquareClient
from app.config import settings

def get_square_client(access_token: str) -> SquareClient:
    """Return a Square client for a given user's access token."""
    return SquareClient(access_token=access_token, environment="production")
```

- [ ] **Step 3: Create `backend/app/square/sync.py`**

Note: Square's API is paginated. We loop using cursors until no more pages remain, otherwise businesses with >100 customers/orders get silently truncated.

```python
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.customer import Customer
from app.models.transaction import Transaction
from app.models.user import User
from app.square.client import get_square_client


def sync_customers(user: User, db: Session) -> int:
    """Fetch ALL customers from Square (paginated) and upsert to DB."""
    client = get_square_client(user.square_access_token)
    synced = 0
    cursor = None

    while True:
        kwargs = {}
        if cursor:
            kwargs["cursor"] = cursor
        result = client.customers.list_customers(**kwargs)
        if result.is_error():
            raise Exception(f"Square error: {result.errors}")

        for sq_customer in (result.body.get("customers") or []):
            existing = db.query(Customer).filter(
                Customer.user_id == user.id,
                Customer.square_customer_id == sq_customer["id"]
            ).first()
            if not existing:
                existing = Customer(user_id=user.id, square_customer_id=sq_customer["id"])
                db.add(existing)
            existing.given_name = sq_customer.get("given_name")
            existing.family_name = sq_customer.get("family_name")
            existing.email = sq_customer.get("email_address")
            existing.phone = sq_customer.get("phone_number")
            synced += 1

        cursor = result.body.get("cursor")
        if not cursor:
            break

    db.commit()
    return synced


def sync_transactions(user: User, db: Session) -> int:
    """Fetch ALL completed orders from Square (paginated) and upsert to DB."""
    client = get_square_client(user.square_access_token)
    synced = 0
    cursor = None

    while True:
        body = {
            "location_ids": [user.square_location_id],
            "query": {"filter": {"state_filter": {"states": ["COMPLETED"]}}},
        }
        if cursor:
            body["cursor"] = cursor
        result = client.orders.search_orders(body=body)
        if result.is_error():
            raise Exception(f"Square error: {result.errors}")

        for order in (result.body.get("orders") or []):
            if db.query(Transaction).filter(Transaction.square_order_id == order["id"]).first():
                continue
            sq_cust_id = order.get("customer_id")
            customer = None
            if sq_cust_id:
                customer = db.query(Customer).filter(
                    Customer.user_id == user.id,
                    Customer.square_customer_id == sq_cust_id
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

        cursor = result.body.get("cursor")
        if not cursor:
            break

    # update customer visit stats in bulk
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

- [ ] **Step 4: Create `backend/app/square/schemas.py`**

```python
from pydantic import BaseModel

class ConnectSquareRequest(BaseModel):
    access_token: str
    location_id: str

class SyncResponse(BaseModel):
    customers_synced: int
    transactions_synced: int
```

- [ ] **Step 5: Create `backend/app/square/router.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.square.schemas import ConnectSquareRequest, SyncResponse
from app.square.sync import sync_customers, sync_transactions

router = APIRouter(prefix="/square", tags=["square"])

@router.post("/connect")
def connect_square(body: ConnectSquareRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.square_access_token = body.access_token
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

- [ ] **Step 6: Mount router in `backend/app/main.py`**

Add to main.py:
```python
from app.square.router import router as square_router
app.include_router(square_router)
```

- [ ] **Step 7: Write integration test for sync logic**

Create `backend/tests/test_square_sync.py`:
```python
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
import app.models  # noqa
from app.models.user import User
from app.models.customer import Customer
from app.models.transaction import Transaction
from app.square.sync import sync_customers, sync_transactions
import uuid

TEST_DB = "postgresql://cipuser:cippass@localhost:5432/cip"
engine = create_engine(TEST_DB)
Session = sessionmaker(bind=engine)

@pytest.fixture(autouse=True, scope="module")
def setup():
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)

@pytest.fixture
def db():
    session = Session()
    yield session
    session.rollback()
    session.close()

@pytest.fixture
def user(db):
    u = User(email=f"{uuid.uuid4()}@test.com", hashed_password="x", business_name="B",
             square_access_token="fake", square_location_id="LOC1")
    db.add(u)
    db.commit()
    return u

def test_sync_customers_creates_records(db, user):
    mock_client = MagicMock()
    mock_client.customers.list_customers.return_value = MagicMock(
        is_error=lambda: False,
        body={"customers": [{"id": "SQ_CUST_1", "given_name": "Alice", "family_name": "Smith", "email_address": "alice@test.com"}]}
    )
    with patch("app.square.sync.get_square_client", return_value=mock_client):
        count = sync_customers(user, db)
    assert count == 1
    cust = db.query(Customer).filter(Customer.square_customer_id == "SQ_CUST_1").first()
    assert cust is not None
    assert cust.given_name == "Alice"
```

- [ ] **Step 8: Run test**

```bash
cd backend && python -m pytest tests/test_square_sync.py -v
```
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/square/ backend/tests/test_square_sync.py backend/app/main.py
git commit -m "feat: Square sync - import customers and transactions (paginated)"
```

---

## Task 4: AI Prediction Engine

**Files:**
- Create: `backend/app/predictions/__init__.py`
- Create: `backend/app/predictions/engine.py`
- Create: `backend/app/predictions/router.py`
- Create: `backend/app/predictions/schemas.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_predictions.py`

- [ ] **Step 1: Create `backend/app/predictions/__init__.py`** (empty)

```python
```

- [ ] **Step 2: Create `backend/app/predictions/schemas.py`**

```python
from pydantic import BaseModel
from typing import Optional

class PredictionResponse(BaseModel):
    customer_id: str
    customer_name: str
    churn_risk: str
    churn_risk_score: float
    predicted_next_visit_days: Optional[float]
    predicted_ltv: Optional[float]
    top_products: Optional[str]
    insight_summary: Optional[str]
    generated_at: str
```

- [ ] **Step 3: Create `backend/app/predictions/engine.py`**

```python
import json
from datetime import datetime, timezone
from anthropic import Anthropic
from sqlalchemy.orm import Session
from app.config import settings
from app.models.customer import Customer
from app.models.transaction import Transaction
from app.models.prediction import Prediction

anthropic = Anthropic(api_key=settings.anthropic_api_key)

def _build_prompt(customer: Customer, transactions: list[Transaction]) -> str:
    tx_list = "\n".join(
        f"- {t.transacted_at.strftime('%Y-%m-%d')}: ${t.amount:.2f}, items: {json.dumps(t.items or [])}"
        for t in sorted(transactions, key=lambda x: x.transacted_at)
    )
    days_since_last = None
    if customer.last_visit_at:
        days_since_last = (datetime.now(timezone.utc) - customer.last_visit_at).days

    return f"""You are a customer analytics AI for small businesses. Analyze this customer's purchase history and return a JSON prediction.

Customer: {customer.given_name or ''} {customer.family_name or ''}
Total visits: {customer.total_visits}
Total spent: ${customer.total_spent:.2f}
First visit: {customer.first_visit_at}
Last visit: {customer.last_visit_at}
Days since last visit: {days_since_last}

Transaction history:
{tx_list if tx_list else "No transactions yet"}

Return ONLY valid JSON with these exact keys:
{{
  "churn_risk": "low" | "medium" | "high",
  "churn_risk_score": 0.0 to 1.0,
  "predicted_next_visit_days": number or null,
  "predicted_ltv": number in dollars or null,
  "top_products": "comma-separated product names" or null,
  "insight_summary": "1-2 sentence human-readable insight"
}}"""


def _strip_fences(text: str) -> str:
    """Remove markdown code fences Claude sometimes wraps JSON in."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]  # drop the ```json line
        text = text.rsplit("```", 1)[0]  # drop trailing ```
    return text.strip()


def generate_prediction(customer: Customer, db: Session) -> Prediction:
    transactions = db.query(Transaction).filter(Transaction.customer_id == customer.id).all()
    prompt = _build_prompt(customer, transactions)

    try:
        message = anthropic.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = _strip_fences(message.content[0].text)
        data = json.loads(raw)
    except Exception as e:
        raise ValueError(f"AI prediction failed: {e}")

    # upsert prediction
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
    return pred
```

- [ ] **Step 4: Create `backend/app/predictions/router.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.models.customer import Customer
from app.models.prediction import Prediction
from app.predictions.engine import generate_prediction
from app.predictions.schemas import PredictionResponse

router = APIRouter(prefix="/predictions", tags=["predictions"])


def _to_response(customer: Customer, pred: Prediction) -> PredictionResponse:
    return PredictionResponse(
        customer_id=str(customer.id),
        customer_name=f"{customer.given_name or ''} {customer.family_name or ''}".strip(),
        churn_risk=pred.churn_risk,
        churn_risk_score=pred.churn_risk_score,
        predicted_next_visit_days=pred.predicted_next_visit_days,
        predicted_ltv=pred.predicted_ltv,
        top_products=pred.top_products,
        insight_summary=pred.insight_summary,
        generated_at=pred.generated_at.isoformat(),
    )


@router.get("/{customer_id}", response_model=PredictionResponse)
def get_prediction(customer_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.user_id == user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    pred = db.query(Prediction).filter(Prediction.customer_id == customer.id).first()
    if not pred:
        pred = generate_prediction(customer, db)
    return _to_response(customer, pred)


@router.post("/{customer_id}/refresh", response_model=PredictionResponse)
def refresh_prediction(customer_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.user_id == user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    pred = generate_prediction(customer, db)
    return _to_response(customer, pred)
```

- [ ] **Step 5: Mount predictions router in `main.py`**

```python
from app.predictions.router import router as predictions_router
app.include_router(predictions_router)
```

- [ ] **Step 6: Write prediction engine test (mocked Anthropic call)**

Create `backend/tests/test_predictions.py`:
```python
import json
import uuid
from unittest.mock import patch, MagicMock
from app.models.user import User
from app.models.customer import Customer
from app.predictions.engine import generate_prediction

MOCK_AI_RESPONSE = {
    "churn_risk": "medium",
    "churn_risk_score": 0.55,
    "predicted_next_visit_days": 14.0,
    "predicted_ltv": 500.0,
    "top_products": "Coffee, Muffin",
    "insight_summary": "Bob visits regularly but spend is slowing."
}

def test_generate_prediction(db):
    # db fixture comes from conftest.py
    u = User(email=f"{uuid.uuid4().hex}@test.com", hashed_password="x", business_name="B")
    db.add(u)
    db.commit()
    c = Customer(user_id=u.id, square_customer_id=uuid.uuid4().hex, given_name="Bob", total_visits=5, total_spent=120.0)
    db.add(c)
    db.commit()

    mock_msg = MagicMock()
    mock_msg.content = [MagicMock(text=json.dumps(MOCK_AI_RESPONSE))]
    with patch("app.predictions.engine.anthropic") as mock_anthropic:
        mock_anthropic.messages.create.return_value = mock_msg
        pred = generate_prediction(c, db)

    assert pred.churn_risk == "medium"
    assert pred.churn_risk_score == 0.55
    assert pred.top_products == "Coffee, Muffin"

def test_generate_prediction_handles_json_fences(db):
    """Claude sometimes wraps JSON in ```json ... ``` — must not crash."""
    u = User(email=f"{uuid.uuid4().hex}@test.com", hashed_password="x", business_name="B")
    db.add(u)
    db.commit()
    c = Customer(user_id=u.id, square_customer_id=uuid.uuid4().hex, given_name="Alice", total_visits=2, total_spent=40.0)
    db.add(c)
    db.commit()

    fenced = f"```json\n{json.dumps(MOCK_AI_RESPONSE)}\n```"
    mock_msg = MagicMock()
    mock_msg.content = [MagicMock(text=fenced)]
    with patch("app.predictions.engine.anthropic") as mock_anthropic:
        mock_anthropic.messages.create.return_value = mock_msg
        pred = generate_prediction(c, db)

    assert pred.churn_risk == "medium"
```

- [ ] **Step 7: Run tests**

```bash
cd backend && python -m pytest tests/test_predictions.py -v
```
Expected: Both tests PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/predictions/ backend/tests/test_predictions.py backend/app/main.py
git commit -m "feat: AI prediction engine using Anthropic (churn risk, next visit, LTV)"
```

---

## Task 5: Dashboard API

**Files:**
- Create: `backend/app/dashboard/__init__.py`
- Create: `backend/app/dashboard/router.py`
- Create: `backend/app/dashboard/schemas.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_dashboard.py`

- [ ] **Step 1: Create `backend/app/dashboard/__init__.py`** (empty)

```python
```

- [ ] **Step 2: Create `backend/app/dashboard/schemas.py`**

```python
from pydantic import BaseModel
from typing import Optional, List

class CustomerSummary(BaseModel):
    id: str
    name: str
    email: Optional[str]
    total_visits: int
    total_spent: float
    last_visit_at: Optional[str]
    churn_risk: Optional[str]
    churn_risk_score: Optional[float]

class OverviewStats(BaseModel):
    total_customers: int
    total_revenue: float
    high_risk_count: int
    avg_visits_per_customer: float
```

- [ ] **Step 3: Create `backend/app/dashboard/router.py`**

Note: `/customers` loads all predictions in a single query (keyed by customer_id) instead of one query per customer, avoiding an N+1 problem.

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.models.customer import Customer
from app.models.prediction import Prediction
from app.dashboard.schemas import OverviewStats, CustomerSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=OverviewStats)
def overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    customers = db.query(Customer).filter(Customer.user_id == user.id).all()
    total_revenue = sum(c.total_spent for c in customers)
    avg_visits = sum(c.total_visits for c in customers) / len(customers) if customers else 0
    customer_ids = [c.id for c in customers]
    high_risk = db.query(Prediction).filter(
        Prediction.customer_id.in_(customer_ids),
        Prediction.churn_risk == "high"
    ).count()
    return OverviewStats(
        total_customers=len(customers),
        total_revenue=total_revenue,
        high_risk_count=high_risk,
        avg_visits_per_customer=round(avg_visits, 1),
    )


@router.get("/customers", response_model=List[CustomerSummary])
def customers_list(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    customers = db.query(Customer).filter(Customer.user_id == user.id).all()
    customer_ids = [c.id for c in customers]

    # single query for all predictions, keyed by customer_id — no N+1
    preds = {
        p.customer_id: p
        for p in db.query(Prediction).filter(Prediction.customer_id.in_(customer_ids)).all()
    }

    return [
        CustomerSummary(
            id=str(c.id),
            name=f"{c.given_name or ''} {c.family_name or ''}".strip(),
            email=c.email,
            total_visits=c.total_visits,
            total_spent=c.total_spent,
            last_visit_at=c.last_visit_at.isoformat() if c.last_visit_at else None,
            churn_risk=preds[c.id].churn_risk if c.id in preds else None,
            churn_risk_score=preds[c.id].churn_risk_score if c.id in preds else None,
        )
        for c in customers
    ]
```

- [ ] **Step 4: Mount router in `main.py`**

```python
from app.dashboard.router import router as dashboard_router
app.include_router(dashboard_router)
```

- [ ] **Step 5: Write dashboard test**

Create `backend/tests/test_dashboard.py`:
```python
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def auth_token():
    """Register a unique user once for the module, return token."""
    email = f"dash_{uuid.uuid4().hex[:8]}@test.com"
    r = client.post("/auth/register", json={"email": email, "password": "pw123", "business_name": "B"})
    assert r.status_code == 201
    return r.json()["access_token"]

def test_overview_empty(auth_token):
    r = client.get("/dashboard/overview", headers={"Authorization": f"Bearer {auth_token}"})
    assert r.status_code == 200
    assert r.json()["total_customers"] == 0

def test_customers_empty(auth_token):
    r = client.get("/dashboard/customers", headers={"Authorization": f"Bearer {auth_token}"})
    assert r.status_code == 200
    assert r.json() == []

def test_dashboard_requires_auth():
    r = client.get("/dashboard/overview")
    assert r.status_code == 403  # no token
```

- [ ] **Step 6: Run tests**

```bash
cd backend && python -m pytest tests/test_dashboard.py -v
```
Expected: All 3 PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/dashboard/ backend/tests/test_dashboard.py backend/app/main.py
git commit -m "feat: dashboard API - overview stats and customer list (no N+1)"
```

---

## Task 6: Background Scheduler (Nightly Sync + Predictions)

**Files:**
- Create: `backend/app/predictions/scheduler.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `backend/app/predictions/scheduler.py`**

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.models.customer import Customer
from app.square.sync import sync_customers, sync_transactions
from app.predictions.engine import generate_prediction
import logging

logger = logging.getLogger(__name__)

def nightly_job():
    """Run for all users: sync Square data + refresh predictions."""
    db: Session = SessionLocal()
    try:
        users = db.query(User).filter(User.square_access_token != None).all()
        for user in users:
            try:
                sync_customers(user, db)
                sync_transactions(user, db)
                customers = db.query(Customer).filter(Customer.user_id == user.id).all()
                for customer in customers:
                    generate_prediction(customer, db)
                logger.info(f"Nightly job complete for user {user.email}")
            except Exception as e:
                logger.error(f"Nightly job failed for user {user.email}: {e}")
    finally:
        db.close()

def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(nightly_job, CronTrigger(hour=2, minute=0))  # 2am daily
    scheduler.start()
    return scheduler
```

- [ ] **Step 2: Start scheduler in `main.py` lifespan**

Replace the app creation in `main.py` with:
```python
from contextlib import asynccontextmanager
from app.predictions.scheduler import start_scheduler

@asynccontextmanager
async def lifespan(app):
    scheduler = start_scheduler()
    yield
    scheduler.shutdown()

app = FastAPI(title="Customer Intelligence Platform", lifespan=lifespan)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/predictions/scheduler.py backend/app/main.py
git commit -m "feat: nightly APScheduler job for auto sync + prediction refresh"
```

---

## Task 7: React Frontend

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/api/customers.ts`
- Create: `frontend/src/api/dashboard.ts`
- Create: `frontend/src/context/AuthContext.tsx`
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/pages/Customers.tsx`
- Create: `frontend/src/pages/CustomerDetail.tsx`
- Create: `frontend/src/components/RiskBadge.tsx`
- Create: `frontend/src/components/PredictionCard.tsx`

- [ ] **Step 1: Initialize React + Vite project**

```bash
cd /c/Users/Owner/customer-intelligence/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install axios react-router-dom @types/react-router-dom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configure TailwindCSS**

In `tailwind.config.js`:
```js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

In `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Create `src/api/client.ts`**

```typescript
import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:8000" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

- [ ] **Step 4: Create auth, customers, dashboard API files**

`src/api/auth.ts`:
```typescript
import api from "./client";
export const register = (email: string, password: string, business_name: string) =>
  api.post("/auth/register", { email, password, business_name });
export const login = (email: string, password: string) =>
  api.post("/auth/login", { email, password });
```

`src/api/dashboard.ts`:
```typescript
import api from "./client";
export const getOverview = () => api.get("/dashboard/overview");
export const getCustomers = () => api.get("/dashboard/customers");
```

`src/api/customers.ts`:
```typescript
import api from "./client";
export const getPrediction = (customerId: string) => api.get(`/predictions/${customerId}`);
export const refreshPrediction = (customerId: string) => api.post(`/predictions/${customerId}/refresh`);
export const syncSquare = () => api.post("/square/sync");
export const connectSquare = (access_token: string, location_id: string) =>
  api.post("/square/connect", { access_token, location_id });
```

- [ ] **Step 5: Create `src/context/AuthContext.tsx`**

```typescript
import { createContext, useContext, useState, ReactNode } from "react";

interface AuthContextType {
  token: string | null;
  businessName: string | null;
  setAuth: (token: string, businessName: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [businessName, setBusinessName] = useState(localStorage.getItem("businessName"));

  const setAuth = (t: string, name: string) => {
    localStorage.setItem("token", t);
    localStorage.setItem("businessName", name);
    setToken(t);
    setBusinessName(name);
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setBusinessName(null);
  };

  return <AuthContext.Provider value={{ token, businessName, setAuth, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext)!;
```

- [ ] **Step 6: Create `src/components/RiskBadge.tsx`**

```typescript
export function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return <span className="text-gray-400 text-xs">No data</span>;
  const colors = { low: "bg-green-100 text-green-800", medium: "bg-yellow-100 text-yellow-800", high: "bg-red-100 text-red-800" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[risk as keyof typeof colors]}`}>{risk} risk</span>;
}
```

- [ ] **Step 7: Create `src/components/PredictionCard.tsx`**

```typescript
interface Props {
  churnRisk: string;
  churnScore: number;
  nextVisitDays: number | null;
  ltv: number | null;
  topProducts: string | null;
  summary: string | null;
}

export function PredictionCard({ churnRisk, churnScore, nextVisitDays, ltv, topProducts, summary }: Props) {
  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-3">
      <h3 className="font-semibold text-gray-800">AI Prediction</h3>
      {summary && <p className="text-gray-600 text-sm italic">"{summary}"</p>}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Churn Risk Score:</span> <span className="font-medium">{(churnScore * 100).toFixed(0)}%</span></div>
        <div><span className="text-gray-500">Next Visit:</span> <span className="font-medium">{nextVisitDays ? `~${Math.round(nextVisitDays)} days` : "Unknown"}</span></div>
        <div><span className="text-gray-500">Predicted LTV:</span> <span className="font-medium">{ltv ? `$${ltv.toFixed(0)}` : "Unknown"}</span></div>
        <div><span className="text-gray-500">Top Products:</span> <span className="font-medium">{topProducts || "Unknown"}</span></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create `src/pages/Login.tsx`**

```typescript
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login, register } from "../api/auth";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [business, setBusiness] = useState("");
  const [error, setError] = useState("");
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const r = mode === "login"
        ? await login(email, password)
        : await register(email, password, business);
      setAuth(r.data.access_token, r.data.business_name);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Customer Intelligence</h1>
        <p className="text-gray-500 mb-6">Predict your customers' next move.</p>
        <form onSubmit={submit} className="space-y-4">
          <input className="w-full border rounded-lg px-4 py-2 text-sm" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="w-full border rounded-lg px-4 py-2 text-sm" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {mode === "register" && (
            <input className="w-full border rounded-lg px-4 py-2 text-sm" placeholder="Business Name" value={business} onChange={e => setBusiness(e.target.value)} required />
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button className="w-full bg-indigo-600 text-white rounded-lg py-2 font-medium hover:bg-indigo-700" type="submit">
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
        <button className="mt-4 text-sm text-indigo-600 hover:underline" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Create `src/pages/Dashboard.tsx`**

Includes a Square Connect modal so users can enter their credentials from the UI (not just raw API calls).

```typescript
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getOverview } from "../api/dashboard";
import { syncSquare, connectSquare } from "../api/customers";

interface Overview { total_customers: number; total_revenue: number; high_risk_count: number; avg_visits_per_customer: number; }

export default function Dashboard() {
  const [stats, setStats] = useState<Overview | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [showConnect, setShowConnect] = useState(false);
  const [sqToken, setSqToken] = useState("");
  const [sqLocation, setSqLocation] = useState("");
  const [connecting, setConnecting] = useState(false);
  const { businessName, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { getOverview().then(r => setStats(r.data)); }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      await syncSquare();
      const r = await getOverview();
      setStats(r.data);
    } catch (e: any) {
      setSyncError(e.response?.data?.detail || "Sync failed. Is Square connected?");
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    try {
      await connectSquare(sqToken, sqLocation);
      setShowConnect(false);
      setSqToken("");
      setSqLocation("");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{businessName}</h1>
            <p className="text-gray-500">Customer Intelligence Dashboard</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowConnect(true)} className="border px-4 py-2 rounded-lg hover:bg-gray-100 text-sm">Connect Square</button>
            <button onClick={handleSync} disabled={syncing} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {syncing ? "Syncing..." : "Sync Square"}
            </button>
            <button onClick={() => navigate("/customers")} className="border px-4 py-2 rounded-lg hover:bg-gray-100">Customers</button>
            <button onClick={logout} className="text-gray-500 hover:text-gray-800 text-sm">Logout</button>
          </div>
        </div>

        {syncError && <p className="text-red-500 text-sm mb-4">{syncError}</p>}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Customers", value: stats.total_customers },
              { label: "Total Revenue", value: `$${stats.total_revenue.toFixed(2)}` },
              { label: "High Churn Risk", value: stats.high_risk_count },
              { label: "Avg Visits / Customer", value: stats.avg_visits_per_customer },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl shadow p-6">
                <p className="text-gray-500 text-sm">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
            ))}
          </div>
        )}

        {showConnect && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
              <h2 className="text-xl font-bold mb-4">Connect Square</h2>
              <form onSubmit={handleConnect} className="space-y-4">
                <input className="w-full border rounded-lg px-4 py-2 text-sm" placeholder="Square Access Token" value={sqToken} onChange={e => setSqToken(e.target.value)} required />
                <input className="w-full border rounded-lg px-4 py-2 text-sm" placeholder="Location ID" value={sqLocation} onChange={e => setSqLocation(e.target.value)} required />
                <div className="flex gap-3">
                  <button type="submit" disabled={connecting} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 disabled:opacity-50">
                    {connecting ? "Connecting..." : "Connect"}
                  </button>
                  <button type="button" onClick={() => setShowConnect(false)} className="flex-1 border rounded-lg py-2 hover:bg-gray-100">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Create `src/pages/Customers.tsx`**

```typescript
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCustomers } from "../api/dashboard";
import { RiskBadge } from "../components/RiskBadge";

interface Customer { id: string; name: string; email: string; total_visits: number; total_spent: number; last_visit_at: string | null; churn_risk: string | null; }

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const navigate = useNavigate();

  useEffect(() => { getCustomers().then(r => setCustomers(r.data)); }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">All Customers</h2>
          <button onClick={() => navigate("/dashboard")} className="text-indigo-600 hover:underline text-sm">← Back to Dashboard</button>
        </div>
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Visits</th>
                <th className="px-6 py-3">Total Spent</th>
                <th className="px-6 py-3">Last Visit</th>
                <th className="px-6 py-3">Churn Risk</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                  <td className="px-6 py-4 font-medium text-gray-900">{c.name || c.email || "Unknown"}</td>
                  <td className="px-6 py-4">{c.total_visits}</td>
                  <td className="px-6 py-4">${c.total_spent.toFixed(2)}</td>
                  <td className="px-6 py-4">{c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString() : "—"}</td>
                  <td className="px-6 py-4"><RiskBadge risk={c.churn_risk} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Create `src/pages/CustomerDetail.tsx`**

```typescript
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPrediction, refreshPrediction } from "../api/customers";
import { RiskBadge } from "../components/RiskBadge";
import { PredictionCard } from "../components/PredictionCard";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [pred, setPred] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getPrediction(id)
      .then(r => setPred(r.data))
      .catch(() => setError("Failed to load prediction."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      const r = await refreshPrediction(id!);
      setPred(r.data);
    } catch {
      setError("Failed to refresh prediction.");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading prediction...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!pred) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{pred.customer_name || "Unknown"}</h2>
            <RiskBadge risk={pred.churn_risk} />
          </div>
          <div className="flex gap-3">
            <button onClick={handleRefresh} disabled={refreshing} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm">
              {refreshing ? "Refreshing..." : "Refresh AI"}
            </button>
            <button onClick={() => navigate("/customers")} className="text-indigo-600 hover:underline text-sm">← Back</button>
          </div>
        </div>
        <PredictionCard
          churnRisk={pred.churn_risk}
          churnScore={pred.churn_risk_score}
          nextVisitDays={pred.predicted_next_visit_days}
          ltv={pred.predicted_ltv}
          topProducts={pred.top_products}
          summary={pred.insight_summary}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Create `src/App.tsx`**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 13: Start frontend and verify it loads**

```bash
cd /c/Users/Owner/customer-intelligence/frontend && npm run dev
```
Expected: Vite dev server on http://localhost:5173, Login page visible.

- [ ] **Step 14: Run the full backend**

```bash
cd /c/Users/Owner/customer-intelligence/backend && uvicorn app.main:app --reload
```
Expected: FastAPI running on http://localhost:8000

- [ ] **Step 15: End-to-end smoke test**
1. Open http://localhost:5173
2. Register a new account
3. You should land on the Dashboard showing 0 customers
4. Enter Square credentials via `/square/connect` (use curl or the API docs at http://localhost:8000/docs)
5. Click "Sync Square" — customers should populate
6. Click a customer → see AI prediction

- [ ] **Step 16: Commit frontend**

```bash
git add frontend/
git commit -m "feat: React frontend - login, dashboard, customer list, AI prediction detail"
```

---

## Final Run — All Tests

```bash
cd backend && python -m pytest tests/ -v
```
Expected: All tests PASS.

---

## How to Run the Full App

```bash
# Terminal 1 - Database
cd /c/Users/Owner/customer-intelligence && docker-compose up -d

# Terminal 2 - Backend
cd backend && cp .env.example .env  # fill in JWT_SECRET_KEY, ANTHROPIC_API_KEY, SQUARE_ACCESS_TOKEN
uvicorn app.main:app --reload

# Terminal 3 - Frontend
cd frontend && npm run dev
```

Open http://localhost:5173
