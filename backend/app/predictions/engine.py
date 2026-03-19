import json
from datetime import datetime, timezone
from anthropic import Anthropic
from sqlalchemy.orm import Session
from app.config import settings
from app.models.customer import Customer
from app.models.transaction import Transaction
from app.models.prediction import Prediction
from app.models.customer_health import CustomerHealth
from app.core.retry import anthropic_retry
from app.core.errors import log_error, resolve_errors
from app.core.health import on_prediction_failure, on_prediction_success
from app.core.pii import strip_pii

anthropic = Anthropic(api_key=settings.anthropic_api_key)


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0]
    return text.strip()


def _build_prompt(customer_data: dict, transactions: list, fallback: bool) -> str:
    """Build the Anthropic prompt using anonymized customer_data from strip_pii().
    customer_data MUST come from strip_pii() — never pass a raw Customer object here.
    When fallback=True, omit transaction list (used when full history causes failures)."""
    days_since_last = None
    if customer_data.get("last_visit_at"):
        days_since_last = (datetime.now(timezone.utc) - customer_data["last_visit_at"]).days

    if fallback:
        avg_order = (customer_data["total_spent"] / customer_data["total_visits"]
                     if customer_data["total_visits"] else 0)
        history_section = (
            f"avg_order_value: ${avg_order:.2f}\n"
            f"days_since_last_visit: {days_since_last}"
        )
    else:
        tx_list = "\n".join(
            f"- {t.transacted_at.strftime('%Y-%m-%d')}: ${t.amount:.2f}, items: {json.dumps(t.items or [])}"
            for t in sorted(transactions, key=lambda x: x.transacted_at)
        )
        history_section = tx_list if tx_list else "No transactions yet"

    return f"""You are a customer analytics AI for small businesses. Analyze this customer's purchase history and return a JSON prediction.

Customer ID: {customer_data['id']}
Total visits: {customer_data['total_visits']}
Total spent: ${customer_data['total_spent']:.2f}
First visit: {customer_data['first_visit_at']}
Last visit: {customer_data['last_visit_at']}
Days since last visit: {days_since_last}

Transaction history:
{history_section}

Return ONLY valid JSON with these exact keys:
{{
  "churn_risk": "low" | "medium" | "high",
  "churn_risk_score": 0.0 to 1.0,
  "predicted_next_visit_days": number or null,
  "predicted_ltv": number in dollars or null,
  "top_products": "comma-separated product names" or null,
  "insight_summary": "1-2 sentence human-readable insight"
}}"""


@anthropic_retry
def _call_anthropic(prompt: str) -> dict:
    message = anthropic.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = _strip_fences(message.content[0].text)
    return json.loads(raw)


def generate_prediction(customer: Customer, db: Session) -> Prediction:
    transactions = db.query(Transaction).filter(Transaction.customer_id == customer.id).all()
    customer_data = strip_pii(customer)  # anonymize before sending to Anthropic

    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == customer.id).first()
    use_fallback = bool(health and health.prediction_fallback)

    prompt = _build_prompt(customer_data, transactions, fallback=use_fallback)

    try:
        data = _call_anthropic(prompt)
    except Exception as e:
        on_prediction_failure(db, customer.id)
        log_error(db, "anthropic_prediction", e, customer_id=customer.id)
        raise ValueError(f"AI prediction failed: {e}")

    pred = db.query(Prediction).filter(Prediction.customer_id == customer.id).first()
    if not pred:
        pred = Prediction(customer_id=customer.id)
        db.add(pred)

    pred.churn_risk = data["churn_risk"]
    pred.churn_risk_score = float(data["churn_risk_score"])
    pred.predicted_next_visit_days = data.get("predicted_next_visit_days")
    pred.predicted_ltv = data.get("predicted_ltv")
    pred.top_products = data.get("top_products")
    pred.insight_summary = data.get("insight_summary")
    pred.generated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pred)

    on_prediction_success(db, customer.id)
    resolve_errors(db, "anthropic_prediction", customer_id=customer.id)
    return pred
