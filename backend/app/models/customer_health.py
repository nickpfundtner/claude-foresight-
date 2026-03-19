import uuid
from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class CustomerHealth(Base):
    __tablename__ = "customer_health"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, unique=True, index=True)
    sync_fail_count = Column(Integer, default=0, nullable=False)
    sync_skip = Column(Boolean, default=False, nullable=False)
    sync_skip_until = Column(DateTime(timezone=True), nullable=True)
    prediction_fail_count = Column(Integer, default=0, nullable=False)
    prediction_fallback = Column(Boolean, default=False, nullable=False)
    last_error_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
