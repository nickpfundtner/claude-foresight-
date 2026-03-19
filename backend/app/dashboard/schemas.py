from pydantic import BaseModel
from typing import Optional, List

class CustomerSummary(BaseModel):
    id: str
    name: str
    email: Optional[str]
    total_visits: int
    total_spent: float
    last_visit_at: Optional[str]
    churn_risk: Optional[str]
    churn_risk_score: Optional[float]

class OverviewStats(BaseModel):
    total_customers: int
    total_revenue: float
    high_risk_count: int
    avg_visits_per_customer: float
