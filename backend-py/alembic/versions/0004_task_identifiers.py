"""project keys + per-project task numbers (Linear-style ids)

Revision ID: 0004_task_identifiers
Revises: 0003_wishlist
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_task_identifiers"
down_revision = "0003_wishlist"
branch_labels = None
depends_on = None


def _gen_key(name: str, taken: set[str]) -> str:
    letters = [c for c in (name or "").upper() if c.isalpha()]
    base = "".join(letters[:3]) or "PRJ"
    if len(base) < 3:
        base = (base + "XXX")[:3]
    candidate = base
    n = 1
    while candidate in taken:
        suffix = str(n)
        candidate = (base[: max(0, 3 - len(suffix))] + suffix) or suffix
        n += 1
    return candidate


def upgrade() -> None:
    op.add_column("Workspace", sa.Column("nextTaskNumber", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("Project", sa.Column("key", sa.String(), nullable=True))
    op.add_column("Project", sa.Column("nextTaskNumber", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("Task", sa.Column("number", sa.Integer(), nullable=True))

    conn = op.get_bind()

    # Backfill a unique key per project, scoped to its workspace.
    rows = conn.execute(
        sa.text('SELECT id, "workspaceId", name FROM "Project" ORDER BY "createdAt", id')
    ).fetchall()
    used: dict[str, set[str]] = {}
    for pid, wsid, name in rows:
        taken = used.setdefault(wsid, set())
        key = _gen_key(name, taken)
        taken.add(key)
        conn.execute(sa.text('UPDATE "Project" SET "key" = :k WHERE id = :id'), {"k": key, "id": pid})

    # Number existing tasks: per-project sequence, then per-workspace for project-less tasks.
    # Soft-deleted tasks are included so numbering stays stable and gap-free.
    conn.execute(sa.text(
        'WITH numbered AS ('
        '  SELECT id, ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt", id) AS rn'
        '  FROM "Task" WHERE "projectId" IS NOT NULL'
        ') UPDATE "Task" t SET "number" = numbered.rn FROM numbered WHERE t.id = numbered.id'
    ))
    conn.execute(sa.text(
        'WITH numbered AS ('
        '  SELECT id, ROW_NUMBER() OVER (PARTITION BY "workspaceId" ORDER BY "createdAt", id) AS rn'
        '  FROM "Task" WHERE "projectId" IS NULL'
        ') UPDATE "Task" t SET "number" = numbered.rn FROM numbered WHERE t.id = numbered.id'
    ))

    # Point each counter just past the highest number already handed out.
    conn.execute(sa.text(
        'UPDATE "Project" p SET "nextTaskNumber" = '
        'COALESCE((SELECT MAX("number") FROM "Task" t WHERE t."projectId" = p.id), 0) + 1'
    ))
    conn.execute(sa.text(
        'UPDATE "Workspace" w SET "nextTaskNumber" = '
        'COALESCE((SELECT MAX("number") FROM "Task" t '
        'WHERE t."workspaceId" = w.id AND t."projectId" IS NULL), 0) + 1'
    ))

    op.alter_column("Project", "key", nullable=False)


def downgrade() -> None:
    op.drop_column("Task", "number")
    op.drop_column("Project", "nextTaskNumber")
    op.drop_column("Project", "key")
    op.drop_column("Workspace", "nextTaskNumber")
