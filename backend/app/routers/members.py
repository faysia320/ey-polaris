from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers.utils import commit_or_conflict, get_or_404

router = APIRouter(prefix="/members", tags=["members"])


@router.get("", response_model=list[schemas.MemberOut])
def list_members(db: Session = Depends(get_db)):
    return db.scalars(select(models.Member).order_by(models.Member.id)).all()


@router.post("", response_model=schemas.MemberOut, status_code=201)
def create_member(payload: schemas.MemberCreate, db: Session = Depends(get_db)):
    member = models.Member(**payload.model_dump())
    db.add(member)
    commit_or_conflict(db, f"이미 존재하는 구성원 이름입니다: {payload.name}")
    return member


@router.put("/{member_id}", response_model=schemas.MemberOut)
def update_member(member_id: int, payload: schemas.MemberUpdate, db: Session = Depends(get_db)):
    member = get_or_404(db, models.Member, member_id, "구성원")
    for key, value in payload.model_dump().items():
        setattr(member, key, value)
    commit_or_conflict(db, f"이미 존재하는 구성원 이름입니다: {payload.name}")
    return member


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int, db: Session = Depends(get_db)):
    member = get_or_404(db, models.Member, member_id, "구성원")
    db.delete(member)
    commit_or_conflict(db, "거래 또는 계정(소유자)에서 참조 중인 구성원은 삭제할 수 없습니다")
