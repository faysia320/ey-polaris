"""거래 시각(transactions.time) — 엑셀 "시간" 컬럼 반영용 nullable 컬럼

- transactions.time: sa.Time, nullable. 수동/과거 거래는 NULL 허용.
- downgrade는 time 컬럼을 제거한다(시각 정보 소실 — 파괴적).

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-24

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("time", sa.Time(), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "time")
