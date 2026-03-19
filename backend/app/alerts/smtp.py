import smtplib
import logging
from email.mime.text import MIMEText
from app.config import settings

logger = logging.getLogger(__name__)


def send_alert(subject: str, body: str) -> None:
    """Send a critical alert email. Silently skips if SMTP is not configured."""
    if not settings.smtp_user or not settings.alert_email_to:
        logger.warning("Alert skipped — SMTP not configured. Subject: %s", subject)
        return
    try:
        msg = MIMEText(body)
        msg["Subject"] = f"[CIP Alert] {subject}"
        msg["From"] = settings.smtp_user
        msg["To"] = settings.alert_email_to
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        logger.info("Alert sent: %s", subject)
    except Exception as e:
        logger.error("Failed to send alert email: %s", e)
