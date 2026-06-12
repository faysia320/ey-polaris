from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers.utils import commit_or_conflict, get_or_404

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=list[schemas.BudgetOut])
def list_budgets(
    month: str | None = Query(default=None, pattern=schemas.YEAR_MONTH_PATTERN),
    db: Session = Depends(get_db),
):
    stmt = select(models.Budget).order_by(
        models.Budget.year_month.desc(), models.Budget.id
    )
    if month:
        stmt = stmt.where(models.Budget.year_month == month)
    return db.scalars(stmt).all()


@router.post("", response_model=schemas.BudgetOut, status_code=201)
def create_budget(payload: schemas.BudgetCreate, db: Session = Depends(get_db)):
    # 예산은 지출 대분류 단위 — 해당 이름의 지출 카테고리가 1개 이상 존재해야 한다
    exists = db.scalar(
        select(models.Category.id)
        .where(models.Category.major == payload.major, models.Category.kind == "expense")
        .limit(1)
    )
    if exists is None:
        raise HTTPException(status_code=422, detail="예산은 지출 대분류에만 설정할 수 있습니다")
    budget = models.Budget(**payload.model_dump())
    db.add(budget)
    commit_or_conflict(db, f"{payload.year_month}의 해당 대분류 예산이 이미 존재합니다")
    db.refresh(budget)
    return budget


@router.put("/{budget_id}", response_model=schemas.BudgetOut)
def update_budget(budget_id: int, payload: schemas.BudgetUpdate, db: Session = Depends(get_db)):
    budget = get_or_404(db, models.Budget, budget_id, "예산")
    budget.amount = payload.amount
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = get_or_404(db, models.Budget, budget_id, "예산")
    db.delete(budget)
    db.commit()
