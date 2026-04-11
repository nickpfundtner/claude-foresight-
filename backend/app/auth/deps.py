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
