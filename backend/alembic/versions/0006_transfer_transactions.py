"""이체(transfer) 거래 도입 — counter_account_id 컬럼 + 이체 카테고리 시드

- transactions.counter_account_id FK(RESTRICT, nullable) 추가
  : 이체 거래 전용 입금 계정. account_id가 출금 계정 역할을 한다
- 이체 카테고리 시드: 대분류 '이체', kind='transfer'
  소분류 = 내계좌이체 / 카드대금 / 저축 / 투자 / 미분류
- downgrade는 이체 거래와 이체 카테고리를 삭제한다 (이전 스키마는 이체를
  표현할 수 없으므로 보존 불가 — 파괴적임을 명시)

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-12

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TRANSFER_MAJOR = "이체"
TRANSFER_MINORS = ["내계좌이체", "카드대금", "저축", "투자", "미분류"]


def upgrade() -> None:
    op.add_column("transactions", sa.Column("counter_account_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_transactions_counter_account_id_accounts",
        "transactions",
        "accounts",
        ["counter_account_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    conn = op.get_bind()
    for minor in TRANSFER_MINORS:
        exists = conn.execute(
            sa.text(
                "SELECT 1 FROM categories "
                "WHERE major = :major AND minor = :minor AND kind = 'transfer'"
            ),
            {"major": TRANSFER_MAJOR, "minor": minor},
        ).scalar()
        if not exists:
            conn.execute(
                sa.text(
                    "INSERT INTO categories (major, minor, kind, nature) "
                    "VALUES (:major, :minor, 'transfer', 'variable')"
                ),
                {"major": TRANSFER_MAJOR, "minor": minor},
            )


def downgrade() -> None:
    conn = op.get_bind()
    # 이전 스키마는 이체를 표현할 수 없다 — 이체 거래와 이체 카테고리를 제거
    conn.execute(sa.text("DELETE FROM transactions WHERE kind = 'transfer'"))
    conn.execute(sa.text("DELETE FROM categories WHERE kind = 'transfer'"))
    op.drop_constraint(
        "fk_transactions_counter_account_id_accounts", "transactions", type_="foreignkey"
    )
    op.drop_column("transactions", "counter_account_id")
