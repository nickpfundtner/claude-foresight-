from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.models.customer import Customer
from app.models.prediction import Prediction
from app.dashboard.schemas import OverviewStats, CustomerSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=OverviewStats)
def overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    customers = db.query(Customer).filter(Customer.user_id == user.id).all()
    total_revenue = sum(c.total_spent for c in customers)
    avg_visits = sum(c.total_visits for c in customers) / len(customers) if customers else 0
    customer_ids = [c.id for c in customers]
    high_risk = db.query(Prediction).filter(
        Prediction.customer_id.in_(customer_ids),
        Prediction.churn_risk == "high"
    ).count()
    return OverviewStats(
        total_customers=len(customers),
        total_revenue=total_revenue,
        high_risk_count=high_risk,
        avg_visits_per_customer=round(avg_visits, 1),
    )


@router.get("/customers", response_model=List[CustomerSummary])
def customers_list(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    customers = db.query(Customer).filter(Customer.user_id == user.id).all()
    customer_ids = [c.id for c in customers]

    preds = {
        p.customer_id: p
        for p in db.query(Prediction).filter(Prediction.customer_id.in_(customer_ids)).all()
    }

    return [
        CustomerSummary(
            id=str(c.id),
            name=f"{c.given_name or ''} {c.family_name or ''}".strip(),
            email=c.email,
            total_visits=c.total_visits,
            total_spent=c.total_spent,
            last_visit_at=c.last_visit_at.isoformat() if c.last_visit_at else None,
            churn_risk=preds[c.id].churn_risk if c.id in preds else None,
            churn_risk_score=preds[c.id].churn_risk_score if c.id in preds else None,
        )
        for c in customers
    ]
