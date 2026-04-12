"""add module_flags table

Revision ID: 009
Revises: 008
Create Date: 2026-04-11 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '009'
down_revision: Union[str, None] = '008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'module_flags',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('worker_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('module_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('training_modules.id', ondelete='CASCADE'), nullable=False),
        sa.Column('flagged_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_module_flags_worker_id', 'module_flags', ['worker_id'])
    op.create_index('ix_module_flags_module_id', 'module_flags', ['module_id'])


def downgrade() -> None:
    op.drop_index('ix_module_flags_module_id', table_name='module_flags')
    op.drop_index('ix_module_flags_worker_id', table_name='module_flags')
    op.drop_table('module_flags')
