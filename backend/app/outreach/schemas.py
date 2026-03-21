from pydantic import BaseModel
from typing import Literal


class OutreachDraft(BaseModel):
    draft: str
    subject: str
    channel: Literal["email"] = "email"


class OutreachDraftResponse(BaseModel):
    draft: str
    subject: str
    channel: Literal["email"] = "email"


class OutreachSendResponse(BaseModel):
    sent: bool
    recipient: str


class BatchOutreachRequest(BaseModel):
    customer_ids: list[str]
    auto_send: bool = False


class BatchDraftItem(BaseModel):
    customer_id: str
    draft: str
    subject: str


class BatchOutreachResponse(BaseModel):
    drafts: list[BatchDraftItem]
    sent_count: int
