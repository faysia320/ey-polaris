from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app import excel_import, models, schemas
from app.database import get_db
from app.routers.utils import commit_or_conflict, get_or_404

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _month_range(month: str) -> tuple[date, date]:
    year, mon = int(month[:4]), int(month[5:7])
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end


def _to_out(t: models.Transaction) -> schemas.TransactionOut:
    return schemas.TransactionOut(
        id=t.id,
        date=t.date,
        amount=t.amount,
        kind=t.kind,
        category_id=t.category_id,
        account_id=t.account_id,
        member_id=t.member_id,
        memo=t.memo,
        category_name=t.category.display_name,
        account_name=t.account.name,
        member_name=t.member.name if t.member else None,
    )


def _validate_refs(db: Session, payload: schemas.TransactionCreate) -> None:
    category = get_or_404(db, models.Category, payload.category_id, "카테고리")
    get_or_404(db, models.Account, payload.account_id, "자산 계정")
    if payload.member_id is not None:
        get_or_404(db, models.Member, payload.member_id, "구성원")
    if category.kind != payload.kind:
        raise HTTPException(
            status_code=422,
            detail=f"카테고리 '{category.display_name}'은(는) {category.kind} 유형이라 {payload.kind} 거래에 쓸 수 없습니다",
        )


@router.get("", response_model=list[schemas.TransactionOut])
def list_transactions(
    month: str | None = Query(default=None, pattern=schemas.YEAR_MONTH_PATTERN),
    kind: schemas.CategoryKind | None = None,
    category_id: int | None = None,
    major: str | None = None,
    account_id: int | None = None,
    member_id: int | None = None,
    db: Session = Depends(get_db),
):
    stmt = (
        select(models.Transaction)
        .options(
            selectinload(models.Transaction.category),
            selectinload(models.Transaction.account),
            selectinload(models.Transaction.member),
        )
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
    )
    if month:
        start, end = _month_range(month)
        stmt = stmt.where(models.Transaction.date >= start, models.Transaction.date < end)
    if kind:
        stmt = stmt.where(models.Transaction.kind == kind)
    if category_id:
        stmt = stmt.where(models.Transaction.category_id == category_id)
    if major:
        # 대분류만 고른 경우 — 소분류 전체를 포괄하는 필터
        stmt = stmt.where(models.Transaction.category.has(models.Category.major == major))
    if account_id:
        stmt = stmt.where(models.Transaction.account_id == account_id)
    if member_id:
        stmt = stmt.where(models.Transaction.member_id == member_id)
    return [_to_out(t) for t in db.scalars(stmt).all()]


@router.post("", response_model=schemas.TransactionOut, status_code=201)
def create_transaction(payload: schemas.TransactionCreate, db: Session = Depends(get_db)):
    _validate_refs(db, payload)
    transaction = models.Transaction(**payload.model_dump())
    db.add(transaction)
    commit_or_conflict(db, "거래 저장 중 무결성 오류가 발생했습니다")
    db.refresh(transaction)
    return _to_out(transaction)


@router.put("/{transaction_id}", response_model=schemas.TransactionOut)
def update_transaction(
    transaction_id: int, payload: schemas.TransactionUpdate, db: Session = Depends(get_db)
):
    transaction = get_or_404(db, models.Transaction, transaction_id, "거래")
    _validate_refs(db, payload)
    for key, value in payload.model_dump().items():
        setattr(transaction, key, value)
    commit_or_conflict(db, "거래 저장 중 무결성 오류가 발생했습니다")
    db.refresh(transaction)
    return _to_out(transaction)


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = get_or_404(db, models.Transaction, transaction_id, "거래")
    db.delete(transaction)
    db.commit()


@router.post("/import", response_model=schemas.ImportResult)
def import_transactions(
    file: UploadFile = File(description="뱅크샐러드 내보내기 .xlsx 파일"),
    month: str = Form(pattern=schemas.YEAR_MONTH_PATTERN),
    db: Session = Depends(get_db),
):
    """엑셀 "가계부 내역" 시트에서 지정 월만 가져온다.

    같은 월의 기존 가져오기(source='import') 거래는 삭제 후 다시 등록하므로
    재업로드해도 중복되지 않는다. 수동 입력 거래는 보존된다.
    전 과정이 단일 트랜잭션이라 실패 시 기존 데이터가 유지된다.
    """
    try:
        parsed, skipped, month_rows = excel_import.parse_ledger(file.file.read(), month)
    except excel_import.ExcelFormatError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if month_rows == 0:
        # 빈 월을 잘못 골라 기존 데이터만 지우는 사고 방지
        raise HTTPException(status_code=422, detail=f"{month}에 해당하는 가계부 내역이 없습니다")

    start, end = _month_range(month)
    deleted = db.execute(
        delete(models.Transaction).where(
            models.Transaction.date >= start,
            models.Transaction.date < end,
            models.Transaction.source == "import",
        )
    ).rowcount

    categories = {
        (c.major, c.minor, c.kind): c for c in db.scalars(select(models.Category)).all()
    }
    accounts = {a.name: a for a in db.scalars(select(models.Account)).all()}
    created_categories: list[str] = []
    created_accounts: list[str] = []

    for row in parsed:
        key = (row.major, row.minor, row.kind)
        category = categories.get(key)
        if category is None:
            category = models.Category(
                major=row.major, minor=row.minor, kind=row.kind, nature="variable"
            )
            db.add(category)
            db.flush()
            categories[key] = category
            created_categories.append(category.display_name)

        account = accounts.get(row.account_name)
        if account is None:
            account = models.Account(
                name=row.account_name,
                type=excel_import.guess_account_type(row.account_name),
                opening_balance=0,
                is_active=True,
            )
            db.add(account)
            db.flush()
            accounts[row.account_name] = account
            created_accounts.append(account.name)

        db.add(
            models.Transaction(
                date=row.date,
                amount=row.amount,
                kind=row.kind,
                category_id=category.id,
                account_id=account.id,
                member_id=None,
                memo=row.memo,
                source="import",
            )
        )

    commit_or_conflict(db, "가져오기 저장 중 무결성 오류가 발생했습니다")
    return schemas.ImportResult(
        month=month,
        deleted_count=deleted,
        created_count=len(parsed),
        skipped=[schemas.ImportSkippedRow(row=s.row, reason=s.reason) for s in skipped],
        created_categories=created_categories,
        created_accounts=created_accounts,
    )
