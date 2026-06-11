"""asset valuations (자산 평가액) and goals (목표 금액)

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-11

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "asset_valuations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("value", sa.BigInteger(), nullable=False),
        sa.UniqueConstraint("account_id", "date", name="uq_asset_valuations_account_date"),
    )
    op.create_index("ix_asset_valuations_date", "asset_valuations", ["date"])
    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("target_amount", sa.BigInteger(), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("goals")
    op.drop_table("asset_valuations")
