"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-10

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=50), nullable=False, unique=True),
        sa.Column("color", sa.String(length=20), nullable=False),
    )
    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("opening_balance", sa.BigInteger(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("nature", sa.String(length=10), nullable=False),
        sa.UniqueConstraint("name", "kind", name="uq_categories_name_kind"),
    )
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("categories.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("accounts.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "member_id",
            sa.Integer(),
            sa.ForeignKey("members.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("memo", sa.String(length=255), nullable=True),
    )
    op.create_index("ix_transactions_date", "transactions", ["date"])
    op.create_table(
        "budgets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("year_month", sa.String(length=7), nullable=False),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("categories.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.UniqueConstraint("year_month", "category_id", name="uq_budgets_month_category"),
    )
    op.create_index("ix_budgets_year_month", "budgets", ["year_month"])


def downgrade() -> None:
    op.drop_table("budgets")
    op.drop_table("transactions")
    op.drop_table("categories")
    op.drop_table("accounts")
    op.drop_table("members")
