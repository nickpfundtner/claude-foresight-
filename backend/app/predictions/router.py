from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.models.customer import Customer
from app.models.prediction import Prediction
from app.predictions.engine import generate_prediction
from app.predictions.schemas import PredictionResponse

router = APIRouter(prefix="/predictions", tags=["predictions"])


def _to_response(customer: Customer, pred: Prediction) -> PredictionResponse:
    return PredictionResponse(
        customer_id=str(customer.id),
        customer_name=f"{customer.given_name or ''} {customer.family_name or ''}".strip(),
        churn_risk=pred.churn_risk,
        churn_risk_score=pred.churn_risk_score,
        predicted_next_visit_days=pred.predicted_next_visit_days,
        predicted_ltv=pred.predicted_ltv,
        top_products=pred.top_products,
        insight_summary=pred.insight_summary,
        generated_at=pred.generated_at.isoformat(),
    )


@router.get("/{customer_id}", response_model=PredictionResponse)
def get_prediction(customer_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.user_id == user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    pred = db.query(Prediction).filter(Prediction.customer_id == customer.id).first()
    if not pred:
        pred = generate_prediction(customer, db)
    return _to_response(customer, pred)


@router.post("/{customer_id}/refresh", response_model=PredictionResponse)
def refresh_prediction(customer_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.user_id == user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    pred = generate_prediction(customer, db)
    return _to_response(customer, pred)
