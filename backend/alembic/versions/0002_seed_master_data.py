"""seed default master data (기본 기준정보)

Alembic 버전 관리로 1회만 실행되므로 재기동 시 중복 시드되지 않는다.

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-10

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

members_table = sa.table(
    "members",
    sa.column("name", sa.String),
    sa.column("color", sa.String),
)

accounts_table = sa.table(
    "accounts",
    sa.column("name", sa.String),
    sa.column("type", sa.String),
    sa.column("opening_balance", sa.BigInteger),
    sa.column("is_active", sa.Boolean),
)

categories_table = sa.table(
    "categories",
    sa.column("name", sa.String),
    sa.column("kind", sa.String),
    sa.column("nature", sa.String),
)


def upgrade() -> None:
    op.bulk_insert(
        members_table,
        [
            {"name": "으니", "color": "#f472b6"},
            {"name": "영이", "color": "#60a5fa"},
        ],
    )
    op.bulk_insert(
        accounts_table,
        [
            {"name": "우리집 통장", "type": "bank", "opening_balance": 0, "is_active": True},
            {"name": "현금 지갑", "type": "cash", "opening_balance": 0, "is_active": True},
        ],
    )
    op.bulk_insert(
        categories_table,
        [
            # 지출 — fixed(정기 궤도) / variable(유성우)
            {"name": "주거/관리비", "kind": "expense", "nature": "fixed"},
            {"name": "통신비", "kind": "expense", "nature": "fixed"},
            {"name": "보험", "kind": "expense", "nature": "fixed"},
            {"name": "구독 서비스", "kind": "expense", "nature": "fixed"},
            {"name": "식비", "kind": "expense", "nature": "variable"},
            {"name": "카페/간식", "kind": "expense", "nature": "variable"},
            {"name": "교통", "kind": "expense", "nature": "variable"},
            {"name": "생활용품", "kind": "expense", "nature": "variable"},
            {"name": "의료/건강", "kind": "expense", "nature": "variable"},
            {"name": "문화/여가", "kind": "expense", "nature": "variable"},
            {"name": "경조사/선물", "kind": "expense", "nature": "variable"},
            {"name": "기타 지출", "kind": "expense", "nature": "variable"},
            # 수입
            {"name": "급여", "kind": "income", "nature": "fixed"},
            {"name": "상여", "kind": "income", "nature": "variable"},
            {"name": "이자/투자수익", "kind": "income", "nature": "variable"},
            {"name": "기타 수입", "kind": "income", "nature": "variable"},
        ],
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM categories"))
    op.execute(sa.text("DELETE FROM accounts"))
    op.execute(sa.text("DELETE FROM members"))
