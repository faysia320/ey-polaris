"""AI 월간 리포트(ai_reports) + 앱 설정 키-값(app_settings) 테이블 추가

- ai_reports: 생성할 때마다 새 행으로 누적되는 월별 AI 리포트.
  year_month 인덱스만 두고 유니크 제약은 없다(이력 누적). 최신 1건은 created_at 기준 조회.
- app_settings: OpenAI API 키/모델을 .env가 아닌 DB로 관리하기 위한 범용 키-값 저장소.
- downgrade는 두 테이블을 제거한다(저장된 리포트·설정 소실 — 파괴적임을 명시).

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-16

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(50), primary_key=True),
        sa.Column("value", sa.Text(), nullable=True),
    )
    op.create_table(
        "ai_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("year_month", sa.String(7), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("model", sa.String(50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_ai_reports_year_month", "ai_reports", ["year_month"])


def downgrade() -> None:
    op.drop_index("ix_ai_reports_year_month", table_name="ai_reports")
    op.drop_table("ai_reports")
    op.drop_table("app_settings")
