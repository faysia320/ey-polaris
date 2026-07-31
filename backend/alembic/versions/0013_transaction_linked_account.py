"""거래별 연결 계정 — transactions.linked_account_id FK 도입

- transactions.linked_account_id FK(RESTRICT, nullable) 추가
  : 간편결제(easy_pay) 거래 한 건이 실제로 결제된 카드/은행 계정을 가리킨다.
    같은 간편결제라도 건마다 결제 카드가 다를 수 있어 계정에 고정하지 않는다.
    집계 라우팅에서 계정 기본 연결(accounts.linked_account_id)보다 우선한다.
- 기존 행은 모두 NULL이므로 마이그레이션 직후 집계 결과는 종전과 동일하다.
- accounts.linked_account_id는 이미 nullable이라 DDL 변경이 없다
  (간편결제 계정의 기본 연결 필수 여부는 애플리케이션 스키마 검증에서만 완화).
- downgrade는 FK·컬럼을 제거한다. 거래별 연결 정보는 소실된다 (파괴적임을 명시).

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-31

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("linked_account_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_transactions_linked_account_id_accounts",
        "transactions",
        "accounts",
        ["linked_account_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_transactions_linked_account_id_accounts", "transactions", type_="foreignkey"
    )
    op.drop_column("transactions", "linked_account_id")
