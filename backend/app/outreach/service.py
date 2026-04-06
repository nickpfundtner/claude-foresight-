import anthropic
from sqlalchemy.orm import Session
from app.models.customer import Customer
from app.outreach.schemas import OutreachDraftResponse, OutreachSendResponse, BatchDraftItem


def _parse_draft(raw_text: str) -> tuple[str, str]:
    """Parse Claude response into (subject, body).

    Expects the first line to be 'Subject: ...' followed by the email body.
    Falls back to a generic subject if the format is not found.
    """
    lines = raw_text.strip().splitlines()
    subject = "We miss you"
    body_lines = lines

    if lines and lines[0].lower().startswith("subject:"):
        subject = lines[0][len("subject:"):].strip()
        # Skip blank line after Subject if present
        body_lines = lines[1:]
        if body_lines and body_lines[0].strip() == "":
            body_lines = body_lines[1:]

    body = "\n".join(body_lines).strip()
    return subject, body


def generate_draft(customer_id: str, db: Session, current_user_id: str) -> OutreachDraftResponse:
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.user_id == current_user_id,
    ).first()
    if not customer:
        raise ValueError(f"Customer {customer_id} not found")

    name = f"{customer.given_name or ''} {customer.family_name or ''}".strip() or "Valued Customer"
    visits = customer.total_visits or 0
    spent = customer.total_spent or 0.0

    prompt = (
        f"Write a short, warm, re-engagement email for a customer named {name}. "
        f"They have visited {visits} times and spent ${spent:.2f} total. "
        f"Keep it under 100 words. "
        f"Start with exactly one line formatted as 'Subject: <subject line>', "
        f"then leave a blank line, then write the email body."
    )

    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text
    subject, body = _parse_draft(raw)

    return OutreachDraftResponse(draft=body, subject=subject, channel="email")


def send_draft(customer_id: str, draft: str, subject: str, db: Session, current_user_id: str) -> OutreachSendResponse:
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.user_id == current_user_id,
    ).first()
    if not customer:
        raise ValueError(f"Customer {customer_id} not found")

    if not customer.email:
        raise ValueError(f"Customer {customer_id} has no email address")
    recipient = customer.email
    # Phase 1: log to stdout only (SMTP in Phase 2)
    print(f"[OUTREACH] To: {recipient} | Subject: {subject}\n{draft}")

    return OutreachSendResponse(sent=True, recipient=recipient)
