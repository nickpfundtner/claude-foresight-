"""add training tables

Revision ID: 008
Revises: 007
Create Date: 2026-04-11 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '008'
down_revision: Union[str, None] = '007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'training_tracks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('role_name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_training_tracks_business_id', 'training_tracks', ['business_id'])

    op.create_table(
        'training_modules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('track_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('training_tracks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('content', postgresql.JSON(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_training_modules_track_id', 'training_modules', ['track_id'])

    op.create_table(
        'worker_track_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('worker_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('track_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('training_tracks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_worker_track_assignments_worker_id', 'worker_track_assignments', ['worker_id'])

    op.create_table(
        'worker_progress',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('worker_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('module_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('training_modules.id', ondelete='CASCADE'), nullable=False),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_worker_progress_worker_id', 'worker_progress', ['worker_id'])


def downgrade() -> None:
    op.drop_index('ix_worker_progress_worker_id', table_name='worker_progress')
    op.drop_table('worker_progress')
    op.drop_index('ix_worker_track_assignments_worker_id', table_name='worker_track_assignments')
    op.drop_table('worker_track_assignments')
    op.drop_index('ix_training_modules_track_id', table_name='training_modules')
    op.drop_table('training_modules')
    op.drop_index('ix_training_tracks_business_id', table_name='training_tracks')
    op.drop_table('training_tracks')
