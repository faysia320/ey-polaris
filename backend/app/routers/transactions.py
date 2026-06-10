from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.database import get_db
from app.routers.utils import commit_or_conflict, get_or_404

router = APIRouter(prefix="/transactions", tags=["transactions"])


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
        category_name=t.category.name,
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
            detail=f"카테고리 '{category.name}'은(는) {category.kind} 유형이라 {payload.kind} 거래에 쓸 수 없습니다",
        )


@router.get("", response_model=list[schemas.TransactionOut])
def list_transactions(
    month: str | None = Query(default=None, pattern=schemas.YEAR_MONTH_PATTERN),
    kind: schemas.CategoryKind | None = None,
    category_id: int | None = None,
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
        year, mon = int(month[:4]), int(month[5:7])
        from datetime import date

        start = date(year, mon, 1)
        end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
        stmt = stmt.where(models.Transaction.date >= start, models.Transaction.date < end)
    if kind:
        stmt = stmt.where(models.Transaction.kind == kind)
    if category_id:
        stmt = stmt.where(models.Transaction.category_id == category_id)
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
