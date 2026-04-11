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
    if db.query(Worker).filter(Worker.email == body.email, Worker.business_id == user.id).first():
        raise HTTPException(status_code=400, detail="Email already in use for this business")
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
