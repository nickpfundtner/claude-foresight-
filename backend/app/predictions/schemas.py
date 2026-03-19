from pydantic import BaseModel
from typing import Optional

class PredictionResponse(BaseModel):
    customer_id: str
    customer_name: str
    churn_risk: str
    churn_risk_score: float
    predicted_next_visit_days: Optional[float]
    predicted_ltv: Optional[float]
    top_products: Optional[str]
    insight_summary: Optional[str]
    generated_at: str
