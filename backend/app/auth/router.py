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
    resolve_errors(db, "auth_login", user_id=user.id)
    resolve_errors_by_email(db, "auth_login", email=body.email)
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user_id=str(user.id), business_name=user.business_name)
