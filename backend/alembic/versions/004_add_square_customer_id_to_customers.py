"""add square_customer_id to customers

Revision ID: 004
Revises: 003
Create Date: 2026-03-19 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('customers', sa.Column('square_customer_id', sa.String(), nullable=True))
    op.create_index('ix_customers_square_customer_id', 'customers', ['square_customer_id'])


def downgrade() -> None:
    op.drop_index('ix_customers_square_customer_id', table_name='customers')
    op.drop_column('customers', 'square_customer_id')
