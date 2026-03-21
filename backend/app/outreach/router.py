from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.outreach.schemas import (
    OutreachDraft,
    OutreachDraftResponse,
    OutreachSendResponse,
    BatchOutreachRequest,
    BatchDraftItem,
    BatchOutreachResponse,
)
from app.outreach import service

router = APIRouter(prefix="/outreach", tags=["outreach"])


@router.post("/{customer_id}/generate", response_model=OutreachDraftResponse)
def generate_outreach(
    customer_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return service.generate_draft(customer_id, db, current_user_id=user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{customer_id}/send", response_model=OutreachSendResponse)
def send_outreach(
    customer_id: str,
    body: OutreachDraft,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return service.send_draft(customer_id, body.draft, body.subject, db, current_user_id=user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/batch", response_model=BatchOutreachResponse)
def batch_outreach(
    body: BatchOutreachRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    drafts: list[BatchDraftItem] = []
    sent_count = 0

    for customer_id in body.customer_ids:
        try:
            result = service.generate_draft(customer_id, db, current_user_id=user.id)
        except ValueError:
            continue

        drafts.append(BatchDraftItem(
            customer_id=customer_id,
            draft=result.draft,
            subject=result.subject,
        ))

        if body.auto_send:
            try:
                service.send_draft(customer_id, result.draft, result.subject, db, current_user_id=user.id)
                sent_count += 1
            except ValueError:
                pass

    return BatchOutreachResponse(drafts=drafts, sent_count=sent_count)
