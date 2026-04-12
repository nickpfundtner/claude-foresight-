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
    FlagModuleResponse, MyProgressItem,
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


@router.get("/my-progress", response_model=list[MyProgressItem])
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
