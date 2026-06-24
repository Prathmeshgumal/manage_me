"""add todo list tables

Revision ID: 0005_todo_lists
Revises: 0004_task_identifiers
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_todo_lists"
down_revision = "0004_task_identifiers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "TodoList",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False, server_default="My List"),
        sa.Column("color", sa.String(), nullable=False, server_default="#8A8A86"),
        sa.Column("sortOrder", sa.Float(), nullable=False, server_default="0"),
        sa.Column("workspaceId", sa.String(), nullable=False),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["workspaceId"], ["Workspace.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_TodoList_workspaceId", "TodoList", ["workspaceId"])

    op.create_table(
        "TodoItem",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("listId", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("completedAt", sa.DateTime(), nullable=True),
        sa.Column("dueDate", sa.DateTime(), nullable=True),
        sa.Column("starred", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sortOrder", sa.Float(), nullable=False, server_default="0"),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["listId"], ["TodoList.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_TodoItem_listId", "TodoItem", ["listId"])


def downgrade() -> None:
    op.drop_index("ix_TodoItem_listId", table_name="TodoItem")
    op.drop_table("TodoItem")
    op.drop_index("ix_TodoList_workspaceId", table_name="TodoList")
    op.drop_table("TodoList")
