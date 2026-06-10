from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def get_or_404(db: Session, model, obj_id: int, label: str):
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status_code=404, detail=f"{label}을(를) 찾을 수 없습니다 (id={obj_id})")
    return obj


def commit_or_conflict(db: Session, message: str) -> None:
    """커밋하되 무결성 위반(FK 참조 중 삭제, 유니크 중복 등)은 409로 변환한다."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=message)
