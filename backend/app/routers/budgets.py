from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.database import get_db
from app.routers.utils import commit_or_conflict, get_or_404

router = APIRouter(prefix="/budgets", tags=["budgets"])


def _to_out(b: models.Budget) -> schemas.BudgetOut:
    return schemas.BudgetOut(
        id=b.id,
        year_month=b.year_month,
        category_id=b.category_id,
        amount=b.amount,
        category_name=b.category.name,
    )


@router.get("", response_model=list[schemas.BudgetOut])
def list_budgets(
    month: str | None = Query(default=None, pattern=schemas.YEAR_MONTH_PATTERN),
    db: Session = Depends(get_db),
):
    stmt = select(models.Budget).options(selectinload(models.Budget.category)).order_by(
        models.Budget.year_month.desc(), models.Budget.id
    )
    if month:
        stmt = stmt.where(models.Budget.year_month == month)
    return [_to_out(b) for b in db.scalars(stmt).all()]


@router.post("", response_model=schemas.BudgetOut, status_code=201)
def create_budget(payload: schemas.BudgetCreate, db: Session = Depends(get_db)):
    category = get_or_404(db, models.Category, payload.category_id, "카테고리")
    if category.kind != "expense":
        raise HTTPException(status_code=422, detail="예산은 지출 카테고리에만 설정할 수 있습니다")
    budget = models.Budget(**payload.model_dump())
    db.add(budget)
    commit_or_conflict(db, f"{payload.year_month}의 해당 카테고리 예산이 이미 존재합니다")
    db.refresh(budget)
    return _to_out(budget)


@router.put("/{budget_id}", response_model=schemas.BudgetOut)
def update_budget(budget_id: int, payload: schemas.BudgetUpdate, db: Session = Depends(get_db)):
    budget = get_or_404(db, models.Budget, budget_id, "예산")
    budget.amount = payload.amount
    db.commit()
    db.refresh(budget)
    return _to_out(budget)


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = get_or_404(db, models.Budget, budget_id, "예산")
    db.delete(budget)
    db.commit()
