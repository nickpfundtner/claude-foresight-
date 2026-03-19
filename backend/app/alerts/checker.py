from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models.error_log import ErrorLog
from app.models.user import User
from app.alerts.smtp import send_alert
import logging

logger = logging.getLogger(__name__)

ONE_HOUR = timedelta(hours=1)


def _format_time(dt) -> str:
    return dt.strftime("%Y-%m-%d %H:%M UTC") if dt else "unknown"


def check_and_alert(db: Session) -> None:
    """Run all three critical alert patterns. Called hourly by APScheduler."""
    _check_repeated_sync_failures(db)
    _check_nightly_sync_broken(db)
    _check_anthropic_degraded(db)


def _check_repeated_sync_failures(db: Session) -> None:
    """Alert if any user has 3+ unresolved square_sync errors in the last hour."""
    since = datetime.now(timezone.utc) - ONE_HOUR
    rows = db.query(ErrorLog).filter(
        ErrorLog.operation == "square_sync",
        ErrorLog.resolved == False,
        ErrorLog.created_at >= since,
    ).all()

    by_user: dict = {}
    for row in rows:
        if row.user_id:
            by_user.setdefault(str(row.user_id), []).append(row)

    for user_id, errors in by_user.items():
        if any(e.alert_sent for e in errors):
            continue
        if len(errors) >= 3:
            user = db.query(User).filter(User.id == user_id).first()
            business = user.business_name if user else user_id
            last_err = max(e.created_at for e in errors)
            body = (
                f"{len(errors)} unresolved Square sync errors in the last hour.\n"
                f"Last error: {errors[-1].error_message}\n"
                f"Time: {_format_time(last_err)}\n\n"
                f"Review error logs at: http://localhost:8000/docs"
            )
            send_alert(f"Square sync failing for {business}", body)
            for e in errors:
                e.alert_sent = True
    db.commit()


def _check_nightly_sync_broken(db: Session) -> None:
    """Alert if a user has unresolved square_sync errors spanning 2+ hours."""
    since = datetime.now(timezone.utc) - timedelta(hours=26)
    rows = db.query(ErrorLog).filter(
        ErrorLog.operation == "square_sync",
        ErrorLog.resolved == False,
        ErrorLog.created_at >= since,
    ).order_by(ErrorLog.created_at).all()

    by_user: dict = {}
    for row in rows:
        if row.user_id:
            by_user.setdefault(str(row.user_id), []).append(row)

    for user_id, errors in by_user.items():
        if any(e.alert_sent for e in errors):
            continue
        if len(errors) >= 2:
            first_err = errors[0].created_at
            last_err = errors[-1].created_at
            if (last_err - first_err) >= timedelta(hours=2):
                user = db.query(User).filter(User.id == user_id).first()
                business = user.business_name if user else user_id
                body = (
                    f"Square sync has been failing since {_format_time(first_err)}.\n"
                    f"Last error: {errors[-1].error_message}\n\n"
                    f"Review error logs at: http://localhost:8000/docs"
                )
                send_alert(f"Nightly sync broken for {business}", body)
                for e in errors:
                    e.alert_sent = True
    db.commit()


def _check_anthropic_degraded(db: Session) -> None:
    """Alert if 50%+ of anthropic_prediction errors in last hour vs total predictions."""
    since = datetime.now(timezone.utc) - ONE_HOUR
    error_rows = db.query(ErrorLog).filter(
        ErrorLog.operation == "anthropic_prediction",
        ErrorLog.resolved == False,
        ErrorLog.created_at >= since,
    ).all()

    if len(error_rows) < 5:
        return

    if any(e.alert_sent for e in error_rows):
        return

    from app.models.prediction import Prediction
    recent_predictions = db.query(Prediction).filter(
        Prediction.generated_at >= since,
    ).count()

    total = recent_predictions + len(error_rows)
    if total > 0 and (len(error_rows) / total) >= 0.5:
        body = (
            f"{len(error_rows)} of {total} AI predictions failed in the last hour.\n"
            f"Anthropic may be experiencing issues.\n\n"
            f"Review error logs at: http://localhost:8000/docs"
        )
        send_alert("AI predictions degraded — Anthropic may be down", body)
        for e in error_rows:
            e.alert_sent = True
        db.commit()
