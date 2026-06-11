"""category 대/소분류 구조 전환 + 뱅크샐러드 엑셀 분류 재시드 + transactions.source

- categories.name → major 로 변경하고 minor(소분류, 기본 '미분류') 추가
- 유니크 제약을 (major, minor, kind)로 교체
- 엑셀 "가계부 내역" 분류 전수(지출 56쌍 + 수입 3쌍)와 앱 자체 '환불' 수입 카테고리를 시드
- 기존 0002 시드 중 엑셀 체계에 없는 항목은 거래·예산을 재매핑한 뒤 삭제
- transactions.source('manual' | 'import') 추가 — 엑셀 재업로드 시 import 출처만 교체하기 위함

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-11

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# 엑셀 "가계부 내역" 시트의 분류 전수. (대분류, [소분류...]) — 소분류 없는 행은 '미분류'
EXPENSE_SEED: list[tuple[str, list[str]]] = [
    ("경조/선물", ["선물"]),
    ("교육/학습", ["학원/강의"]),
    ("교통", ["대중교통", "철도", "택시"]),
    ("구독", ["서비스구독"]),
    ("금융", ["보험", "세금/과태료", "은행", "이자/대출", "증권/투자", "카드"]),
    ("문화/여가", ["게임", "도서", "미분류", "영화", "음악", "전시/관람", "취미/체험"]),
    ("미분류", ["미분류"]),
    ("생활", ["가전/가구", "마트", "미분류", "생필품", "편의점"]),
    ("식비", ["미분류", "배달", "식재료"]),
    ("여행/숙박", ["관광", "미분류", "숙박비", "여행", "항공권", "해외결제"]),
    ("의료/건강", ["건강용품", "미분류", "보조식품", "약국", "운동", "한의원"]),
    ("자동차", ["대리운전", "세차", "정비/수리", "주유", "주차", "차량보험", "통행료"]),
    ("주거/통신", ["관리비", "미분류", "인터넷", "휴대폰"]),
    ("카페/간식", ["기타간식", "미분류", "커피/음료"]),
    ("패션/뷰티", ["패션", "헤어"]),
]

# '환불'은 엑셀에 없는 앱 자체 카테고리 — 지출+양수(환불) 행을 수입으로 반영할 때 사용
INCOME_SEED: list[tuple[str, list[str]]] = [
    ("금융수입", ["미분류"]),
    ("급여", ["미분류"]),
    ("기타수입", ["미분류"]),
    ("환불", ["미분류"]),
]

# 정기 궤도(fixed)로 시드할 (대분류, 소분류, kind) — 나머지는 variable
FIXED_PAIRS = {
    ("구독", "서비스구독", "expense"),
    ("주거/통신", "관리비", "expense"),
    ("주거/통신", "미분류", "expense"),
    ("주거/통신", "인터넷", "expense"),
    ("주거/통신", "휴대폰", "expense"),
    ("금융", "보험", "expense"),
    ("금융", "이자/대출", "expense"),
    ("자동차", "차량보험", "expense"),
    ("급여", "미분류", "income"),
}

# 0002 시드 중 엑셀 체계에 없는 카테고리의 재매핑: (이전 name, kind) → (major, minor)
REMAP: list[tuple[str, str, str, str]] = [
    ("주거/관리비", "expense", "주거/통신", "관리비"),
    ("통신비", "expense", "주거/통신", "미분류"),
    ("보험", "expense", "금융", "보험"),
    ("구독 서비스", "expense", "구독", "서비스구독"),
    ("생활용품", "expense", "생활", "생필품"),
    ("경조사/선물", "expense", "경조/선물", "선물"),
    ("기타 지출", "expense", "미분류", "미분류"),
    ("상여", "income", "기타수입", "미분류"),
    ("이자/투자수익", "income", "금융수입", "미분류"),
    ("기타 수입", "income", "기타수입", "미분류"),
]


def _category_id(conn, major: str, minor: str, kind: str) -> int | None:
    return conn.execute(
        sa.text(
            "SELECT id FROM categories WHERE major = :major AND minor = :minor AND kind = :kind"
        ),
        {"major": major, "minor": minor, "kind": kind},
    ).scalar()


def _is_referenced(conn, category_id: int) -> bool:
    referenced = conn.execute(
        sa.text("SELECT 1 FROM transactions WHERE category_id = :id LIMIT 1"),
        {"id": category_id},
    ).scalar()
    if referenced:
        return True
    return bool(
        conn.execute(
            sa.text("SELECT 1 FROM budgets WHERE category_id = :id LIMIT 1"),
            {"id": category_id},
        ).scalar()
    )


def upgrade() -> None:
    # 1) 구조 전환: name → major, minor 추가('미분류' backfill), 유니크 제약 교체
    op.alter_column("categories", "name", new_column_name="major")
    op.add_column(
        "categories",
        sa.Column("minor", sa.String(length=100), nullable=False, server_default="미분류"),
    )
    op.drop_constraint("uq_categories_name_kind", "categories", type_="unique")
    op.create_unique_constraint(
        "uq_categories_major_minor_kind", "categories", ["major", "minor", "kind"]
    )

    # 2) transactions.source 추가
    op.add_column(
        "transactions",
        sa.Column("source", sa.String(length=10), nullable=False, server_default="manual"),
    )

    conn = op.get_bind()

    # 3) 엑셀 분류 전수 시드 (backfill 결과와 겹치는 쌍은 건너뜀)
    for kind, seed in (("expense", EXPENSE_SEED), ("income", INCOME_SEED)):
        for major, minors in seed:
            for minor in minors:
                if _category_id(conn, major, minor, kind) is None:
                    nature = "fixed" if (major, minor, kind) in FIXED_PAIRS else "variable"
                    conn.execute(
                        sa.text(
                            "INSERT INTO categories (major, minor, kind, nature) "
                            "VALUES (:major, :minor, :kind, :nature)"
                        ),
                        {"major": major, "minor": minor, "kind": kind, "nature": nature},
                    )

    # 4) 엑셀 체계에 없는 기존 시드 재매핑 후 삭제
    for old_name, kind, new_major, new_minor in REMAP:
        old_id = _category_id(conn, old_name, "미분류", kind)
        if old_id is None:
            continue
        new_id = _category_id(conn, new_major, new_minor, kind)
        conn.execute(
            sa.text("UPDATE transactions SET category_id = :new WHERE category_id = :old"),
            {"new": new_id, "old": old_id},
        )
        conn.execute(
            sa.text("UPDATE budgets SET category_id = :new WHERE category_id = :old"),
            {"new": new_id, "old": old_id},
        )
        conn.execute(sa.text("DELETE FROM categories WHERE id = :id"), {"id": old_id})

    # 5) 기존 '교통' 카테고리: 엑셀에 '교통>미분류' 쌍이 없음 — 참조가 없으면 정리
    legacy_transport = _category_id(conn, "교통", "미분류", "expense")
    if legacy_transport is not None and not _is_referenced(conn, legacy_transport):
        conn.execute(
            sa.text("DELETE FROM categories WHERE id = :id"), {"id": legacy_transport}
        )


def downgrade() -> None:
    # 구조만 복원한다 (재시드·재매핑된 데이터는 되돌리지 않음 — best effort)
    op.drop_column("transactions", "source")
    op.drop_constraint("uq_categories_major_minor_kind", "categories", type_="unique")
    op.drop_column("categories", "minor")
    op.alter_column("categories", "major", new_column_name="name")
    # 소분류 제거로 (name, kind) 중복이 생길 수 있어 이전 유니크 제약은 복원하지 않는다
