"""add error_logs and customer_health tables

Revision ID: 002
Revises: 001
Create Date: 2026-03-19 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'error_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id'), nullable=True),
        sa.Column('operation', sa.String(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=False),
        sa.Column('error_code', sa.String(), nullable=True),
        sa.Column('context', postgresql.JSON(), nullable=True),
        sa.Column('resolved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('alert_sent', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_error_logs_user_id', 'error_logs', ['user_id'])
    op.create_index('ix_error_logs_customer_id', 'error_logs', ['customer_id'])
    op.create_index('ix_error_logs_operation', 'error_logs', ['operation'])

    op.create_table(
        'customer_health',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id'), nullable=False),
        sa.Column('sync_fail_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sync_skip', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sync_skip_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('prediction_fail_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('prediction_fallback', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('last_error_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('customer_id'),
    )
    op.create_index('ix_customer_health_customer_id', 'customer_health', ['customer_id'])


def downgrade() -> None:
    op.drop_table('customer_health')
    op.drop_table('error_logs')
