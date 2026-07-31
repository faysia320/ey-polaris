from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers.utils import commit_or_conflict, get_or_404

router = APIRouter(prefix="/accounts", tags=["accounts"])

# 간편결제 계정이 연결할 수 있는 실물 자산 유형 — 실제 결제가 빠지는 카드/은행만 허용
LINKABLE_TYPES = ("card", "bank")


def _validate_linked_account(db: Session, payload: schemas.AccountCreate, self_id: int | None) -> None:
    """easy_pay 계정의 기본 연결 계정 정합성 검증 (존재·유형·자기참조).

    기본 연결은 선택이므로 미지정(None)은 그대로 통과한다 — 이때 귀속은 거래별
    연결 계정에 맡겨진다. 유형↔연결 필드 존재 규칙은 스키마 model_validator가 강제한다.
    """
    if payload.type != "easy_pay" or payload.linked_account_id is None:
        return
    if payload.linked_account_id == self_id:
        raise HTTPException(status_code=422, detail="연결 계정으로 자기 자신을 지정할 수 없습니다")
    linked = get_or_404(db, models.Account, payload.linked_account_id, "연결 계정")
    if linked.type not in LINKABLE_TYPES:
        raise HTTPException(
            status_code=422, detail="연결 계정은 카드 또는 은행 계정이어야 합니다"
        )


@router.get("", response_model=list[schemas.AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return db.scalars(select(models.Account).order_by(models.Account.id)).all()


@router.post("", response_model=schemas.AccountOut, status_code=201)
def create_account(payload: schemas.AccountCreate, db: Session = Depends(get_db)):
    get_or_404(db, models.Member, payload.member_id, "구성원")
    _validate_linked_account(db, payload, self_id=None)
    account = models.Account(**payload.model_dump())
    db.add(account)
    commit_or_conflict(db, f"같은 소유자·유형의 계정 이름이 이미 있습니다: {payload.name}")
    return account


@router.put("/{account_id}", response_model=schemas.AccountOut)
def update_account(account_id: int, payload: schemas.AccountUpdate, db: Session = Depends(get_db)):
    account = get_or_404(db, models.Account, account_id, "자산 계정")
    get_or_404(db, models.Member, payload.member_id, "구성원")
    _validate_linked_account(db, payload, self_id=account_id)
    # 간편결제에서 다른 유형으로 바꾸면 이 계정으로 결제한 거래의 건별 연결이 "간편결제가
    # 아닌데 연결 계정이 있는" 무효 상태로 남는다. 조용히 지우면 사용자가 입력한 귀속
    # 정보가 사라지므로, 건별 연결이 달린 거래가 있으면 유형 변경 자체를 거부한다.
    if account.type == "easy_pay" and payload.type != "easy_pay":
        linked_tx_count = db.scalar(
            select(func.count())
            .select_from(models.Transaction)
            .where(
                models.Transaction.account_id == account_id,
                models.Transaction.linked_account_id.is_not(None),
            )
        )
        if linked_tx_count:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"이 계정으로 결제한 거래 {linked_tx_count}건에 연결 계정이 지정되어 있어 "
                    "유형을 바꿀 수 없습니다. 해당 거래의 연결 계정을 먼저 해제해주세요"
                ),
            )
    for key, value in payload.model_dump().items():
        setattr(account, key, value)
    commit_or_conflict(db, f"같은 소유자·유형의 계정 이름이 이미 있습니다: {payload.name}")
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = get_or_404(db, models.Account, account_id, "자산 계정")
    db.delete(account)
    commit_or_conflict(db, "거래에서 참조 중인 계정은 삭제할 수 없습니다 (비활성화를 사용하세요)")
