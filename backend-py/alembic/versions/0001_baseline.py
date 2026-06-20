"""baseline schema (from pg_dump of the Prisma-managed DB)

Revision ID: 0001_baseline
Revises:
Create Date: 2026-06-20
"""
from pathlib import Path

from alembic import op

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None

_SQL = (Path(__file__).resolve().parents[1] / "baseline.sql").read_text()


def _statements(sql: str) -> list[str]:
    # Strip SQL comment lines, then split on `;`. Safe for this dump: no
    # dollar-quoting and no semicolons inside string literals.
    lines = [ln for ln in sql.splitlines() if not ln.strip().startswith("--")]
    body = "\n".join(lines)
    out: list[str] = []
    for raw in body.split(";"):
        stmt = raw.strip()
        if not stmt:
            continue
        # Skip pg_dump session settings — `SET ...` and the
        # `set_config('search_path', '', ...)` call empties the search path,
        # which would break Alembic's unqualified alembic_version bookkeeping.
        upper = stmt.upper()
        if upper.startswith("SET ") or "SET_CONFIG('SEARCH_PATH'" in upper.replace(" ", ""):
            continue
        out.append(stmt)
    return out


def upgrade() -> None:
    for statement in _statements(_SQL):
        op.execute(statement)


def downgrade() -> None:
    op.execute('DROP SCHEMA public CASCADE')
    op.execute('CREATE SCHEMA public')
