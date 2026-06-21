"""add wishlist tables

Revision ID: 0003_wishlist
Revises: 0002_soft_delete
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_wishlist"
down_revision = "0002_soft_delete"
branch_labels = None
depends_on = None

# Postgres enum types. create_type=False so create_table references them by
# name instead of trying to re-create them (we create them explicitly below).
CATEGORY = postgresql.ENUM("Items", "Places", "Goals", "Other", name="WishlistCategory", create_type=False)
ITEM_STATUS = postgresql.ENUM("WISHLIST", "SAVING", "PURCHASED", "ARCHIVED", name="WishlistItemStatus", create_type=False)
ITEM_PRIORITY = postgresql.ENUM("MUST_HAVE", "NICE_TO_HAVE", "DREAM", name="WishlistItemPriority", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    CATEGORY.create(bind, checkfirst=True)
    ITEM_STATUS.create(bind, checkfirst=True)
    ITEM_PRIORITY.create(bind, checkfirst=True)

    op.create_table(
        "Wishlist",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False, server_default="New Wishlist"),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("category", CATEGORY, nullable=False, server_default="Other"),
        sa.Column("icon", sa.String(), nullable=True),
        sa.Column("color", sa.String(), nullable=False, server_default="#8A8A86"),
        sa.Column("workspaceId", sa.String(), nullable=False),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["workspaceId"], ["Workspace.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "WishlistItem",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("wishlistId", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(), nullable=False, server_default="INR"),
        sa.Column("status", ITEM_STATUS, nullable=False, server_default="WISHLIST"),
        sa.Column("priority", ITEM_PRIORITY, nullable=False, server_default="NICE_TO_HAVE"),
        sa.Column("targetDate", sa.DateTime(), nullable=True),
        sa.Column("sortOrder", sa.Float(), nullable=False, server_default="0"),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["wishlistId"], ["Wishlist.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_WishlistItem_wishlistId", "WishlistItem", ["wishlistId"])


def downgrade() -> None:
    bind = op.get_bind()
    op.drop_index("ix_WishlistItem_wishlistId", table_name="WishlistItem")
    op.drop_table("WishlistItem")
    op.drop_table("Wishlist")
    ITEM_PRIORITY.drop(bind, checkfirst=True)
    ITEM_STATUS.drop(bind, checkfirst=True)
    CATEGORY.drop(bind, checkfirst=True)
