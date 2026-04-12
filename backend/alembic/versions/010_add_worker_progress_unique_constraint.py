"""add unique constraint to worker_progress

Revision ID: 010
Revises: 009
Create Date: 2026-04-11

"""
from alembic import op

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_worker_progress_worker_module",
        "worker_progress",
        ["worker_id", "module_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_worker_progress_worker_module",
        "worker_progress",
        type_="unique",
    )
