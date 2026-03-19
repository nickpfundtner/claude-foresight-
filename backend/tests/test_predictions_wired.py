import uuid
from unittest.mock import patch
from app.models.user import User
from app.models.customer import Customer
from app.models.customer_health import CustomerHealth
from app.models.error_log import ErrorLog
from app.core.pii import strip_pii
from app.predictions.engine import _build_prompt


def _make_customer(db):
    u = User(email=f"{uuid.uuid4().hex}@t.com", hashed_password="x", business_name="B")
    db.add(u)
    db.commit()
    c = Customer(
        user_id=u.id,
        square_customer_id=uuid.uuid4().hex,
        given_name="RealName",
        family_name="RealFamily",
        email="real@email.com",
        total_visits=5,
        total_spent=200.0,
    )
    db.add(c)
    db.commit()
    return c


def test_build_prompt_uses_anonymous_id_not_real_name():
    c = Customer(
        id=uuid.uuid4(),
        given_name="RealName",
        family_name="RealFamily",
        email="real@email.com",
        total_visits=5,
        total_spent=200.0,
    )
    customer_data = strip_pii(c)
    prompt = _build_prompt(customer_data, transactions=[], fallback=False)
    assert "RealName" not in prompt
    assert "RealFamily" not in prompt
    assert "real@email.com" not in prompt
    assert "Customer #" in prompt


def test_build_prompt_fallback_omits_transaction_list():
    c = Customer(
        id=uuid.uuid4(),
        given_name="X",
        total_visits=10,
        total_spent=500.0,
    )
    customer_data = strip_pii(c)
    prompt = _build_prompt(customer_data, transactions=[], fallback=True)
    assert "avg_order_value" in prompt
    assert "Transaction history" not in prompt


def test_generate_prediction_logs_error_and_increments_health_on_failure(db):
    c = _make_customer(db)

    with patch("app.predictions.engine._call_anthropic", side_effect=Exception("anthropic down")):
        from app.predictions.engine import generate_prediction
        try:
            generate_prediction(c, db)
        except ValueError:
            pass

    row = db.query(ErrorLog).filter(
        ErrorLog.customer_id == c.id,
        ErrorLog.operation == "anthropic_prediction",
    ).first()
    assert row is not None

    health = db.query(CustomerHealth).filter(CustomerHealth.customer_id == c.id).first()
    assert health is not None
    assert health.prediction_fail_count == 1


def test_generate_prediction_uses_fallback_prompt_when_flagged(db):
    c = _make_customer(db)
    health = CustomerHealth(customer_id=c.id, prediction_fallback=True, prediction_fail_count=3)
    db.add(health)
    db.commit()

    mock_response = {
        "churn_risk": "low", "churn_risk_score": 0.1,
        "predicted_next_visit_days": 7, "predicted_ltv": 300.0,
        "top_products": None, "insight_summary": "Good customer"
    }

    with patch("app.predictions.engine._call_anthropic", return_value=mock_response), \
         patch("app.predictions.engine._build_prompt", wraps=lambda data, txs, fallback: _build_prompt(data, txs, fallback)) as mock_prompt:
        from app.predictions.engine import generate_prediction
        generate_prediction(c, db)
        _, kwargs = mock_prompt.call_args
        assert kwargs.get("fallback") is True or mock_prompt.call_args[0][2] is True
