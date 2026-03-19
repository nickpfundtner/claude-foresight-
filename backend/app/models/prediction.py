import uuid
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.sql import func
from app.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, index=True)
    prediction_type = Column(String, nullable=True)
    score = Column(Numeric(5, 4), nullable=True)
    result = Column(JSON, nullable=True)
    model_version = Column(String, nullable=True)
    churn_risk = Column(String, nullable=True)
    churn_risk_score = Column(Numeric(5, 4), nullable=True)
    generated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
