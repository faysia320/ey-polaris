"""budgets를 지출 대분류(major) 단위로 전환

- budgets.major(문자열) 추가 — 카테고리 FK 대신 대분류 이름으로 직접 키잉
- 소분류가 지정된 기존 예산은 삭제 (개발 단계 — 데이터 보존 불요 확인됨),
  소분류 '미분류' 예산만 대분류로 백필
- category_id 컬럼·FK·기존 유니크 제거, (year_month, major) 유니크 추가

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-12

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("budgets", sa.Column("major", sa.String(length=100), nullable=True))
    op.execute(
        """
        DELETE FROM budgets
        USING categories c
        WHERE budgets.category_id = c.id AND c.minor <> '미분류'
        """
    )
    op.execute(
        """
        UPDATE budgets
        SET major = c.major
        FROM categories c
        WHERE budgets.category_id = c.id
        """
    )
    op.alter_column("budgets", "major", nullable=False)
    op.drop_constraint("uq_budgets_month_category", "budgets", type_="unique")
    # 0001에서 무명 생성된 FK — Postgres 자동 명명 규칙
    op.drop_constraint("budgets_category_id_fkey", "budgets", type_="foreignkey")
    op.drop_column("budgets", "category_id")
    op.create_unique_constraint("uq_budgets_month_major", "budgets", ["year_month", "major"])


def downgrade() -> None:
    op.add_column("budgets", sa.Column("category_id", sa.Integer(), nullable=True))
    # 대분류 → (major, minor='미분류', kind='expense') 카테고리 행으로 역매핑, 불가능한 행은 삭제
    op.execute(
        """
        UPDATE budgets
        SET category_id = c.id
        FROM categories c
        WHERE c.major = budgets.major AND c.minor = '미분류' AND c.kind = 'expense'
        """
    )
    op.execute("DELETE FROM budgets WHERE category_id IS NULL")
    op.alter_column("budgets", "category_id", nullable=False)
    op.drop_constraint("uq_budgets_month_major", "budgets", type_="unique")
    op.drop_column("budgets", "major")
    op.create_foreign_key(
        "budgets_category_id_fkey",
        "budgets",
        "categories",
        ["category_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_unique_constraint(
        "uq_budgets_month_category", "budgets", ["year_month", "category_id"]
    )
