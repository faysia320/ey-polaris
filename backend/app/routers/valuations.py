from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers.utils import commit_or_conflict, get_or_404

router = APIRouter(prefix="/accounts/{account_id}/valuations", tags=["valuations"])


@router.get("", response_model=list[schemas.ValuationOut])
def list_valuations(account_id: int, db: Session = Depends(get_db)):
    get_or_404(db, models.Account, account_id, "자산 계정")
    return db.scalars(
        select(models.AssetValuation)
        .where(models.AssetValuation.account_id == account_id)
        .order_by(models.AssetValuation.date.desc())
    ).all()


@router.put("", response_model=schemas.ValuationOut)
def upsert_valuation(
    account_id: int, payload: schemas.ValuationUpsert, db: Session = Depends(get_db)
):
    """해당 계정·날짜의 평가액을 기록한다. 같은 날짜가 이미 있으면 값을 갱신한다(upsert)."""
    get_or_404(db, models.Account, account_id, "자산 계정")
    valuation = db.scalar(
        select(models.AssetValuation).where(
            models.AssetValuation.account_id == account_id,
            models.AssetValuation.date == payload.date,
        )
    )
    if valuation:
        valuation.value = payload.value
    else:
        valuation = models.AssetValuation(account_id=account_id, **payload.model_dump())
        db.add(valuation)
    # 동시 PUT 경합 시 유니크 제약 위반을 409로 일관 처리
    commit_or_conflict(db, f"{payload.date}의 평가액이 동시에 기록되었습니다. 다시 시도해주세요")
    db.refresh(valuation)
    return valuation


@router.delete("/{valuation_id}", status_code=204)
def delete_valuation(account_id: int, valuation_id: int, db: Session = Depends(get_db)):
    valuation = get_or_404(db, models.AssetValuation, valuation_id, "평가액")
    if valuation.account_id != account_id:
        # 다른 계정의 평가액 id를 지정한 경우 — 존재하지 않는 것으로 취급
        raise HTTPException(status_code=404, detail=f"평가액을 찾을 수 없습니다 (id={valuation_id})")
    db.delete(valuation)
    db.commit()
