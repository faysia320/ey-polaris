from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers.utils import commit_or_conflict, get_or_404

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[schemas.AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return db.scalars(select(models.Account).order_by(models.Account.id)).all()


@router.post("", response_model=schemas.AccountOut, status_code=201)
def create_account(payload: schemas.AccountCreate, db: Session = Depends(get_db)):
    account = models.Account(**payload.model_dump())
    db.add(account)
    commit_or_conflict(db, f"이미 존재하는 계정 이름입니다: {payload.name}")
    return account


@router.put("/{account_id}", response_model=schemas.AccountOut)
def update_account(account_id: int, payload: schemas.AccountUpdate, db: Session = Depends(get_db)):
    account = get_or_404(db, models.Account, account_id, "자산 계정")
    for key, value in payload.model_dump().items():
        setattr(account, key, value)
    commit_or_conflict(db, f"이미 존재하는 계정 이름입니다: {payload.name}")
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = get_or_404(db, models.Account, account_id, "자산 계정")
    db.delete(account)
    commit_or_conflict(db, "거래에서 참조 중인 계정은 삭제할 수 없습니다 (비활성화를 사용하세요)")
