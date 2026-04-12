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
