"""add workers table

Revision ID: 007
Revises: 006
Create Date: 2026-04-11 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '007'
down_revision: Union[str, None] = '006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'workers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('role_name', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_workers_business_id', 'workers', ['business_id'])
    op.create_index('ix_workers_email', 'workers', ['email'])
    op.create_unique_constraint('uq_workers_business_email', 'workers', ['business_id', 'email'])


def downgrade() -> None:
    op.drop_constraint('uq_workers_business_email', 'workers', type_='unique')
    op.drop_index('ix_workers_email', table_name='workers')
    op.drop_index('ix_workers_business_id', table_name='workers')
    op.drop_table('workers')
