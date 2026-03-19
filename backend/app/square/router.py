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
