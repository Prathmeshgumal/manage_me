"""soft delete columns, shelf isGeneral, shelf FK SET NULL

Revision ID: 0002_soft_delete
Revises: 0001_baseline
Create Date: 2026-06-20
"""
import sqlalchemy as sa
from alembic import op

revision = "0002_soft_delete"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Soft-delete timestamps.
    op.add_column("Project", sa.Column("deletedAt", sa.DateTime(), nullable=True))
    op.add_column("Task", sa.Column("deletedAt", sa.DateTime(), nullable=True))
    op.add_column("Book", sa.Column("deletedAt", sa.DateTime(), nullable=True))
    op.add_column("Page", sa.Column("deletedAt", sa.DateTime(), nullable=True))

    # Track tasks removed by a project delete (so project restore restores only those).
    op.add_column(
        "Task",
        sa.Column("deletedWithProject", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Distinguish the General shelf from orphaned (deleted-project) shelves.
    op.add_column(
        "Shelf",
        sa.Column("isGeneral", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute('UPDATE "Shelf" SET "isGeneral" = true WHERE "projectId" IS NULL')

    # A project delete must keep its shelf alive -> SET NULL instead of CASCADE.
    op.drop_constraint("Shelf_projectId_fkey", "Shelf", type_="foreignkey")
    op.create_foreign_key(
        "Shelf_projectId_fkey", "Shelf", "Project",
        ["projectId"], ["id"], onupdate="CASCADE", ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("Shelf_projectId_fkey", "Shelf", type_="foreignkey")
    op.create_foreign_key(
        "Shelf_projectId_fkey", "Shelf", "Project",
        ["projectId"], ["id"], onupdate="CASCADE", ondelete="CASCADE",
    )
    op.drop_column("Shelf", "isGeneral")
    op.drop_column("Task", "deletedWithProject")
    op.drop_column("Page", "deletedAt")
    op.drop_column("Book", "deletedAt")
    op.drop_column("Task", "deletedAt")
    op.drop_column("Project", "deletedAt")
