"""자산 계정 식별키 — 이름 전역 유니크 → (name, member_id, type) 복합 유니크

- accounts.name의 전역 UNIQUE 제약(0001에서 인라인 생성, Postgres 자동명 accounts_name_key)을 제거.
- (name, member_id, type) 복합 UNIQUE(uq_accounts_name_member_type)를 추가 —
  이름 중복은 소유자·유형까지 같을 때만 성립(다른 소유자/유형이면 동명 허용).
- 기존 데이터는 전역 유니크 하에 이미 유일하므로 복합 유니크로 전환 시 위반 없음(무손실).
- downgrade는 역순: 복합 제약을 제거하고 name 전역 유니크를 복원한다.

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-24

"""
from collections.abc import Sequence

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 0001에서 컬럼 인라인 unique=True로 생성된 제약(Postgres 자동명). 이름 편차 대비 IF EXISTS.
    op.execute("ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_name_key")
    op.create_unique_constraint(
        "uq_accounts_name_member_type", "accounts", ["name", "member_id", "type"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_accounts_name_member_type", "accounts", type_="unique")
    op.create_unique_constraint("accounts_name_key", "accounts", ["name"])
