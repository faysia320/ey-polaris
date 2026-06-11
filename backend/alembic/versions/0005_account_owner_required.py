"""accounts.member_id (소유자) 필수 컬럼 추가

- accounts에 member_id FK(RESTRICT) 추가 — 모든 계정은 소유자가 필수
- 기존 계정(시드·엑셀 가져오기 생성분)은 id가 가장 작은 구성원으로 백필
- 구성원이 없는데 계정이 존재하면 백필이 불가능하므로 명확한 에러로 중단

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-11

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("member_id", sa.Integer(), nullable=True))

    conn = op.get_bind()
    has_accounts = conn.execute(sa.text("SELECT 1 FROM accounts LIMIT 1")).scalar()
    first_member = conn.execute(sa.text("SELECT id FROM members ORDER BY id LIMIT 1")).scalar()
    if has_accounts and first_member is None:
        raise RuntimeError(
            "계정이 존재하지만 구성원이 없어 소유자를 백필할 수 없습니다. "
            "구성원을 먼저 등록한 뒤 마이그레이션을 다시 실행하세요."
        )
    if first_member is not None:
        conn.execute(
            sa.text("UPDATE accounts SET member_id = :member_id WHERE member_id IS NULL"),
            {"member_id": first_member},
        )

    op.alter_column("accounts", "member_id", nullable=False)
    op.create_foreign_key(
        "fk_accounts_member_id_members",
        "accounts",
        "members",
        ["member_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("fk_accounts_member_id_members", "accounts", type_="foreignkey")
    op.drop_column("accounts", "member_id")
