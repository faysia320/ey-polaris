"""거래 묶음(transaction_links) — 저장된 수입/지출 2건을 사후 연결(이체/환불)

- transaction_links: link_type(transfer|refund) + created_at.
- transactions.link_id FK(ondelete SET NULL, nullable) + 인덱스.
  묶음 그룹 삭제(해제) 시 거래는 보존되고 link_id만 NULL이 된다.
- downgrade는 link_id 컬럼과 transaction_links 테이블을 제거한다(묶음 정보 소실 — 파괴적).

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-23

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "transaction_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("link_type", sa.String(10), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.add_column("transactions", sa.Column("link_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_transactions_link_id_transaction_links",
        "transactions",
        "transaction_links",
        ["link_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_transactions_link_id", "transactions", ["link_id"])


def downgrade() -> None:
    op.drop_index("ix_transactions_link_id", table_name="transactions")
    op.drop_constraint(
        "fk_transactions_link_id_transaction_links", "transactions", type_="foreignkey"
    )
    op.drop_column("transactions", "link_id")
    op.drop_table("transaction_links")
