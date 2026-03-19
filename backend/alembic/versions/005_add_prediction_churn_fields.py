"""add churn_risk fields and generated_at to predictions

Revision ID: 005
Revises: 004
Create Date: 2026-03-19 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('predictions', 'prediction_type', nullable=True)
    op.add_column('predictions', sa.Column('churn_risk', sa.String(), nullable=True))
    op.add_column('predictions', sa.Column('churn_risk_score', sa.Numeric(5, 4), nullable=True))
    op.add_column('predictions', sa.Column('generated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('predictions', 'generated_at')
    op.drop_column('predictions', 'churn_risk_score')
    op.drop_column('predictions', 'churn_risk')
    op.alter_column('predictions', 'prediction_type', nullable=False)
