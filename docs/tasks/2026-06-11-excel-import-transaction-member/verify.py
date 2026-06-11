# 엑셀 가져오기 구성원 귀속 검증 스크립트 (실 DB 미사용 — sqlite in-memory)
# 실행: Get-Content verify.py -Raw | docker compose exec -T backend python -
from datetime import date
from io import BytesIO

from openpyxl import Workbook
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.datastructures import UploadFile

from app import models
from app.routers.transactions import import_transactions

engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
models.Base.metadata.create_all(engine)
db = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()

# 시드: 구성원 2명, 레거시 데이터(구성원 없는 import 거래 1건 + 수동 거래 1건)
m_a = models.Member(name="으니")
m_b = models.Member(name="영이")
db.add_all([m_a, m_b])
db.commit()
acc = models.Account(name="레거시카드", type="card", opening_balance=0, is_active=True, member_id=m_a.id)
cat = models.Category(major="식사", minor="미분류", kind="expense")
db.add_all([acc, cat])
db.flush()
db.add(models.Transaction(date=date(2026, 5, 2), amount=1000, kind="expense",
                          category_id=cat.id, account_id=acc.id, member_id=None,
                          memo="legacy-import", source="import"))
db.add(models.Transaction(date=date(2026, 5, 3), amount=2000, kind="expense",
                          category_id=cat.id, account_id=acc.id, member_id=None,
                          memo="manual", source="manual"))
db.commit()


def xlsx(rows: list[list]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "가계부 내역"
    ws.append(["날짜", "타입", "대분류", "소분류", "내용", "금액", "화폐", "결제수단", "메모"])
    for r in rows:
        ws.append(r)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def upload(content: bytes, member_id: int):
    return import_transactions(file=UploadFile(BytesIO(content)), month="2026-05",
                               member_id=member_id, db=db)


def month_imports():
    return db.scalars(select(models.Transaction).where(
        models.Transaction.source == "import",
        models.Transaction.date >= date(2026, 5, 1),
        models.Transaction.date < date(2026, 6, 1),
    )).all()


file_a = xlsx([
    [date(2026, 5, 10), "지출", "식사", "아침", "김밥", -5000, "KRW", "으니카드", ""],
    [date(2026, 5, 25), "수입", "급여", "", "월급", 3000000, "KRW", "으니통장", ""],
])
file_b = xlsx([
    [date(2026, 5, 11), "지출", "교통", "택시", "퇴근", -12000, "KRW", "영이카드", ""],
])

# AC-1: A 업로드 → 모든 import 거래가 선택 구성원(A) 소유
r1 = upload(file_a, m_a.id)
assert r1.created_count == 2, r1
txs = month_imports()
assert all(t.member_id == m_a.id for t in txs), [(t.memo, t.member_id) for t in txs]
# AC-4 일부: 레거시 NULL import 거래가 정리됨(deleted=1), 수동 거래는 보존
assert r1.deleted_count == 1, r1.deleted_count
manual = db.scalars(select(models.Transaction).where(models.Transaction.source == "manual")).all()
assert len(manual) == 1 and manual[0].member_id is None
print("PASS AC-1: 업로드된 모든 거래가 선택 구성원으로 기록됨 (레거시 NULL 정리·수동 보존 포함)")

# AC-2: 같은 월에 B 업로드 → A 거래 보존
r2 = upload(file_b, m_b.id)
assert r2.deleted_count == 0, r2.deleted_count
txs = month_imports()
assert len(txs) == 3
assert sum(t.member_id == m_a.id for t in txs) == 2
assert sum(t.member_id == m_b.id for t in txs) == 1
print("PASS AC-2: 다른 구성원 업로드가 기존 구성원 거래를 보존함")

# AC-3: 구성원 필터로 import 거래 조회 가능
filtered = db.scalars(select(models.Transaction).where(
    models.Transaction.member_id == m_b.id, models.Transaction.source == "import")).all()
assert len(filtered) == 1 and filtered[0].memo == "퇴근"
print("PASS AC-3: member_id 필터에 import 거래가 잡힘")

# AC-4: 같은 구성원 재업로드 → 본인 것만 교체, 중복 없음
r3 = upload(file_a, m_a.id)
assert r3.deleted_count == 2 and r3.created_count == 2, (r3.deleted_count, r3.created_count)
txs = month_imports()
assert len(txs) == 3
assert sum(t.member_id == m_a.id for t in txs) == 2
print("PASS AC-4: 같은 구성원 재업로드 시 중복 없이 교체, 타 구성원 보존")

print("ALL PASS")
