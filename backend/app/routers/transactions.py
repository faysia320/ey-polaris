from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app import excel_import, models, schemas
from app.database import get_db
from app.routers.accounts import LINKABLE_TYPES
from app.routers.utils import commit_or_conflict, get_or_404

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _month_range(month: str) -> tuple[date, date]:
    year, mon = int(month[:4]), int(month[5:7])
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end


def _settlement_account_name(t: models.Transaction) -> str | None:
    """이 거래가 실제로 귀속되는 결제 계정 이름 — analytics 패스스루와 같은 우선순위로
    건별 지정 > 간편결제 계정의 기본 연결 > 없음(귀속되지 않음)을 따른다."""
    if t.account.type != "easy_pay":
        return None
    if t.linked_account is not None:
        return t.linked_account.name
    if t.account.linked_account is not None:
        return t.account.linked_account.name
    return None


def _partner_of(t: models.Transaction) -> schemas.TransactionLinkPartner | None:
    """묶음의 짝 다리(자기 자신이 아닌 나머지 거래) 요약을 만든다. 묶이지 않았거나
    짝을 못 찾으면(반쪽 묶음) None. 병합 행/묶음 보기가 짝 정보를 필요로 한다."""
    if t.link is None:
        return None
    partner = next((x for x in t.link.transactions if x.id != t.id), None)
    if partner is None:
        return None
    return schemas.TransactionLinkPartner(
        id=partner.id,
        date=partner.date,
        time=partner.time,
        kind=partner.kind,
        amount=partner.amount,
        category_name=partner.category.display_name,
        account_name=partner.account.name,
        linked_account_name=_settlement_account_name(partner),
        memo=partner.memo,
    )


def _to_out(t: models.Transaction) -> schemas.TransactionOut:
    return schemas.TransactionOut(
        id=t.id,
        date=t.date,
        time=t.time,
        amount=t.amount,
        kind=t.kind,
        category_id=t.category_id,
        account_id=t.account_id,
        counter_account_id=t.counter_account_id,
        linked_account_id=t.linked_account_id,
        member_id=t.member_id,
        memo=t.memo,
        category_name=t.category.display_name,
        account_name=t.account.name,
        counter_account_name=t.counter_account.name if t.counter_account else None,
        linked_account_name=_settlement_account_name(t),
        member_name=t.member.name if t.member else None,
        link_id=t.link_id,
        link_type=t.link.link_type if t.link else None,
        linked_partner=_partner_of(t),
    )


def _validate_refs(db: Session, payload: schemas.TransactionCreate) -> None:
    category = get_or_404(db, models.Category, payload.category_id, "카테고리")
    account = get_or_404(db, models.Account, payload.account_id, "자산 계정")
    if payload.linked_account_id is not None:
        # 건별 연결 계정은 간편결제 결제수단 거래에서만 의미가 있다 — 그 외에서 허용하면
        # 집계 라우팅이 무시하는 값이 조용히 저장된다.
        if account.type != "easy_pay":
            raise HTTPException(
                status_code=422,
                detail="연결 계정은 간편결제 계정으로 결제한 거래에만 지정할 수 있습니다",
            )
        linked = get_or_404(db, models.Account, payload.linked_account_id, "연결 계정")
        if linked.type not in LINKABLE_TYPES:
            raise HTTPException(
                status_code=422, detail="연결 계정은 카드 또는 은행 계정이어야 합니다"
            )
    if payload.kind == "transfer":
        # 이체는 출금(account_id)→입금(counter_account_id) 두 다리가 모두 필요
        if payload.counter_account_id is None:
            raise HTTPException(status_code=422, detail="이체 거래에는 입금 계정이 필요합니다")
        if payload.counter_account_id == payload.account_id:
            raise HTTPException(
                status_code=422, detail="출금 계정과 입금 계정은 서로 달라야 합니다"
            )
        get_or_404(db, models.Account, payload.counter_account_id, "입금 계정")
    elif payload.counter_account_id is not None:
        raise HTTPException(
            status_code=422, detail="수입/지출 거래에는 입금 계정을 지정할 수 없습니다"
        )
    if payload.member_id is not None:
        get_or_404(db, models.Member, payload.member_id, "구성원")
    if category.kind != payload.kind:
        raise HTTPException(
            status_code=422,
            detail=f"카테고리 '{category.display_name}'은(는) {category.kind} 유형이라 {payload.kind} 거래에 쓸 수 없습니다",
        )


def _filter_conditions(
    month: str | None,
    kind: str | None,
    category_id: int | None,
    major: str | None,
    account_id: int | None,
    member_id: int | None,
) -> list:
    """목록 조회와 월 일괄 삭제가 공유하는 필터 조건.

    삭제가 '화면에 보이는 것만' 지우려면 두 곳의 조건이 항상 같아야 하므로
    한 곳에서만 정의한다.
    """
    conditions = []
    if month:
        start, end = _month_range(month)
        conditions += [models.Transaction.date >= start, models.Transaction.date < end]
    if kind:
        conditions.append(models.Transaction.kind == kind)
    if category_id:
        conditions.append(models.Transaction.category_id == category_id)
    if major:
        # 대분류만 고른 경우 — 소분류 전체를 포괄하는 필터
        conditions.append(models.Transaction.category.has(models.Category.major == major))
    if account_id:
        conditions.append(models.Transaction.account_id == account_id)
    if member_id:
        conditions.append(models.Transaction.member_id == member_id)
    return conditions


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
    # 묶음의 짝 다리 요약(_partner_of)까지 한 번에 로드해 N+1을 피한다:
    # link → transactions(짝 포함) → 각 거래의 account·category.
    partner_leg = selectinload(models.Transaction.link).selectinload(
        models.TransactionLink.transactions
    )
    stmt = (
        select(models.Transaction)
        .options(
            selectinload(models.Transaction.category),
            # 계정의 기본 연결까지 따라 로드한다 — 건별 지정이 없을 때 귀속 계정 이름을 만든다
            selectinload(models.Transaction.account).selectinload(models.Account.linked_account),
            selectinload(models.Transaction.counter_account),
            selectinload(models.Transaction.linked_account),
            selectinload(models.Transaction.member),
            # 짝 다리도 귀속 계정 이름을 내보내므로 계정·기본 연결·건별 연결을 함께 로드한다
            partner_leg.selectinload(models.Transaction.account).selectinload(
                models.Account.linked_account
            ),
            partner_leg.selectinload(models.Transaction.linked_account),
            partner_leg.selectinload(models.Transaction.category),
        )
        .where(*_filter_conditions(month, kind, category_id, major, account_id, member_id))
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
    )
    return [_to_out(t) for t in db.scalars(stmt).all()]


@router.delete("", response_model=schemas.BulkDeleteResult)
def delete_transactions_by_month(
    # month는 필수 — 미지정 시 전체 거래가 지워지는 사고를 막는다
    month: str = Query(pattern=schemas.YEAR_MONTH_PATTERN),
    kind: schemas.CategoryKind | None = None,
    category_id: int | None = None,
    major: str | None = None,
    account_id: int | None = None,
    member_id: int | None = None,
    db: Session = Depends(get_db),
):
    """현재 조회 필터에 걸리는 해당 월 거래를 일괄 삭제한다."""
    conditions = _filter_conditions(month, kind, category_id, major, account_id, member_id)
    # major 필터의 EXISTS 서브쿼리까지 한 문장에 실어 단일 쿼리로 지운다
    # (id를 먼저 뽑아 IN으로 지우면 그 사이 삽입된 행을 놓치고, 건수가 많으면
    #  bind 파라미터 상한에도 걸린다)
    deleted = db.execute(
        delete(models.Transaction).where(*conditions).execution_options(
            synchronize_session=False
        )
    ).rowcount
    db.commit()
    return schemas.BulkDeleteResult(deleted_count=deleted)


def _check_link_pair(
    link_type: str,
    income_amount: int,
    income_account_id: int,
    expense_amount: int,
    expense_account_id: int,
) -> None:
    """묶음 쌍(수입/지출)이 유형별 규칙을 만족하는지 검증한다 (묶기 생성·수정 재검증 공유).

    위반 시 422를 던진다. transfer는 다른 계정·같은 금액, refund는 환불(수입) ≤ 지출.
    """
    if link_type == "transfer":
        if income_account_id == expense_account_id:
            raise HTTPException(
                status_code=422, detail="이체 묶음은 출금·입금 계정이 서로 달라야 합니다"
            )
        if income_amount != expense_amount:
            raise HTTPException(
                status_code=422, detail="이체 묶음은 두 거래의 금액이 같아야 합니다"
            )
    else:  # refund
        if income_amount > expense_amount:
            raise HTTPException(
                status_code=422, detail="환불 금액이 지출 금액보다 클 수 없습니다"
            )


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
    # 묶인 거래 수정은 묶음 정합성을 깨뜨릴 수 있다(예: 환불 수입을 지출보다 크게, 이체
    # 금액 불일치, 같은 계정화). 짝 다리와 함께 유형별 규칙을 재검증하고 위반이면 거부한다.
    # setattr 전에 payload 값으로 검증해 세션을 더럽히지 않는다.
    if transaction.link_id is not None:
        partner = db.scalar(
            select(models.Transaction).where(
                models.Transaction.link_id == transaction.link_id,
                models.Transaction.id != transaction.id,
            )
        )
        # 짝이 없으면(반쪽 묶음) 재검증할 대상이 없다 — 삭제/해제 경로가 정리를 담당
        if partner is not None:
            link = db.get(models.TransactionLink, transaction.link_id)
            # 수정 후 상태: 이 거래는 payload 값, 짝은 DB 원본
            legs = [
                (payload.kind, payload.amount, payload.account_id),
                (partner.kind, partner.amount, partner.account_id),
            ]
            income = next((leg for leg in legs if leg[0] == "income"), None)
            expense = next((leg for leg in legs if leg[0] == "expense"), None)
            if income is None or expense is None:
                raise HTTPException(
                    status_code=422,
                    detail="묶인 거래는 수입/지출 구분을 유지해야 합니다. 먼저 묶음을 해제해주세요",
                )
            _check_link_pair(link.link_type, income[1], income[2], expense[1], expense[2])
    for key, value in payload.model_dump().items():
        setattr(transaction, key, value)
    commit_or_conflict(db, "거래 저장 중 무결성 오류가 발생했습니다")
    db.refresh(transaction)
    return _to_out(transaction)


@router.post("/link", response_model=schemas.TransactionLinkOut, status_code=201)
def link_transactions(payload: schemas.TransactionLinkCreate, db: Session = Depends(get_db)):
    """저장된 거래 2건(수입 1 + 지출 1)을 사후에 하나의 묶음으로 연결한다.

    원본 거래는 보존하고 link_id로만 연결한다 (병합/삭제 아님). 통계 상쇄는
    analytics 집계가 link_type에 따라 처리한다:
      transfer — 서로 다른 계정·같은 금액. 두 다리 모두 수입/지출 통계에서 제외.
      refund   — 환불(수입) ≤ 지출. 지출에서 환불액을 뺀 순지출만 통계에 반영.
    """
    ids = payload.transaction_ids
    if len(set(ids)) != 2:
        raise HTTPException(status_code=422, detail="서로 다른 거래 2건을 선택해주세요")
    txs = db.scalars(
        select(models.Transaction).where(models.Transaction.id.in_(ids))
    ).all()
    if len(txs) != 2:
        raise HTTPException(status_code=404, detail="선택한 거래를 찾을 수 없습니다")
    if any(t.link_id is not None for t in txs):
        raise HTTPException(
            status_code=422, detail="이미 다른 묶음에 속한 거래가 포함되어 있습니다"
        )
    income = next((t for t in txs if t.kind == "income"), None)
    expense = next((t for t in txs if t.kind == "expense"), None)
    if income is None or expense is None:
        raise HTTPException(
            status_code=422, detail="수입 1건과 지출 1건을 함께 선택해주세요"
        )

    _check_link_pair(
        payload.link_type,
        income.amount,
        income.account_id,
        expense.amount,
        expense.account_id,
    )

    link = models.TransactionLink(link_type=payload.link_type)
    db.add(link)
    db.flush()
    income.link_id = link.id
    expense.link_id = link.id
    db.commit()
    return schemas.TransactionLinkOut(
        id=link.id, link_type=link.link_type, transaction_ids=ids
    )


@router.delete("/link/{link_id}", status_code=204)
def unlink_transactions(link_id: int, db: Session = Depends(get_db)):
    """묶음을 해제한다 — 두 거래는 보존되고 link_id만 NULL로 복원된다."""
    link = get_or_404(db, models.TransactionLink, link_id, "묶음")
    db.execute(
        update(models.Transaction)
        .where(models.Transaction.link_id == link_id)
        .values(link_id=None)
    )
    db.delete(link)
    db.commit()


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = get_or_404(db, models.Transaction, transaction_id, "거래")
    # 묶인 거래를 그냥 지우면 짝 다리가 반쪽 묶음으로 남아(link_id 유지) 통계에서
    # 조용히 제외되고 링크 행도 고아가 된다. 삭제 전에 소속 묶음을 통째로 해제해
    # 짝 다리를 독립 거래로 되돌린다(unlink_transactions와 동일한 정리 로직).
    if transaction.link_id is not None:
        link_id = transaction.link_id
        db.execute(
            update(models.Transaction)
            .where(models.Transaction.link_id == link_id)
            .values(link_id=None)
        )
        db.execute(delete(models.TransactionLink).where(models.TransactionLink.id == link_id))
    db.delete(transaction)
    db.commit()


# 이체 검토 결정 JSON(multipart 문자열 필드) 파서
_DECISIONS_ADAPTER = TypeAdapter(list[schemas.ImportDecision])
# 자산 계정 매핑 결정 JSON(multipart 문자열 필드) 파서
_MAPPINGS_ADAPTER = TypeAdapter(list[schemas.ImportAccountMapping])

# 검토 행을 이체로 적재할 때의 카테고리(0006 시드 '이체' 대분류) 소분류 매핑 —
# 시드에 있는 원본 대분류는 그대로, 그 외(이체/현금/미분류 등)는 '미분류'
TRANSFER_MAJOR = "이체"
TRANSFER_MINOR_MAJORS = {"내계좌이체", "카드대금", "저축", "투자"}


def _suggest_action(row: excel_import.ReviewRow) -> schemas.ImportAction:
    """검토 행 기본 제안 — 내계좌이체·카드대금은 이체, 그 외는 부호 기반 수입/지출."""
    if row.major in (excel_import.OWN_TRANSFER_MAJOR, "카드대금"):
        return "transfer"
    return "income" if row.amount > 0 else "expense"


def _effective_valuations(
    content: bytes, accounts: dict[str, models.Account]
) -> list[excel_import.ParsedValuation]:
    """뱅샐현황 평가액 중 실제로 반영될 항목만 추린다(미리보기·적재 공유).

    주식은 파싱 단계에서 이미 제외되므로(excel_import.VALUATION_ITEM_TYPES) 여기서는
    부동산만 다룬다.

    - 같은 상품명은 합치되, 0원이 비영 평가액을 덮어쓰지 않도록 마지막 비영값을 우선한다.
    - 동명 계정이 real_estate가 아니면(은행·주식 등) 매칭하지 않는다.
    - 동명 계정이 없고 값이 0원이면 신규 계정을 만들지 않으므로 제외한다.

    accounts(이름→계정)는 현재 DB 상태이며, 미리보기와 확정이 같은 집합·건수를 보장한다.
    """
    deduped: dict[str, excel_import.ParsedValuation] = {}
    for v in excel_import.parse_valuations(content):
        prev = deduped.get(v.product_name)
        if prev is not None and v.value == 0 and prev.value != 0:
            continue
        deduped[v.product_name] = v

    effective: list[excel_import.ParsedValuation] = []
    for v in deduped.values():
        account = accounts.get(v.product_name)
        if account is not None:
            if account.type != "real_estate":
                continue  # 동명의 비부동산 계정(은행·주식 등)과는 매칭하지 않음
        elif v.value == 0:
            continue  # 0원 신규 항목은 생성하지 않음
        effective.append(v)
    return effective


def _effective_liabilities(
    content: bytes, accounts: dict[str, models.Account]
) -> list[excel_import.ParsedValuation]:
    """뱅샐현황 부채 표의 대출 중 실제로 반영될 항목만 추린다(미리보기·적재 공유).

    자산 평가와 같은 정책이되 대상 유형은 loan이다. value는 양수(대출 원금)로 유지하며
    음수화(총자산 차감)는 적재 단계에서 수행한다.

    - 같은 상품명은 합치되, 0원이 비영 대출액을 덮어쓰지 않도록 마지막 비영값을 우선한다.
    - 동명 계정이 loan이 아니면(은행·주식 등) 매칭하지 않는다.
    - 동명 계정이 없고 값이 0원이면 신규 계정을 만들지 않으므로 제외한다.
    """
    deduped: dict[str, excel_import.ParsedValuation] = {}
    for v in excel_import.parse_liabilities(content):
        prev = deduped.get(v.product_name)
        if prev is not None and v.value == 0 and prev.value != 0:
            continue
        deduped[v.product_name] = v

    effective: list[excel_import.ParsedValuation] = []
    for v in deduped.values():
        account = accounts.get(v.product_name)
        if account is not None:
            if account.type != "loan":
                continue  # 동명의 비대출 계정과는 매칭하지 않음
        elif v.value == 0:
            continue  # 0원 신규 항목은 생성하지 않음
        effective.append(v)
    return effective


def _account_sources(
    parsed: list[excel_import.ParsedRow],
    review: list[excel_import.ReviewRow],
    valuations: list[excel_import.ParsedValuation],
    liabilities: list[excel_import.ParsedValuation],
    accounts: dict[str, models.Account],
) -> list[schemas.ImportAccountSource]:
    """엑셀에 등장하는 자산 계정 소스를 매핑 스텝 입력 형태로 모은다.

    ledger 소스는 결제수단명별 행 수를 세고(수입/지출 + 이체 검토 행), valuation/liability
    소스는 이미 반영 대상으로 추려진 항목(_effective_*)의 상품명을 그대로 쓴다.
    동명 계정이 있으면 그 계정을 기본 연결 대상·제안 유형으로 삼고, 없으면 휴리스틱
    (ledger) 또는 소스 종류 고정 유형(valuation=real_estate, liability=loan)을 제안한다.
    """
    counts: dict[str, int] = {}
    importable: dict[str, int] = {}  # 검토 없이 적재되는 수입/지출 행만 따로 — 제외 시 건수 차감용
    for name in [r.account_name for r in parsed]:
        counts[name] = counts.get(name, 0) + 1
        importable[name] = importable.get(name, 0) + 1
    for name in [r.account_name for r in review]:
        counts[name] = counts.get(name, 0) + 1

    sources: list[schemas.ImportAccountSource] = []

    def add(
        kind: str,
        name: str,
        fallback_type: str,
        row_count: int,
        importable_count: int,
        amount: int | None,
    ):
        matched = accounts.get(name)
        sources.append(
            schemas.ImportAccountSource(
                kind=kind,
                name=name,
                matched_account_id=matched.id if matched else None,
                suggested_type=matched.type if matched else fallback_type,
                row_count=row_count,
                importable_count=importable_count,
                amount=amount,
            )
        )

    for name, count in counts.items():
        add(
            "ledger",
            name,
            excel_import.guess_account_type(name),
            count,
            importable.get(name, 0),
            None,
        )
    for v in valuations:
        add("valuation", v.product_name, v.account_type, 0, 0, v.value)
    for v in liabilities:
        add("liability", v.product_name, v.account_type, 0, 0, v.value)
    return sources


@router.post("/import/preview", response_model=schemas.ImportPreview)
def preview_import(
    file: UploadFile = File(description="뱅크샐러드 내보내기 .xlsx 파일"),
    month: str = Form(pattern=schemas.YEAR_MONTH_PATTERN),
    member_id: int = Form(description="업로드 대상 구성원 id — 계정 매칭 스코프(import와 동일)"),
    db: Session = Depends(get_db),
):
    """업로드 확정 전 미리보기 — DB를 변경하지 않는다.

    이체 타입 행을 검토 대상으로 반환한다. 행별 결정(decisions)과 함께
    POST /transactions/import 를 호출하면 확정된다. 평가액 미리보기는 실제 적재와
    동일한 정책(_effective_valuations)·동일 구성원 스코프로 산출해 건수·목록이 결과와 일치한다.
    """
    content = file.file.read()
    try:
        parsed, review, skipped, month_rows = excel_import.parse_ledger(content, month)
    except excel_import.ExcelFormatError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if month_rows == 0:
        raise HTTPException(status_code=422, detail=f"{month}에 해당하는 가계부 내역이 없습니다")
    # import와 동일하게 업로드 구성원 소유 계정으로 스코프 — 평가액·부채 매칭 건수 파리티 유지.
    accounts = {
        a.name: a
        for a in db.scalars(
            select(models.Account).where(models.Account.member_id == member_id)
        ).all()
    }
    effective_valuations = _effective_valuations(content, accounts)
    effective_liabilities = _effective_liabilities(content, accounts)
    return schemas.ImportPreview(
        month=month,
        month_rows=month_rows,
        importable_count=len(parsed),
        review=[
            schemas.ImportReviewRow(
                row=r.row,
                date=r.date,
                major=r.major,
                minor=r.minor,
                description=r.description,
                amount=r.amount,
                account_name=r.account_name,
                pair_row=r.pair_row,
                suggested=_suggest_action(r),
            )
            for r in review
        ],
        skipped=[schemas.ImportSkippedRow(row=s.row, reason=s.reason) for s in skipped],
        valuations=[
            schemas.ImportValuationRow(
                product_name=v.product_name, account_type=v.account_type, value=v.value
            )
            for v in effective_valuations
        ],
        liabilities=[
            schemas.ImportLiabilityRow(product_name=v.product_name, value=v.value)
            for v in effective_liabilities
        ],
        account_sources=_account_sources(
            parsed, review, effective_valuations, effective_liabilities, accounts
        ),
    )


# 소스 종류가 요구하는 계정 유형 — 부동산 평가액은 real_estate, 대출 잔액은 loan에만 붙는다.
# ledger(결제수단)는 제약이 없어 사용자가 유형을 자유롭게 고른다.
SOURCE_REQUIRED_TYPE = {"valuation": "real_estate", "liability": "loan"}


@router.post("/import/accounts", response_model=schemas.ImportAccountMapResult)
def resolve_import_accounts(
    payload: schemas.ImportAccountMapRequest, db: Session = Depends(get_db)
):
    """매핑 스텝 확정 — 거래 적재 전에 자산 계정을 실제로 생성·연결한다.

    - link: 지정 계정이 업로드 구성원 소유인지, 소스 종류가 요구하는 유형인지 검증한다.
    - create: 구성원 소유로 새 계정을 만든다. 같은 (이름·소유자·유형) 계정이 이미 있으면
      새로 만들지 않고 그 계정을 재사용한다(중복 확정 재시도 안전).
    - exclude: 아무것도 만들지 않고 제외로 표시한다.

    전 과정이 단일 트랜잭션이라 하나라도 실패하면 계정이 남지 않는다. 여기서 확정된
    (kind, name) → 계정 id 매핑을 POST /transactions/import 의 account_mappings로 넘긴다.
    """
    get_or_404(db, models.Member, payload.member_id, "구성원")

    resolved: list[schemas.ImportAccountResolved] = []
    created_accounts: list[str] = []
    for m in payload.mappings:
        required_type = SOURCE_REQUIRED_TYPE.get(m.kind)
        if m.action == "exclude":
            resolved.append(
                schemas.ImportAccountResolved(kind=m.kind, name=m.name, excluded=True)
            )
            continue

        if m.action == "link":
            account = get_or_404(db, models.Account, m.account_id, "자산 계정")
            if account.member_id != payload.member_id:
                raise HTTPException(
                    status_code=422,
                    detail=f"'{m.name}': 다른 구성원의 계정에는 연결할 수 없습니다",
                )
            if required_type and account.type != required_type:
                raise HTTPException(
                    status_code=422,
                    detail=f"'{m.name}': 이 항목은 {required_type} 유형 계정에만 연결할 수 있습니다",
                )
        else:  # create
            if required_type and m.type != required_type:
                raise HTTPException(
                    status_code=422,
                    detail=f"'{m.name}': 이 항목은 {required_type} 유형으로만 만들 수 있습니다",
                )
            account = db.scalar(
                select(models.Account).where(
                    models.Account.name == m.name,
                    models.Account.member_id == payload.member_id,
                    models.Account.type == m.type,
                )
            )
            if account is None:
                account = models.Account(
                    name=m.name,
                    type=m.type,
                    opening_balance=0,
                    is_active=True,
                    member_id=payload.member_id,
                )
                db.add(account)
                db.flush()
                created_accounts.append(account.name)
        resolved.append(
            schemas.ImportAccountResolved(kind=m.kind, name=m.name, account_id=account.id)
        )

    commit_or_conflict(db, "자산 계정 저장 중 무결성 오류가 발생했습니다")
    return schemas.ImportAccountMapResult(resolved=resolved, created_accounts=created_accounts)


@router.post("/import", response_model=schemas.ImportResult)
def import_transactions(
    file: UploadFile = File(description="뱅크샐러드 내보내기 .xlsx 파일"),
    month: str = Form(pattern=schemas.YEAR_MONTH_PATTERN),
    member_id: int = Form(description="업로드되는 모든 거래(및 자동 생성 계정)에 지정할 구성원 id"),
    decisions: str = Form(default="[]", description="이체 검토 행별 결정 JSON 배열"),
    account_mappings: str = Form(
        default="[]", description="자산 계정 소스별 매핑 결정 JSON 배열 (생략 시 이름 자동 매칭)"
    ),
    db: Session = Depends(get_db),
):
    """엑셀 "가계부 내역" 시트에서 지정 월만 가져온다.

    구성원별 엑셀 파일을 따로 업로드하는 워크플로 — 모든 거래는 member_id
    소유로 기록한다. 같은 월·같은 구성원의 기존 가져오기(source='import')
    거래는 삭제 후 다시 등록하므로 재업로드해도 중복되지 않으며, 다른
    구성원의 가져오기 거래와 수동 입력 거래는 보존된다. 구성원이 비어 있는
    과거 가져오기 거래도 함께 정리된다(구성원 지정 이전 업로드의 잔재).
    전 과정이 단일 트랜잭션이라 실패 시 기존 데이터가 유지된다.
    새로 생성되는 계정도 member_id 소유가 된다.

    이체 타입 행은 decisions의 행별 결정에 따라 수입/지출 전환·이체 적재·
    건너뛰기로 처리한다 (미리보기: POST /transactions/import/preview).
    결정이 없는 검토 행은 보수적으로 건너뛴다.

    자산 계정은 account_mappings의 소스별 결정을 우선한다(연결/신규/제외 —
    확정: POST /transactions/import/accounts). 매핑이 없는 소스는 종전대로
    이름 일치로 찾고 없으면 추정 유형으로 자동 생성한다.
    """
    get_or_404(db, models.Member, member_id, "구성원")
    try:
        decision_list = _DECISIONS_ADAPTER.validate_json(decisions)
    except ValidationError:
        raise HTTPException(status_code=422, detail="검토 결정(decisions) 형식이 올바르지 않습니다")
    decisions_by_row = {d.row: d for d in decision_list}
    try:
        mapping_list = _MAPPINGS_ADAPTER.validate_json(account_mappings)
    except ValidationError:
        raise HTTPException(
            status_code=422, detail="계정 매핑(account_mappings) 형식이 올바르지 않습니다"
        )
    mappings_by_source = {(m.kind, m.name): m for m in mapping_list}

    content = file.file.read()
    try:
        parsed, review, skipped, month_rows = excel_import.parse_ledger(content, month)
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
            or_(
                models.Transaction.member_id == member_id,
                models.Transaction.member_id.is_(None),
            ),
        )
    ).rowcount

    categories = {
        (c.major, c.minor, c.kind): c for c in db.scalars(select(models.Category)).all()
    }
    # 계정 매칭·생성은 업로드 지정 구성원 소유 계정으로만 스코프한다 — 이름이 겹칠 수 있으므로
    # (name, member_id, type) 식별 하에 다른 구성원의 동명 계정에 잘못 붙지 않게 한다.
    accounts = {
        a.name: a
        for a in db.scalars(
            select(models.Account).where(models.Account.member_id == member_id)
        ).all()
    }
    created_categories: list[str] = []
    created_accounts: list[str] = []

    def ensure_category(major: str, minor: str, kind: str) -> models.Category:
        key = (major, minor, kind)
        category = categories.get(key)
        if category is None:
            category = models.Category(major=major, minor=minor, kind=kind, nature="variable")
            db.add(category)
            db.flush()
            categories[key] = category
            created_categories.append(category.display_name)
        return category

    def ensure_named_account(name: str, account_type: str) -> models.Account:
        """구성원 스코프에서 이름으로 찾고, 없으면 주어진 유형으로 만든다 (매핑 없을 때의 기본 동작)."""
        account = accounts.get(name)
        if account is None:
            account = models.Account(
                name=name,
                type=account_type,
                opening_balance=0,
                is_active=True,
                member_id=member_id,
            )
            db.add(account)
            db.flush()
            accounts[name] = account
            created_accounts.append(account.name)
        return account

    # (kind, name) → 계정. None은 "이번 업로드에서 제외"를 뜻한다.
    resolved_sources: dict[tuple[str, str], models.Account | None] = {}

    def resolve_source(kind: str, name: str, fallback_type: str) -> models.Account | None:
        """엑셀 소스명을 계정으로 해석한다. 매핑 결정이 있으면 그것을 따르고(제외면 None),
        없으면 종전 동작(이름 일치 → 없으면 fallback_type으로 생성)으로 폴백한다."""
        key = (kind, name)
        if key in resolved_sources:
            return resolved_sources[key]

        mapping = mappings_by_source.get(key)
        required_type = SOURCE_REQUIRED_TYPE.get(kind)
        if mapping is None:
            account = ensure_named_account(name, fallback_type)
        elif mapping.action == "exclude":
            account = None
        elif mapping.action == "link":
            account = db.get(models.Account, mapping.account_id)
            if account is None or account.member_id != member_id:
                raise HTTPException(
                    status_code=422,
                    detail=f"'{name}': 연결할 계정을 찾을 수 없습니다 (id={mapping.account_id})",
                )
            if required_type and account.type != required_type:
                raise HTTPException(
                    status_code=422,
                    detail=f"'{name}': 이 항목은 {required_type} 유형 계정에만 연결할 수 있습니다",
                )
            accounts.setdefault(account.name, account)
        else:  # create — 매핑 확정을 건너뛰고 바로 임포트한 경우에도 유형 지정을 존중한다
            if required_type and mapping.type != required_type:
                raise HTTPException(
                    status_code=422,
                    detail=f"'{name}': 이 항목은 {required_type} 유형으로만 만들 수 있습니다",
                )
            account = db.scalar(
                select(models.Account).where(
                    models.Account.name == name,
                    models.Account.member_id == member_id,
                    models.Account.type == mapping.type,
                )
            )
            if account is None:
                account = models.Account(
                    name=name,
                    type=mapping.type,
                    opening_balance=0,
                    is_active=True,
                    member_id=member_id,
                )
                db.add(account)
                db.flush()
                created_accounts.append(account.name)
            accounts.setdefault(name, account)

        resolved_sources[key] = account
        return account

    def ensure_account(name: str) -> models.Account | None:
        """결제수단명 → 계정 (제외 매핑이면 None). 매핑이 없으면 계정을 새로 만들 수 있으므로
        실제로 거래를 적재하는 자리에서만 호출한다."""
        return resolve_source("ledger", name, excel_import.guess_account_type(name))

    def is_excluded(kind: str, name: str) -> bool:
        """소스가 제외 매핑인지만 확인한다 — 계정을 만들지 않는 순수 검사.
        건너뛸 행을 판정하는 자리에서 ensure_account를 쓰면 적재되지 않을 계정까지 생긴다."""
        mapping = mappings_by_source.get((kind, name))
        return mapping is not None and mapping.action == "exclude"

    def excluded_reason(name: str) -> str:
        return f"'{name}' 계정을 이번 업로드에서 제외함"

    skipped_out = [schemas.ImportSkippedRow(row=s.row, reason=s.reason) for s in skipped]
    skipped_rows = {s.row for s in skipped}
    imported_count = 0

    def add_skip(row: int, reason: str) -> None:
        """건너뜀 사유를 행당 한 번만 기록한다 (페어 이체는 양쪽에서 도달할 수 있다)."""
        if row in skipped_rows:
            return
        skipped_rows.add(row)
        skipped_out.append(schemas.ImportSkippedRow(row=row, reason=reason))

    for row in parsed:
        account = ensure_account(row.account_name)
        if account is None:
            add_skip(row.row, excluded_reason(row.account_name))
            continue
        category = ensure_category(row.major, row.minor, row.kind)
        db.add(
            models.Transaction(
                date=row.date,
                time=row.time,
                amount=row.amount,
                kind=row.kind,
                category_id=category.id,
                account_id=account.id,
                member_id=member_id,
                memo=row.memo,
                source="import",
            )
        )
        imported_count += 1

    # 이체 검토 행 — 행별 결정 적용
    review_by_row = {r.row: r for r in review}
    consumed: set[int] = set()  # 페어 이체로 함께 소비된 상대 행
    transfer_count = converted_count = 0

    for r in review:
        if r.row in consumed:
            continue
        # 제외된 결제수단의 행은 어떤 결정이 왔든(또는 오지 않았든) 제외 사유로 건너뛴다 —
        # 매핑 스텝에서 제외한 소스의 행은 화면에도 나오지 않으므로 결정이 비어 있을 수 있다.
        # 자동 페어 상대가 제외된 경우도 이체가 성립하지 않으므로 두 다리를 함께 건너뛴다
        # (결정 유무보다 먼저 판정해야 상대 결정이 없을 때 수동 이체 분기로 새지 않는다).
        pair_row = review_by_row.get(r.pair_row) if r.pair_row else None
        excluded_name = (
            r.account_name
            if is_excluded("ledger", r.account_name)
            else pair_row.account_name
            if pair_row is not None and is_excluded("ledger", pair_row.account_name)
            else None
        )
        if excluded_name is not None:
            add_skip(r.row, excluded_reason(excluded_name))
            if pair_row is not None:
                add_skip(pair_row.row, excluded_reason(excluded_name))
                consumed.add(pair_row.row)
            continue
        decision = decisions_by_row.get(r.row)
        if decision is None or decision.action == "skip":
            reason = "검토에서 건너뜀" if decision else "검토 결정 없음 — 건너뜀"
            add_skip(r.row, reason)
            continue

        if decision.action in ("income", "expense"):
            # 계정 실체화는 실제로 적재하는 분기에서만 — 건너뛸 행의 계정을 만들지 않는다
            own_account = ensure_account(r.account_name)
            if own_account is None:  # 상단 제외 판정을 통과했으므로 도달하지 않는다 (방어)
                add_skip(r.row, excluded_reason(r.account_name))
                continue
            origin = r.major if r.minor == excel_import.UNCLASSIFIED else f"{r.major} > {r.minor}"
            label = "수입" if decision.action == "income" else "지출"
            trace = f"[이체→{label}: {origin}]"
            memo = f"{r.description} {trace}" if r.description else trace
            db.add(
                models.Transaction(
                    date=r.date,
                    time=r.time,
                    amount=abs(r.amount),
                    kind=decision.action,
                    category_id=ensure_category(r.major, r.minor, decision.action).id,
                    account_id=own_account.id,
                    member_id=member_id,
                    memo=memo[: excel_import.MEMO_MAX],
                    source="import",
                )
            )
            converted_count += 1
            continue

        # action == "transfer" — 페어 상대(pair_row)는 위에서 이미 조회했다
        pair = pair_row
        pair_decision = decisions_by_row.get(pair.row) if pair else None
        pair_is_auto = (
            pair is not None
            and decision.counter_account_id is None
            and pair_decision is not None
            and pair_decision.action == "transfer"
            and pair_decision.counter_account_id is None
        )
        if pair_is_auto:
            # 페어 두 다리 → 한 건의 이체. 출금(-) 다리 기준으로 적재
            out_leg, in_leg = (r, pair) if r.amount < 0 else (pair, r)
            from_account = ensure_account(out_leg.account_name)
            to_account = ensure_account(in_leg.account_name)
            # 제외된 다리는 상단 판정에서 이미 걸러졌으므로 도달하지 않는다 (방어)
            if from_account is None or to_account is None:
                skipped_name = out_leg.account_name if from_account is None else in_leg.account_name
                for leg in (r, pair):
                    add_skip(leg.row, excluded_reason(skipped_name))
                consumed.add(pair.row)
                continue
            # 두 결제수단을 같은 계정에 매핑했다면 계정 간 이동이 아니므로 이체로 기록하지 않는다
            # (수동 상대 계정 지정은 사용자가 직접 고른 오류라 422로 막지만, 여기서는 매핑의
            #  부수 효과이므로 두 다리를 건너뛰고 사유를 남긴다)
            if from_account.id == to_account.id:
                for leg in (r, pair):
                    add_skip(
                        leg.row,
                        f"출금·입금이 같은 계정('{from_account.name}')이라 이체로 기록하지 않음",
                    )
                consumed.add(pair.row)
                continue
            consumed.add(pair.row)
            base = out_leg
        else:
            if decision.counter_account_id is None:
                raise HTTPException(
                    status_code=422,
                    detail=f"{r.row}행: 이체 결정에는 상대 계정이 필요합니다",
                )
            counter = db.get(models.Account, decision.counter_account_id)
            if counter is None:
                raise HTTPException(
                    status_code=422,
                    detail=f"{r.row}행: 상대 계정을 찾을 수 없습니다 (id={decision.counter_account_id})",
                )
            # 계정 실체화는 실제로 적재하는 이 자리에서 (상단 제외 판정을 통과한 행만 도달)
            own_account = ensure_account(r.account_name)
            if own_account is None:  # 도달하지 않는다 (방어)
                add_skip(r.row, excluded_reason(r.account_name))
                continue
            if counter.id == own_account.id:
                raise HTTPException(
                    status_code=422,
                    detail=f"{r.row}행: 상대 계정이 결제수단 계정과 같을 수 없습니다",
                )
            # 부호가 방향을 정한다 — 음수면 결제수단에서 출금, 양수면 입금
            from_account, to_account = (
                (own_account, counter) if r.amount < 0 else (counter, own_account)
            )
            base = r
        minor = r.major if r.major in TRANSFER_MINOR_MAJORS else excel_import.UNCLASSIFIED
        db.add(
            models.Transaction(
                date=base.date,
                time=base.time,
                amount=abs(base.amount),
                kind="transfer",
                category_id=ensure_category(TRANSFER_MAJOR, minor, "transfer").id,
                account_id=from_account.id,
                counter_account_id=to_account.id,
                member_id=member_id,
                memo=base.description,
                source="import",
            )
        )
        transfer_count += 1

    # 자산 평가액 — 뱅샐현황 자산 표의 부동산 평가액을 오늘 날짜로 반영한다(선택 월과 무관).
    # 주식은 보유 총합을 자산 페이지에서 직접 입력하므로 엑셀 반영 대상이 아니다.
    # 반영 대상은 미리보기와 동일한 정책(_effective_valuations)으로 추린다: 상품명 dedupe,
    # 0원 신규 미생성, 동명 비부동산 계정 제외. 남은 항목은 매핑 결정(연결/신규/제외)을 따르며,
    # 매핑이 없으면 종전대로 동명 계정에 upsert하거나 신규 생성한다.
    valuation_date = date.today()
    valuation_count = 0
    for v in _effective_valuations(content, accounts):
        account = resolve_source("valuation", v.product_name, v.account_type)
        if account is None:
            continue  # 매핑에서 제외한 항목 — 계정도 평가액도 만들지 않는다
        existing = db.scalar(
            select(models.AssetValuation).where(
                models.AssetValuation.account_id == account.id,
                models.AssetValuation.date == valuation_date,
            )
        )
        if existing:
            existing.value = v.value
        else:
            db.add(
                models.AssetValuation(account_id=account.id, date=valuation_date, value=v.value)
            )
        valuation_count += 1

    # 대출 잔액 — 뱅샐현황 부채 표의 대출을 오늘 날짜 평가액으로 반영한다(선택 월과 무관).
    # 대출은 부채이므로 value를 음수(-대출원금)로 기록해 총자산에서 차감한다. 매핑 결정을
    # 따르되(제외면 미반영) 매핑이 없으면 loan 유형으로 생성하고, 동명 비대출 계정은
    # _effective_liabilities에서 이미 제외된다.
    loan_count = 0
    for v in _effective_liabilities(content, accounts):
        account = resolve_source("liability", v.product_name, v.account_type)
        if account is None:
            continue  # 매핑에서 제외한 항목 — 계정도 잔액도 만들지 않는다
        signed_value = -v.value  # 부채 — 음수 평가액으로 총자산 차감
        existing = db.scalar(
            select(models.AssetValuation).where(
                models.AssetValuation.account_id == account.id,
                models.AssetValuation.date == valuation_date,
            )
        )
        if existing:
            existing.value = signed_value
        else:
            db.add(
                models.AssetValuation(
                    account_id=account.id, date=valuation_date, value=signed_value
                )
            )
        loan_count += 1

    commit_or_conflict(db, "가져오기 저장 중 무결성 오류가 발생했습니다")
    return schemas.ImportResult(
        month=month,
        deleted_count=deleted,
        created_count=imported_count + converted_count + transfer_count,
        transfer_count=transfer_count,
        converted_count=converted_count,
        skipped=skipped_out,
        created_categories=created_categories,
        created_accounts=created_accounts,
        valuation_count=valuation_count,
        loan_count=loan_count,
    )
