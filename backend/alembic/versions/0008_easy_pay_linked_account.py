"""간편결제(easy_pay) 계정 — linked_account_id 자기참조 FK 도입

- accounts.linked_account_id FK(RESTRICT, nullable) 추가
  : 간편결제 계정이 실제 결제되는 카드/은행 계정을 가리킨다.
    easy_pay가 아닌 계정에서는 항상 NULL.
- type은 String(20) 그대로이며 'easy_pay' 값을 새로 허용한다 (스키마 변경 없음).
- downgrade는 FK·컬럼을 제거한다. easy_pay 계정 자체는 type 문자열로 남으므로
  데이터는 보존되나 연결 정보는 소실된다 (파괴적임을 명시).

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-16

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("linked_account_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_accounts_linked_account_id_accounts",
        "accounts",
        "accounts",
        ["linked_account_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("fk_accounts_linked_account_id_accounts", "accounts", type_="foreignkey")
    op.drop_column("accounts", "linked_account_id")
