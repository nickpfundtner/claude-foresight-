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
