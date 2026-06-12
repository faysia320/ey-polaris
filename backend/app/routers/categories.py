from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers.utils import commit_or_conflict, get_or_404

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Category).order_by(
            models.Category.kind, models.Category.major, models.Category.minor
        )
    ).all()


@router.post("", response_model=schemas.CategoryOut, status_code=201)
def create_category(payload: schemas.CategoryCreate, db: Session = Depends(get_db)):
    category = models.Category(**payload.model_dump())
    db.add(category)
    commit_or_conflict(db, f"이미 존재하는 카테고리입니다: {payload.major} > {payload.minor}")
    return category


@router.put("/{category_id}", response_model=schemas.CategoryOut)
def update_category(
    category_id: int, payload: schemas.CategoryUpdate, db: Session = Depends(get_db)
):
    category = get_or_404(db, models.Category, category_id, "카테고리")
    for key, value in payload.model_dump().items():
        setattr(category, key, value)
    commit_or_conflict(db, f"이미 존재하는 카테고리입니다: {payload.major} > {payload.minor}")
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = get_or_404(db, models.Category, category_id, "카테고리")
    db.delete(category)
    commit_or_conflict(db, "거래에서 참조 중인 카테고리는 삭제할 수 없습니다")
