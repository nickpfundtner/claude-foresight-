from __future__ import annotations
from sqlalchemy.orm import Session
from app.models.error_log import ErrorLog


def log_error(
    db: Session,
    operation: str,
    error: Exception,
    user_id=None,
    customer_id=None,
    context: dict | None = None,
) -> None:
    """Write one ErrorLog row. Called in every except block after retries are exhausted.
    error_code is stored as a string when the exception has a status_code attribute,
    or NULL (Python None) for plain exceptions — never the string "None"."""
    status_code = getattr(error, "status_code", None)
    db.add(ErrorLog(
        user_id=user_id,
        customer_id=customer_id,
        operation=operation,
        error_message=str(error),
        error_code=str(status_code) if status_code is not None else None,
        context=context,
    ))
    db.commit()


def resolve_errors(
    db: Session,
    operation: str,
    user_id=None,
    customer_id=None,
) -> None:
    """Mark matching open errors as resolved and reset alert_sent.
    Resetting alert_sent ensures future errors for this operation can trigger new alerts."""
    query = db.query(ErrorLog).filter(
        ErrorLog.operation == operation,
        ErrorLog.resolved == False,
    )
    if user_id is not None:
        query = query.filter(ErrorLog.user_id == user_id)
    if customer_id is not None:
        query = query.filter(ErrorLog.customer_id == customer_id)
    query.update({"resolved": True, "alert_sent": False})
    db.commit()


def resolve_errors_by_email(db: Session, operation: str, email: str) -> None:
    """Resolve auth_login failures where user_id=NULL (pre-auth, nonexistent account).
    These rows are only queryable by context['email'] via PostgreSQL JSON operator."""
    db.query(ErrorLog).filter(
        ErrorLog.operation == operation,
        ErrorLog.resolved == False,
        ErrorLog.context["email"].astext == email,
    ).update({"resolved": True, "alert_sent": False}, synchronize_session=False)
    db.commit()
