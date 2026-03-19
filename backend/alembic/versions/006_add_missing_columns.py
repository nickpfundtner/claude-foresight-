"""add missing columns to users, transactions, predictions

Revision ID: 006
Revises: 005
Create Date: 2026-03-19 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.add_column('users', sa.Column('square_access_token', sa.String(), nullable=True))
    op.add_column('users', sa.Column('square_location_id', sa.String(), nullable=True))

    # transactions
    op.alter_column('transactions', 'customer_id', nullable=True)
    op.add_column('transactions', sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_transactions_user_id', 'transactions', 'users', ['user_id'], ['id'])
    op.create_index('ix_transactions_user_id', 'transactions', ['user_id'])
    op.add_column('transactions', sa.Column('square_order_id', sa.String(), nullable=True))
    op.create_unique_constraint('uq_transactions_square_order_id', 'transactions', ['square_order_id'])
    op.create_index('ix_transactions_square_order_id', 'transactions', ['square_order_id'])
    op.add_column('transactions', sa.Column('items', postgresql.JSON(), nullable=True))
    op.add_column('transactions', sa.Column('transacted_at', sa.DateTime(timezone=True), nullable=True))

    # predictions
    op.add_column('predictions', sa.Column('predicted_next_visit_days', sa.Numeric(10, 2), nullable=True))
    op.add_column('predictions', sa.Column('predicted_ltv', sa.Numeric(10, 2), nullable=True))
    op.add_column('predictions', sa.Column('top_products', sa.String(), nullable=True))
    op.add_column('predictions', sa.Column('insight_summary', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('predictions', 'insight_summary')
    op.drop_column('predictions', 'top_products')
    op.drop_column('predictions', 'predicted_ltv')
    op.drop_column('predictions', 'predicted_next_visit_days')
    op.drop_column('transactions', 'transacted_at')
    op.drop_column('transactions', 'items')
    op.drop_index('ix_transactions_square_order_id', table_name='transactions')
    op.drop_constraint('uq_transactions_square_order_id', 'transactions')
    op.drop_column('transactions', 'square_order_id')
    op.drop_index('ix_transactions_user_id', table_name='transactions')
    op.drop_constraint('fk_transactions_user_id', 'transactions')
    op.drop_column('transactions', 'user_id')
    op.drop_column('users', 'square_location_id')
    op.drop_column('users', 'square_access_token')
