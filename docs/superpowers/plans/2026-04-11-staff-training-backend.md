# Staff Training Module — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add worker accounts, training tracks, modules, progress tracking, AI generation, and industry templates to the Foresight backend.

**Architecture:** New `staff` and `training` router modules follow the existing pattern (router + schemas per feature). Auth is extended to support a `worker` role via a `role` claim in the JWT. Three Alembic migrations add the five new tables. AI generation calls Claude via the existing `anthropic` SDK pattern.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, Anthropic Python SDK (`claude-haiku-4-5-20251001`), pytest + TestClient

---

## File Map

**New files:**
- `backend/app/models/worker.py` — Worker SQLAlchemy model
- `backend/app/models/training.py` — TrainingTrack, TrainingModule, WorkerTrackAssignment, WorkerProgress, ModuleFlag models
- `backend/alembic/versions/007_add_workers_table.py` — workers migration
- `backend/alembic/versions/008_add_training_tables.py` — training tables migration
- `backend/alembic/versions/009_add_module_flags_table.py` — module_flags migration
- `backend/app/staff/__init__.py`
- `backend/app/staff/schemas.py` — Pydantic schemas for owner-facing routes
- `backend/app/staff/router.py` — owner-facing /staff routes
- `backend/app/training/__init__.py`
- `backend/app/training/schemas.py` — Pydantic schemas for worker-facing routes
- `backend/app/training/ai.py` — Claude AI starter kit generation
- `backend/app/training/templates.py` — industry template seed data
- `backend/app/training/router.py` — worker-facing /training routes
- `backend/tests/test_staff.py`
- `backend/tests/test_training.py`

**Modified files:**
- `backend/app/auth/utils.py` — add `role` param to `create_access_token`, add `decode_token_role`
- `backend/app/auth/schemas.py` — add `role` to `LoginRequest`, update `TokenResponse`
- `backend/app/auth/router.py` — extend `/login` to handle worker role
- `backend/app/auth/deps.py` — add `get_current_worker` dependency
- `backend/app/main.py` — register staff and training routers
- `backend/tests/conftest.py` — import new models so `create_all` builds their tables

---

## Task 1: Worker model + migration 007

**Files:**
- Create: `backend/app/models/worker.py`
- Create: `backend/alembic/versions/007_add_workers_table.py`

- [ ] **Step 1: Write the Worker model**

`backend/app/models/worker.py`:
```python
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class Worker(Base):
    __tablename__ = "workers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Write migration 007**

`backend/alembic/versions/007_add_workers_table.py`:
```python
"""add workers table

Revision ID: 007
Revises: 006
Create Date: 2026-04-11 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '007'
down_revision: Union[str, None] = '006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'workers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('role_name', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_workers_business_id', 'workers', ['business_id'])
    op.create_index('ix_workers_email', 'workers', ['email'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_workers_email', table_name='workers')
    op.drop_index('ix_workers_business_id', table_name='workers')
    op.drop_table('workers')
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/worker.py backend/alembic/versions/007_add_workers_table.py
git commit -m "feat: add Worker model and migration 007"
```

---

## Task 2: Training models + migration 008

**Files:**
- Create: `backend/app/models/training.py`
- Create: `backend/alembic/versions/008_add_training_tables.py`

- [ ] **Step 1: Write training models**

`backend/app/models/training.py`:
```python
import uuid
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.sql import func
from app.database import Base


class TrainingTrack(Base):
    __tablename__ = "training_tracks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    role_name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TrainingModule(Base):
    __tablename__ = "training_modules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id = Column(UUID(as_uuid=True), ForeignKey("training_tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False)  # quiz | guide | scenario | video
    title = Column(String, nullable=False)
    content = Column(JSON, nullable=False)
    order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WorkerTrackAssignment(Base):
    __tablename__ = "worker_track_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = Column(UUID(as_uuid=True), ForeignKey("training_tracks.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())


class WorkerProgress(Base):
    __tablename__ = "worker_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False, index=True)
    module_id = Column(UUID(as_uuid=True), ForeignKey("training_modules.id", ondelete="CASCADE"), nullable=False)
    score = Column(Integer, nullable=True)  # null for non-quiz; 0-100 for quizzes
    completed_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Write migration 008**

`backend/alembic/versions/008_add_training_tables.py`:
```python
"""add training tables

Revision ID: 008
Revises: 007
Create Date: 2026-04-11 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '008'
down_revision: Union[str, None] = '007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'training_tracks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('role_name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_training_tracks_business_id', 'training_tracks', ['business_id'])

    op.create_table(
        'training_modules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('track_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('training_tracks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('content', postgresql.JSON(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_training_modules_track_id', 'training_modules', ['track_id'])

    op.create_table(
        'worker_track_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('worker_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('track_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('training_tracks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_worker_track_assignments_worker_id', 'worker_track_assignments', ['worker_id'])

    op.create_table(
        'worker_progress',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('worker_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('module_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('training_modules.id', ondelete='CASCADE'), nullable=False),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_worker_progress_worker_id', 'worker_progress', ['worker_id'])


def downgrade() -> None:
    op.drop_index('ix_worker_progress_worker_id', table_name='worker_progress')
    op.drop_table('worker_progress')
    op.drop_index('ix_worker_track_assignments_worker_id', table_name='worker_track_assignments')
    op.drop_table('worker_track_assignments')
    op.drop_index('ix_training_modules_track_id', table_name='training_modules')
    op.drop_table('training_modules')
    op.drop_index('ix_training_tracks_business_id', table_name='training_tracks')
    op.drop_table('training_tracks')
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/training.py backend/alembic/versions/008_add_training_tables.py
git commit -m "feat: add training models and migration 008"
```

---

## Task 3: ModuleFlag model + migration 009

**Files:**
- Modify: `backend/app/models/training.py`
- Create: `backend/alembic/versions/009_add_module_flags_table.py`

- [ ] **Step 1: Add ModuleFlag to training models**

Append to `backend/app/models/training.py`:
```python
class ModuleFlag(Base):
    __tablename__ = "module_flags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False, index=True)
    module_id = Column(UUID(as_uuid=True), ForeignKey("training_modules.id", ondelete="CASCADE"), nullable=False, index=True)
    flagged_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Write migration 009**

`backend/alembic/versions/009_add_module_flags_table.py`:
```python
"""add module_flags table

Revision ID: 009
Revises: 008
Create Date: 2026-04-11 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '009'
down_revision: Union[str, None] = '008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'module_flags',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('worker_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('module_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('training_modules.id', ondelete='CASCADE'), nullable=False),
        sa.Column('flagged_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_module_flags_worker_id', 'module_flags', ['worker_id'])
    op.create_index('ix_module_flags_module_id', 'module_flags', ['module_id'])


def downgrade() -> None:
    op.drop_index('ix_module_flags_module_id', table_name='module_flags')
    op.drop_index('ix_module_flags_worker_id', table_name='module_flags')
    op.drop_table('module_flags')
```

- [ ] **Step 3: Update conftest to import new models**

In `backend/tests/conftest.py`, add imports before `Base.metadata.create_all` so the new tables are registered:

```python
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
import app.models.worker  # noqa: F401
import app.models.training  # noqa: F401

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "postgresql://cipuser:cippass@localhost:5432/cip_test")

@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db(test_engine):
    Session = sessionmaker(bind=test_engine)
    session = Session()
    yield session
    session.rollback()
    session.close()
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/training.py backend/alembic/versions/009_add_module_flags_table.py backend/tests/conftest.py
git commit -m "feat: add ModuleFlag model, migration 009, update conftest"
```

---

## Task 4: Auth extension — worker role in JWT

**Files:**
- Modify: `backend/app/auth/utils.py`
- Modify: `backend/app/auth/schemas.py`
- Modify: `backend/app/auth/router.py`
- Modify: `backend/app/auth/deps.py`

- [ ] **Step 1: Write failing test for worker login**

`backend/tests/test_worker_auth.py`:
```python
import uuid
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.worker import Worker
from app.auth.utils import hash_password

client = TestClient(app)


def _fake_worker():
    w = MagicMock(spec=Worker)
    w.id = uuid.uuid4()
    w.email = "worker@example.com"
    w.hashed_password = hash_password("password1")
    w.name = "Marcus"
    w.role_name = "Server"
    w.business_id = uuid.uuid4()
    return w


def test_worker_login_returns_token():
    worker = _fake_worker()
    with patch("app.auth.router.get_db") as mock_get_db:
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = worker
        mock_get_db.return_value = mock_db
        response = client.post("/auth/login", json={
            "email": "worker@example.com",
            "password": "password1",
            "role": "worker",
        })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "worker"
    assert data["name"] == "Marcus"
    assert data["role_name"] == "Server"


def test_worker_login_wrong_password():
    worker = _fake_worker()
    with patch("app.auth.router.get_db") as mock_get_db:
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = worker
        mock_get_db.return_value = mock_db
        response = client.post("/auth/login", json={
            "email": "worker@example.com",
            "password": "wrongpass",
            "role": "worker",
        })
    assert response.status_code == 401


def test_owner_login_still_works():
    response = client.post("/auth/login", json={
        "email": "owner@example.com",
        "password": "password1",
    })
    # Will 401 (no real user) but should not 422
    assert response.status_code in (200, 401)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_worker_auth.py -v
```

Expected: FAIL — `role` field not accepted, no `role` in response

- [ ] **Step 3: Update auth/utils.py**

Replace `backend/app/auth/utils.py` with:
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


def create_access_token(user_id: str, role: str = "owner") -> str:
    expire = datetime.utcnow() + timedelta(days=settings.jwt_expire_days)
    payload = {"sub": user_id, "exp": expire, "role": role}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> str:
    """Returns user_id (str) or raises JWTError."""
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    return payload["sub"]


def decode_token_role(token: str) -> str:
    """Returns role claim from token, defaults to 'owner' for legacy tokens."""
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    return payload.get("role", "owner")
```

- [ ] **Step 4: Update auth/schemas.py**

Replace `backend/app/auth/schemas.py` with:
```python
from typing import Literal, Optional
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
    role: Literal['owner', 'worker'] = 'owner'


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str = "owner"
    business_name: Optional[str] = None
    name: Optional[str] = None
    role_name: Optional[str] = None
```

- [ ] **Step 5: Update auth/router.py — extend login to handle workers**

Replace `backend/app/auth/router.py` with:
```python
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.worker import Worker
from app.models.error_log import ErrorLog
from app.auth.schemas import RegisterRequest, LoginRequest, TokenResponse
from app.auth.utils import hash_password, verify_password, create_access_token
from app.core.errors import log_error, resolve_errors, resolve_errors_by_email
from app.core.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

LOCKOUT_ATTEMPTS = 10
LOCKOUT_WINDOW_MINUTES = 15


def _check_brute_force(db: Session, email: str) -> None:
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


def _worker_login(db: Session, email: str, password: str) -> TokenResponse:
    worker = db.query(Worker).filter(Worker.email == email).first()
    if not worker or not verify_password(password, worker.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(worker.id), role="worker")
    return TokenResponse(
        access_token=token,
        user_id=str(worker.id),
        role="worker",
        name=worker.name,
        role_name=worker.role_name,
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
    token = create_access_token(str(user.id), role="owner")
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        role="owner",
        business_name=user.business_name,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    if body.role == "worker":
        return _worker_login(db, body.email, body.password)
    _check_brute_force(db, body.email)
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        log_error(
            db, "auth_login", Exception("invalid credentials"),
            user_id=user.id if user else None,
            context={"email": body.email},
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")
    resolve_errors(db, "auth_login", user_id=user.id)
    resolve_errors_by_email(db, "auth_login", email=body.email)
    token = create_access_token(str(user.id), role="owner")
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        role="owner",
        business_name=user.business_name,
    )
```

- [ ] **Step 6: Add get_current_worker to auth/deps.py**

Replace `backend/app/auth/deps.py` with:
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError
from app.database import get_db
from app.models.user import User
from app.models.worker import Worker
from app.auth.utils import decode_token, decode_token_role

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


def get_current_worker(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> Worker:
    try:
        user_id = decode_token(credentials.credentials)
        role = decode_token_role(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if role != "worker":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Worker access required")
    worker = db.query(Worker).filter(Worker.id == user_id).first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Worker not found")
    return worker
```

- [ ] **Step 7: Run tests**

```bash
cd backend && pytest tests/test_worker_auth.py tests/test_security.py -v
```

Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/auth/utils.py backend/app/auth/schemas.py backend/app/auth/router.py backend/app/auth/deps.py backend/tests/test_worker_auth.py
git commit -m "feat: extend auth to support worker role in JWT"
```

---

## Task 5: Industry templates seed data

**Files:**
- Create: `backend/app/training/__init__.py`
- Create: `backend/app/training/templates.py`

- [ ] **Step 1: Create the training package**

`backend/app/training/__init__.py` — empty file.

- [ ] **Step 2: Write templates.py**

`backend/app/training/templates.py`:
```python
"""
Industry template seed data. Each template produces a list of module dicts
ready to insert as TrainingModule rows (minus track_id and id).
"""

TEMPLATES: dict[str, dict[str, list[dict]]] = {
    "restaurant": {
        "server": [
            {
                "type": "guide",
                "title": "Day One: What Every Server Needs to Know",
                "content": {
                    "text": (
                        "## Welcome\n\n"
                        "Your job is to make guests feel taken care of. Here's what matters most:\n\n"
                        "**Taking the order**\n"
                        "- Greet the table within 2 minutes of them sitting down\n"
                        "- Offer specials and ask about allergies before taking food orders\n"
                        "- Repeat the order back to confirm\n\n"
                        "**At the table**\n"
                        "- Check back 2 minutes after food arrives — not before\n"
                        "- Refill drinks before they're empty\n"
                        "- Clear plates when everyone at the table is done, not before\n\n"
                        "**The check**\n"
                        "- Never make a guest ask twice for the check\n"
                        "- Say 'I'll take that when you're ready' — not 'No rush'\n\n"
                        "When in doubt, ask a teammate. Nobody expects you to know everything on day one."
                    )
                },
                "order": 0,
            },
            {
                "type": "quiz",
                "title": "Quick Knowledge Check",
                "content": {
                    "questions": [
                        {
                            "question": "When should you greet a table after they sit down?",
                            "options": ["Within 2 minutes", "When they wave at you", "After 5 minutes", "When you finish your current table"],
                            "correct_index": 0,
                        },
                        {
                            "question": "When is the right time to clear a guest's plate?",
                            "options": ["As soon as they finish eating", "When everyone at the table is done", "After 10 minutes", "When they ask"],
                            "correct_index": 1,
                        },
                        {
                            "question": "A guest mentions they have a nut allergy. What do you do first?",
                            "options": ["Note it and tell the kitchen immediately", "Ask them to check the menu themselves", "Ignore it if they don't order nuts", "Tell the manager after the meal"],
                            "correct_index": 0,
                        },
                    ]
                },
                "order": 1,
            },
            {
                "type": "scenario",
                "title": "Real Situation: Unhappy Guest",
                "content": {
                    "situation": "A guest tells you their steak is overcooked. They seem frustrated. What do you do?",
                    "options": [
                        "Apologize sincerely, take the plate back, and tell them you'll have a new one out quickly",
                        "Tell them the kitchen is busy tonight and it might take a while to fix",
                        "Ask them if they're sure it's overcooked",
                    ],
                    "best_index": 0,
                    "explanation": "Always acknowledge the problem immediately and take action. A sincere apology + a quick fix turns most complaints around. Excuses or doubt make it worse.",
                },
                "order": 2,
            },
        ],
        "host": [
            {
                "type": "guide",
                "title": "Day One: Hosting Fundamentals",
                "content": {
                    "text": (
                        "## Your Role\n\n"
                        "You set the tone for the entire guest experience. The first 30 seconds matter.\n\n"
                        "**When guests arrive**\n"
                        "- Make eye contact and greet them within 10 seconds of entering\n"
                        "- 'Welcome in! How many in your party?' — simple and warm\n"
                        "- If there's a wait, give an honest time estimate\n\n"
                        "**Seating**\n"
                        "- Seat tables in rotation to keep servers from getting slammed\n"
                        "- Walk at the guest's pace, not yours\n"
                        "- Lay menus at each seat before leaving\n\n"
                        "**Managing the wait**\n"
                        "- Update waiting guests every 10 minutes if the wait is longer than expected\n"
                        "- Never promise a table time you can't deliver"
                    )
                },
                "order": 0,
            },
            {
                "type": "quiz",
                "title": "Quick Knowledge Check",
                "content": {
                    "questions": [
                        {
                            "question": "How soon should you greet guests after they walk in?",
                            "options": ["Within 10 seconds", "When you finish seating another table", "When they reach the host stand", "After a minute"],
                            "correct_index": 0,
                        },
                        {
                            "question": "Why do you seat tables in rotation?",
                            "options": ["To keep servers from getting overwhelmed all at once", "Because the manager said so", "To fill tables from front to back", "To give guests the best seats"],
                            "correct_index": 0,
                        },
                    ]
                },
                "order": 1,
            },
        ],
        "busser": [
            {
                "type": "guide",
                "title": "Day One: Bussing Basics",
                "content": {
                    "text": (
                        "## Your Job\n\n"
                        "A clean table turns faster. You keep the whole restaurant moving.\n\n"
                        "**Clearing a table**\n"
                        "- Clear only after ALL guests have finished and the server gives the go-ahead\n"
                        "- Stack plates quietly — no clanging\n"
                        "- Wipe down the table and seats before resetting\n\n"
                        "**Resetting**\n"
                        "- Replace napkins, silverware, and glasses exactly as the template shows\n"
                        "- Report any broken items to the server before the table is reseated\n\n"
                        "**During service**\n"
                        "- Refill water glasses without being asked\n"
                        "- Keep the busstation clean — your teammates depend on it"
                    )
                },
                "order": 0,
            },
        ],
    },
    "salon": {
        "stylist": [
            {
                "type": "guide",
                "title": "Day One: The Client Experience",
                "content": {
                    "text": (
                        "## First Impressions\n\n"
                        "Clients choose you because they trust you with something personal. Honor that.\n\n"
                        "**The consultation**\n"
                        "- Ask open questions: 'What are you going for?' before suggesting anything\n"
                        "- Confirm your understanding: 'So you want to take off about two inches and add layers — does that sound right?'\n"
                        "- Never start cutting until the client has nodded yes\n\n"
                        "**During the service**\n"
                        "- Keep conversation light unless the client goes quiet — then match their energy\n"
                        "- If something doesn't look right mid-service, say so calmly rather than hoping they won't notice\n\n"
                        "**Wrapping up**\n"
                        "- Show them the back with a mirror\n"
                        "- Recommend one product maximum — not a full routine\n"
                        "- Book the next appointment before they leave the chair"
                    )
                },
                "order": 0,
            },
            {
                "type": "quiz",
                "title": "Quick Knowledge Check",
                "content": {
                    "questions": [
                        {
                            "question": "What should you do before you start cutting a client's hair?",
                            "options": ["Confirm exactly what they want and get a clear yes", "Just start — you're the professional", "Ask the manager", "Show them a photo from Instagram"],
                            "correct_index": 0,
                        },
                        {
                            "question": "A client seems quiet during their service. What do you do?",
                            "options": ["Match their energy and give them space", "Keep talking to fill the silence", "Ask if something is wrong", "Speed up so they can leave sooner"],
                            "correct_index": 0,
                        },
                    ]
                },
                "order": 1,
            },
            {
                "type": "scenario",
                "title": "Real Situation: Client Unhappy With Result",
                "content": {
                    "situation": "A client looks in the mirror and seems unhappy, but doesn't say anything. What do you do?",
                    "options": [
                        "Ask directly: 'How are you feeling about it? I want to make sure you love it'",
                        "Stay quiet — if they don't say anything, they're probably fine",
                        "Tell them it looks great and start the checkout",
                    ],
                    "best_index": 0,
                    "explanation": "Most clients won't speak up unless you ask. A direct, caring question gives them permission to be honest — and gives you the chance to fix it before they leave unhappy.",
                },
                "order": 2,
            },
        ],
        "receptionist": [
            {
                "type": "guide",
                "title": "Day One: Front Desk Fundamentals",
                "content": {
                    "text": (
                        "## You Run the Front\n\n"
                        "Every client interaction starts and ends with you.\n\n"
                        "**Check-in**\n"
                        "- Greet every client by name if you know it — it matters more than you think\n"
                        "- Let the stylist know within 1 minute of the client arriving\n"
                        "- Offer water or a seat if there's a short wait\n\n"
                        "**Booking**\n"
                        "- Always confirm date, time, service, and stylist before ending the call\n"
                        "- If a time slot is unavailable, offer the two closest alternatives — not a list of options\n\n"
                        "**Checkout**\n"
                        "- Remind clients about rebooking: 'Would you like to book your next appointment now?'\n"
                        "- Process payment fully before the client walks out"
                    )
                },
                "order": 0,
            },
        ],
    },
    "retail": {
        "sales_associate": [
            {
                "type": "guide",
                "title": "Day One: Helping Customers on the Floor",
                "content": {
                    "text": (
                        "## Your Role\n\n"
                        "You make the store experience feel helpful, not pushy.\n\n"
                        "**Approaching customers**\n"
                        "- Give them 30 seconds to look around before approaching\n"
                        "- Open with a specific observation: 'That jacket you're looking at is one of our most popular' beats 'Can I help you?'\n"
                        "- If they say 'just browsing', say 'No problem — I'm around if anything catches your eye' and give them space\n\n"
                        "**Helping them decide**\n"
                        "- Ask about the occasion or who it's for — context helps you recommend the right thing\n"
                        "- Suggest at most two options, not five\n\n"
                        "**At the register**\n"
                        "- Mention one relevant add-on only if it genuinely makes sense\n"
                        "- Thank them by name if you got it during the transaction"
                    )
                },
                "order": 0,
            },
            {
                "type": "quiz",
                "title": "Quick Knowledge Check",
                "content": {
                    "questions": [
                        {
                            "question": "A customer says 'just browsing.' What's the best response?",
                            "options": [
                                "'No problem — I'm around if anything catches your eye'",
                                "Walk away and ignore them",
                                "Keep following them in case they need help",
                                "Tell them about your current promotions",
                            ],
                            "correct_index": 0,
                        },
                        {
                            "question": "How many product options should you suggest when helping a customer decide?",
                            "options": ["Two at most", "As many as possible so they have choices", "Just one", "Five — let them pick"],
                            "correct_index": 0,
                        },
                    ]
                },
                "order": 1,
            },
        ],
        "cashier": [
            {
                "type": "guide",
                "title": "Day One: Register Basics",
                "content": {
                    "text": (
                        "## The Register\n\n"
                        "Fast, accurate, and friendly — that's the goal.\n\n"
                        "**Each transaction**\n"
                        "- Greet the customer as they approach\n"
                        "- Scan items without rushing — errors slow everything down\n"
                        "- Announce the total clearly before they tap or swipe\n"
                        "- Give change back in bills first, then coins\n\n"
                        "**Common situations**\n"
                        "- Price discrepancy: call a manager, don't guess\n"
                        "- Return without receipt: follow the store policy exactly, no exceptions\n"
                        "- Long line behind a slow transaction: stay calm, don't rush the customer in front of you\n\n"
                        "**End of shift**\n"
                        "- Count your drawer before leaving — discrepancies need to be found before you go"
                    )
                },
                "order": 0,
            },
        ],
    },
}


def get_templates_list() -> list[dict]:
    """Return a flat list of available templates for the owner to browse."""
    result = []
    for industry, roles in TEMPLATES.items():
        for role_key, modules in roles.items():
            result.append({
                "industry": industry,
                "role_key": role_key,
                "display_name": f"{industry.title()} — {role_key.replace('_', ' ').title()}",
                "module_count": len(modules),
            })
    return result


def get_template_modules(industry: str, role_key: str) -> list[dict] | None:
    """Return module dicts for a given industry + role, or None if not found."""
    return TEMPLATES.get(industry, {}).get(role_key)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/training/__init__.py backend/app/training/templates.py
git commit -m "feat: add industry template seed data for restaurant, salon, retail"
```

---

## Task 6: AI generation service

**Files:**
- Create: `backend/app/training/ai.py`

- [ ] **Step 1: Write failing test**

`backend/tests/test_training_ai.py`:
```python
from unittest.mock import patch, MagicMock
from app.training.ai import generate_starter_kit


def _mock_claude_response(text: str):
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


def test_generate_starter_kit_returns_three_modules():
    fake_json = '''
    {
        "quiz": {
            "title": "Quick Check",
            "questions": [
                {"question": "Q1?", "options": ["A", "B", "C"], "correct_index": 0}
            ]
        },
        "guide": {
            "title": "Day One Guide",
            "text": "Welcome to the team."
        },
        "scenario": {
            "title": "Scenario Practice",
            "situation": "A guest is upset.",
            "options": ["Apologize", "Argue", "Ignore"],
            "best_index": 0,
            "explanation": "Always apologize first."
        }
    }
    '''
    with patch("app.training.ai.anthropic.Anthropic") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_claude_response(fake_json)
        modules = generate_starter_kit("restaurant", "Server")

    assert len(modules) == 3
    types = {m["type"] for m in modules}
    assert types == {"quiz", "guide", "scenario"}


def test_generate_starter_kit_invalid_json_raises():
    with patch("app.training.ai.anthropic.Anthropic") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_claude_response("not json at all")
        try:
            generate_starter_kit("restaurant", "Server")
            assert False, "Expected ValueError"
        except ValueError:
            pass
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_training_ai.py -v
```

Expected: FAIL — `app.training.ai` does not exist

- [ ] **Step 3: Write the AI service**

`backend/app/training/ai.py`:
```python
import json
import re
import anthropic


_PROMPT_TEMPLATE = """\
Business type: {business_type}
Role: {role_name}

Generate a lightweight training starter kit for a new {role_name} at a {business_type}.

Return ONLY a valid JSON object with this exact structure (no markdown, no commentary):
{{
  "quiz": {{
    "title": "Quick Knowledge Check",
    "questions": [
      {{"question": "...", "options": ["...", "...", "..."], "correct_index": 0}}
    ]
  }},
  "guide": {{
    "title": "Day One: What You Need to Know",
    "text": "..."
  }},
  "scenario": {{
    "title": "Real Situation Practice",
    "situation": "...",
    "options": ["...", "...", "..."],
    "best_index": 0,
    "explanation": "..."
  }}
}}

Rules:
- 3 to 5 quiz questions
- Guide under 200 words, plain language, use markdown headers and bullet points
- Scenario with exactly 3 options
- Tone: friendly and encouraging — this helps someone get comfortable, not pass an exam
"""


def generate_starter_kit(business_type: str, role_name: str) -> list[dict]:
    """
    Call Claude to generate a starter training kit.
    Returns a list of 3 module dicts (quiz, guide, scenario) ready to insert.
    Raises ValueError if Claude returns unparseable JSON.
    """
    prompt = _PROMPT_TEMPLATE.format(
        business_type=business_type,
        role_name=role_name,
    )

    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()

    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude returned invalid JSON: {e}\nRaw: {raw[:200]}")

    modules = []
    for order, (key, module_type) in enumerate([("quiz", "quiz"), ("guide", "guide"), ("scenario", "scenario")]):
        section = data.get(key)
        if not section:
            raise ValueError(f"Claude response missing '{key}' section")
        modules.append({
            "type": module_type,
            "title": section.get("title", f"{module_type.title()} Module"),
            "content": {k: v for k, v in section.items() if k != "title"},
            "order": order,
        })

    return modules
```

- [ ] **Step 4: Run tests**

```bash
cd backend && pytest tests/test_training_ai.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/training/ai.py backend/tests/test_training_ai.py
git commit -m "feat: add AI training starter kit generation"
```

---

## Task 7: Staff router (owner-facing routes)

**Files:**
- Create: `backend/app/staff/__init__.py`
- Create: `backend/app/staff/schemas.py`
- Create: `backend/app/staff/router.py`
- Create: `backend/tests/test_staff.py`

- [ ] **Step 1: Write schemas**

`backend/app/staff/schemas.py`:
```python
from typing import Optional
from pydantic import BaseModel, EmailStr
import uuid


class CreateWorkerRequest(BaseModel):
    name: str
    email: EmailStr
    role_name: str
    password: str


class WorkerResponse(BaseModel):
    id: str
    name: str
    email: str
    role_name: str
    business_id: str
    created_at: str

    @classmethod
    def from_orm(cls, w) -> "WorkerResponse":
        return cls(
            id=str(w.id),
            name=w.name,
            email=w.email,
            role_name=w.role_name,
            business_id=str(w.business_id),
            created_at=w.created_at.isoformat() if w.created_at else "",
        )


class CreateTrackRequest(BaseModel):
    title: str
    role_name: str
    description: Optional[str] = None


class TrackResponse(BaseModel):
    id: str
    title: str
    role_name: str
    description: Optional[str]
    business_id: str

    @classmethod
    def from_orm(cls, t) -> "TrackResponse":
        return cls(
            id=str(t.id),
            title=t.title,
            role_name=t.role_name,
            description=t.description,
            business_id=str(t.business_id),
        )


class CreateModuleRequest(BaseModel):
    type: str  # quiz | guide | scenario | video
    title: str
    content: dict
    order: int = 0


class ModuleResponse(BaseModel):
    id: str
    track_id: str
    type: str
    title: str
    content: dict
    order: int
    flag_count: int = 0

    @classmethod
    def from_orm(cls, m, flag_count: int = 0) -> "ModuleResponse":
        return cls(
            id=str(m.id),
            track_id=str(m.track_id),
            type=m.type,
            title=m.title,
            content=m.content,
            order=m.order,
            flag_count=flag_count,
        )


class AssignTrackRequest(BaseModel):
    track_id: str


class WorkerProgressResponse(BaseModel):
    worker_id: str
    total_modules: int
    completed_modules: int
    progress_pct: int
    modules: list[dict]
```

- [ ] **Step 2: Write the staff router**

`backend/app/staff/__init__.py` — empty file.

`backend/app/staff/router.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.deps import get_current_user
from app.auth.utils import hash_password
from app.models.user import User
from app.models.worker import Worker
from app.models.training import (
    TrainingTrack, TrainingModule, WorkerTrackAssignment, WorkerProgress, ModuleFlag
)
from app.staff.schemas import (
    CreateWorkerRequest, WorkerResponse,
    CreateTrackRequest, TrackResponse,
    CreateModuleRequest, ModuleResponse,
    AssignTrackRequest, WorkerProgressResponse,
)
from app.training.templates import get_templates_list, get_template_modules
from app.training.ai import generate_starter_kit
import uuid

router = APIRouter(prefix="/staff", tags=["staff"])


@router.post("/workers", response_model=WorkerResponse, status_code=201)
def create_worker(
    body: CreateWorkerRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if db.query(Worker).filter(Worker.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already in use")
    worker = Worker(
        business_id=user.id,
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        role_name=body.role_name,
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return WorkerResponse.from_orm(worker)


@router.get("/workers", response_model=list[WorkerResponse])
def list_workers(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workers = db.query(Worker).filter(Worker.business_id == user.id).all()
    return [WorkerResponse.from_orm(w) for w in workers]


@router.post("/tracks", response_model=TrackResponse, status_code=201)
def create_track(
    body: CreateTrackRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    track = TrainingTrack(
        business_id=user.id,
        title=body.title,
        role_name=body.role_name,
        description=body.description,
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    return TrackResponse.from_orm(track)


@router.get("/tracks", response_model=list[TrackResponse])
def list_tracks(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tracks = db.query(TrainingTrack).filter(TrainingTrack.business_id == user.id).all()
    return [TrackResponse.from_orm(t) for t in tracks]


@router.get("/templates")
def list_templates(user: User = Depends(get_current_user)):
    return get_templates_list()


@router.post("/tracks/{track_id}/load-template", response_model=list[ModuleResponse])
def load_template(
    track_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    track = db.query(TrainingTrack).filter(
        TrainingTrack.id == track_id,
        TrainingTrack.business_id == user.id,
    ).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    industry = body.get("industry")
    role_key = body.get("role_key")
    module_dicts = get_template_modules(industry, role_key)
    if not module_dicts:
        raise HTTPException(status_code=404, detail="Template not found")

    modules = []
    for m in module_dicts:
        module = TrainingModule(
            track_id=track.id,
            type=m["type"],
            title=m["title"],
            content=m["content"],
            order=m["order"],
        )
        db.add(module)
        modules.append(module)
    db.commit()
    for m in modules:
        db.refresh(m)
    return [ModuleResponse.from_orm(m) for m in modules]


@router.post("/tracks/{track_id}/modules", response_model=ModuleResponse, status_code=201)
def add_module(
    track_id: str,
    body: CreateModuleRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    track = db.query(TrainingTrack).filter(
        TrainingTrack.id == track_id,
        TrainingTrack.business_id == user.id,
    ).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    module = TrainingModule(
        track_id=track.id,
        type=body.type,
        title=body.title,
        content=body.content,
        order=body.order,
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return ModuleResponse.from_orm(module)


@router.put("/modules/{module_id}", response_model=ModuleResponse)
def edit_module(
    module_id: str,
    body: CreateModuleRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    module = (
        db.query(TrainingModule)
        .join(TrainingTrack, TrainingModule.track_id == TrainingTrack.id)
        .filter(TrainingModule.id == module_id, TrainingTrack.business_id == user.id)
        .first()
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    module.type = body.type
    module.title = body.title
    module.content = body.content
    module.order = body.order
    db.commit()
    db.refresh(module)
    return ModuleResponse.from_orm(module)


@router.delete("/modules/{module_id}", status_code=204)
def delete_module(
    module_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    module = (
        db.query(TrainingModule)
        .join(TrainingTrack, TrainingModule.track_id == TrainingTrack.id)
        .filter(TrainingModule.id == module_id, TrainingTrack.business_id == user.id)
        .first()
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    db.delete(module)
    db.commit()


@router.patch("/modules/{module_id}/reorder", response_model=ModuleResponse)
def reorder_module(
    module_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    module = (
        db.query(TrainingModule)
        .join(TrainingTrack, TrainingModule.track_id == TrainingTrack.id)
        .filter(TrainingModule.id == module_id, TrainingTrack.business_id == user.id)
        .first()
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    module.order = body.get("order", module.order)
    db.commit()
    db.refresh(module)
    return ModuleResponse.from_orm(module)


@router.post("/tracks/{track_id}/generate", response_model=list[ModuleResponse])
def generate_track(
    track_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    track = db.query(TrainingTrack).filter(
        TrainingTrack.id == track_id,
        TrainingTrack.business_id == user.id,
    ).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    business_type = user.business_name or "small business"
    try:
        module_dicts = generate_starter_kit(business_type, track.role_name)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    modules = []
    for m in module_dicts:
        module = TrainingModule(
            track_id=track.id,
            type=m["type"],
            title=m["title"],
            content=m["content"],
            order=m["order"],
        )
        db.add(module)
        modules.append(module)
    db.commit()
    for m in modules:
        db.refresh(m)
    return [ModuleResponse.from_orm(m) for m in modules]


@router.post("/workers/{worker_id}/assign", status_code=200)
def assign_track(
    worker_id: str,
    body: AssignTrackRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    worker = db.query(Worker).filter(
        Worker.id == worker_id,
        Worker.business_id == user.id,
    ).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    track = db.query(TrainingTrack).filter(
        TrainingTrack.id == body.track_id,
        TrainingTrack.business_id == user.id,
    ).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    existing = db.query(WorkerTrackAssignment).filter(
        WorkerTrackAssignment.worker_id == worker.id
    ).first()
    if existing:
        existing.track_id = track.id
    else:
        db.add(WorkerTrackAssignment(worker_id=worker.id, track_id=track.id))
    db.commit()
    return {"status": "assigned"}


@router.get("/workers/{worker_id}/progress", response_model=WorkerProgressResponse)
def worker_progress(
    worker_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    worker = db.query(Worker).filter(
        Worker.id == worker_id,
        Worker.business_id == user.id,
    ).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    assignment = db.query(WorkerTrackAssignment).filter(
        WorkerTrackAssignment.worker_id == worker.id
    ).first()
    if not assignment:
        return WorkerProgressResponse(
            worker_id=str(worker.id),
            total_modules=0,
            completed_modules=0,
            progress_pct=0,
            modules=[],
        )

    modules = db.query(TrainingModule).filter(
        TrainingModule.track_id == assignment.track_id
    ).order_by(TrainingModule.order).all()

    progress_rows = db.query(WorkerProgress).filter(
        WorkerProgress.worker_id == worker.id
    ).all()
    completed_ids = {str(p.module_id) for p in progress_rows}
    score_map = {str(p.module_id): p.score for p in progress_rows}

    flag_rows = db.query(ModuleFlag).filter(ModuleFlag.worker_id == worker.id).all()
    flag_ids = {str(f.module_id) for f in flag_rows}

    module_details = []
    for m in modules:
        mid = str(m.id)
        flag_count = db.query(ModuleFlag).filter(ModuleFlag.module_id == m.id).count()
        module_details.append({
            "module_id": mid,
            "title": m.title,
            "type": m.type,
            "completed": mid in completed_ids,
            "score": score_map.get(mid),
            "flagged": mid in flag_ids,
            "flag_count": flag_count,
        })

    total = len(modules)
    completed = len(completed_ids)
    pct = round((completed / total) * 100) if total > 0 else 0

    return WorkerProgressResponse(
        worker_id=str(worker.id),
        total_modules=total,
        completed_modules=completed,
        progress_pct=pct,
        modules=module_details,
    )
```

- [ ] **Step 3: Write failing tests**

`backend/tests/test_staff.py`:
```python
import uuid
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth.deps import get_current_user
from app.models.user import User

FAKE_USER_ID = uuid.uuid4()


def _fake_owner():
    user = MagicMock(spec=User)
    user.id = FAKE_USER_ID
    user.email = "owner@example.com"
    user.business_name = "Test Salon"
    return user


def test_create_worker_returns_201():
    app.dependency_overrides[get_current_user] = _fake_owner
    try:
        client = TestClient(app)
        with patch("app.staff.router.db") as _:
            with patch("app.staff.router.Worker") as MockWorker:
                fake_worker = MagicMock()
                fake_worker.id = uuid.uuid4()
                fake_worker.name = "Marcus"
                fake_worker.email = "marcus@example.com"
                fake_worker.role_name = "Server"
                fake_worker.business_id = FAKE_USER_ID
                fake_worker.created_at = None

                # Mock the db flow via dependency override on get_db
                from app.database import get_db
                mock_db = MagicMock()
                mock_db.query.return_value.filter.return_value.first.return_value = None
                mock_db.refresh.side_effect = lambda x: None
                app.dependency_overrides[get_db] = lambda: mock_db

                MockWorker.return_value = fake_worker
                response = client.post(
                    "/staff/workers",
                    json={"name": "Marcus", "email": "marcus@example.com", "role_name": "Server", "password": "pass1234"},
                    headers={"Authorization": "Bearer fake-token"},
                )
        assert response.status_code == 201
    finally:
        app.dependency_overrides.clear()


def test_list_workers_returns_200():
    app.dependency_overrides[get_current_user] = _fake_owner
    try:
        from app.database import get_db
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.all.return_value = []
        app.dependency_overrides[get_db] = lambda: mock_db
        client = TestClient(app)
        response = client.get("/staff/workers", headers={"Authorization": "Bearer fake-token"})
        assert response.status_code == 200
        assert response.json() == []
    finally:
        app.dependency_overrides.clear()


def test_create_track_returns_201():
    app.dependency_overrides[get_current_user] = _fake_owner
    try:
        from app.database import get_db
        from app.models.training import TrainingTrack
        fake_track = MagicMock(spec=TrainingTrack)
        fake_track.id = uuid.uuid4()
        fake_track.title = "Server Training"
        fake_track.role_name = "Server"
        fake_track.description = None
        fake_track.business_id = FAKE_USER_ID
        mock_db = MagicMock()
        mock_db.refresh.side_effect = lambda x: None
        app.dependency_overrides[get_db] = lambda: mock_db
        with patch("app.staff.router.TrainingTrack", return_value=fake_track):
            client = TestClient(app)
            response = client.post(
                "/staff/tracks",
                json={"title": "Server Training", "role_name": "Server"},
                headers={"Authorization": "Bearer fake-token"},
            )
        assert response.status_code == 201
    finally:
        app.dependency_overrides.clear()


def test_list_templates_returns_200():
    app.dependency_overrides[get_current_user] = _fake_owner
    try:
        client = TestClient(app)
        response = client.get("/staff/templates", headers={"Authorization": "Bearer fake-token"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "display_name" in data[0]
    finally:
        app.dependency_overrides.clear()


def test_staff_routes_require_auth():
    client = TestClient(app)
    assert client.get("/staff/workers").status_code == 403
    assert client.post("/staff/tracks", json={}).status_code == 403
    assert client.get("/staff/templates").status_code == 403
```

- [ ] **Step 4: Run tests**

```bash
cd backend && pytest tests/test_staff.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/staff/__init__.py backend/app/staff/schemas.py backend/app/staff/router.py backend/tests/test_staff.py
git commit -m "feat: add staff router with owner-facing worker and track management"
```

---

## Task 8: Training router (worker-facing routes)

**Files:**
- Create: `backend/app/training/schemas.py`
- Create: `backend/app/training/router.py`
- Create: `backend/tests/test_training.py`

- [ ] **Step 1: Write schemas**

`backend/app/training/schemas.py`:
```python
from typing import Optional
from pydantic import BaseModel


class ModuleItem(BaseModel):
    id: str
    title: str
    type: str
    content: dict
    order: int
    completed: bool
    score: Optional[int] = None


class MyTrackResponse(BaseModel):
    track_id: str
    title: str
    role_name: str
    total_modules: int
    completed_modules: int
    progress_pct: int
    modules: list[ModuleItem]


class CompleteModuleRequest(BaseModel):
    score: Optional[int] = None  # required for quiz type, null otherwise


class CompleteModuleResponse(BaseModel):
    module_id: str
    completed: bool
    score: Optional[int] = None


class FlagModuleResponse(BaseModel):
    module_id: str
    flagged: bool
```

- [ ] **Step 2: Write the training router**

`backend/app/training/router.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.deps import get_current_worker
from app.models.worker import Worker
from app.models.training import (
    TrainingTrack, TrainingModule, WorkerTrackAssignment, WorkerProgress, ModuleFlag
)
from app.training.schemas import (
    MyTrackResponse, ModuleItem,
    CompleteModuleRequest, CompleteModuleResponse,
    FlagModuleResponse,
)

router = APIRouter(prefix="/training", tags=["training"])


def _get_assignment_or_404(worker: Worker, db: Session) -> WorkerTrackAssignment:
    assignment = db.query(WorkerTrackAssignment).filter(
        WorkerTrackAssignment.worker_id == worker.id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="No training track assigned")
    return assignment


@router.get("/my-track", response_model=MyTrackResponse)
def my_track(
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    assignment = _get_assignment_or_404(worker, db)
    track = db.query(TrainingTrack).filter(TrainingTrack.id == assignment.track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    modules = db.query(TrainingModule).filter(
        TrainingModule.track_id == track.id
    ).order_by(TrainingModule.order).all()

    progress_rows = db.query(WorkerProgress).filter(
        WorkerProgress.worker_id == worker.id
    ).all()
    completed_ids = {str(p.module_id) for p in progress_rows}
    score_map = {str(p.module_id): p.score for p in progress_rows}

    module_items = [
        ModuleItem(
            id=str(m.id),
            title=m.title,
            type=m.type,
            content=m.content,
            order=m.order,
            completed=str(m.id) in completed_ids,
            score=score_map.get(str(m.id)),
        )
        for m in modules
    ]

    total = len(modules)
    completed = len(completed_ids)
    pct = round((completed / total) * 100) if total > 0 else 0

    return MyTrackResponse(
        track_id=str(track.id),
        title=track.title,
        role_name=track.role_name,
        total_modules=total,
        completed_modules=completed,
        progress_pct=pct,
        modules=module_items,
    )


@router.get("/my-progress")
def my_progress(
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    assignment = _get_assignment_or_404(worker, db)
    modules = db.query(TrainingModule).filter(
        TrainingModule.track_id == assignment.track_id
    ).order_by(TrainingModule.order).all()

    progress_rows = db.query(WorkerProgress).filter(
        WorkerProgress.worker_id == worker.id
    ).all()
    completed_map = {str(p.module_id): p for p in progress_rows}

    result = []
    for m in modules:
        mid = str(m.id)
        p = completed_map.get(mid)
        result.append({
            "module_id": mid,
            "title": m.title,
            "type": m.type,
            "completed": p is not None,
            "score": p.score if p else None,
        })
    return result


@router.post("/modules/{module_id}/complete", response_model=CompleteModuleResponse)
def complete_module(
    module_id: str,
    body: CompleteModuleRequest,
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    assignment = _get_assignment_or_404(worker, db)

    module = db.query(TrainingModule).filter(
        TrainingModule.id == module_id,
        TrainingModule.track_id == assignment.track_id,
    ).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    existing = db.query(WorkerProgress).filter(
        WorkerProgress.worker_id == worker.id,
        WorkerProgress.module_id == module.id,
    ).first()
    if existing:
        if body.score is not None:
            existing.score = body.score
        db.commit()
        return CompleteModuleResponse(module_id=module_id, completed=True, score=existing.score)

    progress = WorkerProgress(
        worker_id=worker.id,
        module_id=module.id,
        score=body.score,
    )
    db.add(progress)
    db.commit()
    return CompleteModuleResponse(module_id=module_id, completed=True, score=body.score)


@router.post("/modules/{module_id}/flag", response_model=FlagModuleResponse)
def flag_module(
    module_id: str,
    worker: Worker = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    assignment = _get_assignment_or_404(worker, db)

    module = db.query(TrainingModule).filter(
        TrainingModule.id == module_id,
        TrainingModule.track_id == assignment.track_id,
    ).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    already = db.query(ModuleFlag).filter(
        ModuleFlag.worker_id == worker.id,
        ModuleFlag.module_id == module.id,
    ).first()
    if not already:
        db.add(ModuleFlag(worker_id=worker.id, module_id=module.id))
        db.commit()

    return FlagModuleResponse(module_id=module_id, flagged=True)
```

- [ ] **Step 3: Write failing tests**

`backend/tests/test_training.py`:
```python
import uuid
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth.deps import get_current_worker
from app.models.worker import Worker
from app.database import get_db
from app.models.training import TrainingTrack, TrainingModule, WorkerTrackAssignment, WorkerProgress, ModuleFlag

FAKE_WORKER_ID = uuid.uuid4()
FAKE_TRACK_ID = uuid.uuid4()
FAKE_MODULE_ID = uuid.uuid4()
FAKE_BUSINESS_ID = uuid.uuid4()


def _fake_worker():
    w = MagicMock(spec=Worker)
    w.id = FAKE_WORKER_ID
    w.name = "Marcus"
    w.role_name = "Server"
    w.business_id = FAKE_BUSINESS_ID
    return w


def _fake_assignment():
    a = MagicMock(spec=WorkerTrackAssignment)
    a.worker_id = FAKE_WORKER_ID
    a.track_id = FAKE_TRACK_ID
    return a


def _fake_track():
    t = MagicMock(spec=TrainingTrack)
    t.id = FAKE_TRACK_ID
    t.title = "Server Training"
    t.role_name = "Server"
    return t


def _fake_module():
    m = MagicMock(spec=TrainingModule)
    m.id = FAKE_MODULE_ID
    m.title = "Quiz"
    m.type = "quiz"
    m.content = {"questions": []}
    m.order = 0
    m.track_id = FAKE_TRACK_ID
    return m


def test_my_track_returns_200():
    app.dependency_overrides[get_current_worker] = _fake_worker
    mock_db = MagicMock()

    def db_query_side_effect(model):
        q = MagicMock()
        if model is WorkerTrackAssignment:
            q.filter.return_value.first.return_value = _fake_assignment()
        elif model is TrainingTrack:
            q.filter.return_value.first.return_value = _fake_track()
        elif model is TrainingModule:
            q.filter.return_value.order_by.return_value.all.return_value = [_fake_module()]
        elif model is WorkerProgress:
            q.filter.return_value.all.return_value = []
        else:
            q.filter.return_value.all.return_value = []
        return q

    mock_db.query.side_effect = db_query_side_effect
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        client = TestClient(app)
        response = client.get("/training/my-track", headers={"Authorization": "Bearer fake-token"})
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Server Training"
        assert data["total_modules"] == 1
        assert data["progress_pct"] == 0
    finally:
        app.dependency_overrides.clear()


def test_complete_module_returns_200():
    app.dependency_overrides[get_current_worker] = _fake_worker
    mock_db = MagicMock()

    def db_query_side_effect(model):
        q = MagicMock()
        if model is WorkerTrackAssignment:
            q.filter.return_value.first.return_value = _fake_assignment()
        elif model is TrainingModule:
            q.filter.return_value.first.return_value = _fake_module()
        elif model is WorkerProgress:
            q.filter.return_value.first.return_value = None  # single .filter() call in router
        else:
            q.filter.return_value.first.return_value = None
        return q

    mock_db.query.side_effect = db_query_side_effect
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        client = TestClient(app)
        response = client.post(
            f"/training/modules/{FAKE_MODULE_ID}/complete",
            json={"score": 80},
            headers={"Authorization": "Bearer fake-token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["completed"] is True
        assert data["score"] == 80
    finally:
        app.dependency_overrides.clear()


def test_flag_module_returns_200():
    app.dependency_overrides[get_current_worker] = _fake_worker
    mock_db = MagicMock()

    def db_query_side_effect(model):
        q = MagicMock()
        if model is WorkerTrackAssignment:
            q.filter.return_value.first.return_value = _fake_assignment()
        elif model is TrainingModule:
            q.filter.return_value.first.return_value = _fake_module()
        elif model is ModuleFlag:
            q.filter.return_value.first.return_value = None  # single .filter() call in router
        else:
            q.filter.return_value.first.return_value = None
        return q

    mock_db.query.side_effect = db_query_side_effect
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        client = TestClient(app)
        response = client.post(
            f"/training/modules/{FAKE_MODULE_ID}/flag",
            headers={"Authorization": "Bearer fake-token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["flagged"] is True
    finally:
        app.dependency_overrides.clear()


def test_training_routes_require_worker_token():
    client = TestClient(app)
    assert client.get("/training/my-track").status_code == 403
    assert client.post(f"/training/modules/{FAKE_MODULE_ID}/complete", json={}).status_code == 403
```

- [ ] **Step 4: Run tests**

```bash
cd backend && pytest tests/test_training.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/training/schemas.py backend/app/training/router.py backend/tests/test_training.py
git commit -m "feat: add training router with worker-facing progress and flag routes"
```

---

## Task 9: Wire routers into main.py + run full test suite

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Register the new routers**

In `backend/app/main.py`, add imports and `include_router` calls:

```python
from app.staff.router import router as staff_router
from app.training.router import router as training_router
```

Add after the existing `app.include_router(outreach_router)` line:

```python
app.include_router(staff_router)
app.include_router(training_router)
```

- [ ] **Step 2: Run full test suite**

```bash
cd backend && pytest -v
```

Expected: All existing tests still pass + new tests pass. No regressions.

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register staff and training routers in main.py"
```

---

## Done

Backend is complete. All five tables are migrated, auth supports worker role, owner can manage workers and tracks via `/staff`, workers can access training via `/training`, AI generation and industry templates are wired up.

Next: write the frontend implementation plan (`2026-04-11-staff-training-frontend.md`).
