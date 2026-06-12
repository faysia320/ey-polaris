from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session, selectinload

from app import excel_import, models, schemas
from app.database import get_db
from app.routers.utils import commit_or_conflict, get_or_404

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _month_range(month: str) -> tuple[date, date]:
    year, mon = int(month[:4]), int(month[5:7])
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end


def _to_out(t: models.Transaction) -> schemas.TransactionOut:
    return schemas.TransactionOut(
        id=t.id,
        date=t.date,
        amount=t.amount,
        kind=t.kind,
        category_id=t.category_id,
        account_id=t.account_id,
        counter_account_id=t.counter_account_id,
        member_id=t.member_id,
        memo=t.memo,
        category_name=t.category.display_name,
        account_name=t.account.name,
        counter_account_name=t.counter_account.name if t.counter_account else None,
        member_name=t.member.name if t.member else None,
    )


def _validate_refs(db: Session, payload: schemas.TransactionCreate) -> None:
    category = get_or_404(db, models.Category, payload.category_id, "카테고리")
    get_or_404(db, models.Account, payload.account_id, "자산 계정")
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
    stmt = (
        select(models.Transaction)
        .options(
            selectinload(models.Transaction.category),
            selectinload(models.Transaction.account),
            selectinload(models.Transaction.counter_account),
            selectinload(models.Transaction.member),
        )
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
    )
    if month:
        start, end = _month_range(month)
        stmt = stmt.where(models.Transaction.date >= start, models.Transaction.date < end)
    if kind:
        stmt = stmt.where(models.Transaction.kind == kind)
    if category_id:
        stmt = stmt.where(models.Transaction.category_id == category_id)
    if major:
        # 대분류만 고른 경우 — 소분류 전체를 포괄하는 필터
        stmt = stmt.where(models.Transaction.category.has(models.Category.major == major))
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


# 이체 검토 결정 JSON(multipart 문자열 필드) 파서
_DECISIONS_ADAPTER = TypeAdapter(list[schemas.ImportDecision])

# 검토 행을 이체로 적재할 때의 카테고리(0006 시드 '이체' 대분류) 소분류 매핑 —
# 시드에 있는 원본 대분류는 그대로, 그 외(이체/현금/미분류 등)는 '미분류'
TRANSFER_MAJOR = "이체"
TRANSFER_MINOR_MAJORS = {"내계좌이체", "카드대금", "저축", "투자"}


def _suggest_action(row: excel_import.ReviewRow) -> schemas.ImportAction:
    """검토 행 기본 제안 — 내계좌이체·카드대금은 이체, 그 외는 부호 기반 수입/지출."""
    if row.major in (excel_import.OWN_TRANSFER_MAJOR, "카드대금"):
        return "transfer"
    return "income" if row.amount > 0 else "expense"


@router.post("/import/preview", response_model=schemas.ImportPreview)
def preview_import(
    file: UploadFile = File(description="뱅크샐러드 내보내기 .xlsx 파일"),
    month: str = Form(pattern=schemas.YEAR_MONTH_PATTERN),
):
    """업로드 확정 전 미리보기 — DB를 변경하지 않는다.

    이체 타입 행을 검토 대상으로 반환한다. 행별 결정(decisions)과 함께
    POST /transactions/import 를 호출하면 확정된다.
    """
    try:
        parsed, review, skipped, month_rows = excel_import.parse_ledger(file.file.read(), month)
    except excel_import.ExcelFormatError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if month_rows == 0:
        raise HTTPException(status_code=422, detail=f"{month}에 해당하는 가계부 내역이 없습니다")
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
    )


@router.post("/import", response_model=schemas.ImportResult)
def import_transactions(
    file: UploadFile = File(description="뱅크샐러드 내보내기 .xlsx 파일"),
    month: str = Form(pattern=schemas.YEAR_MONTH_PATTERN),
    member_id: int = Form(description="업로드되는 모든 거래(및 자동 생성 계정)에 지정할 구성원 id"),
    decisions: str = Form(default="[]", description="이체 검토 행별 결정 JSON 배열"),
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
    """
    get_or_404(db, models.Member, member_id, "구성원")
    try:
        decision_list = _DECISIONS_ADAPTER.validate_json(decisions)
    except ValidationError:
        raise HTTPException(status_code=422, detail="검토 결정(decisions) 형식이 올바르지 않습니다")
    decisions_by_row = {d.row: d for d in decision_list}

    try:
        parsed, review, skipped, month_rows = excel_import.parse_ledger(file.file.read(), month)
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
    accounts = {a.name: a for a in db.scalars(select(models.Account)).all()}
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

    def ensure_account(name: str) -> models.Account:
        account = accounts.get(name)
        if account is None:
            account = models.Account(
                name=name,
                type=excel_import.guess_account_type(name),
                opening_balance=0,
                is_active=True,
                member_id=member_id,
            )
            db.add(account)
            db.flush()
            accounts[name] = account
            created_accounts.append(account.name)
        return account

    for row in parsed:
        category = ensure_category(row.major, row.minor, row.kind)
        account = ensure_account(row.account_name)
        db.add(
            models.Transaction(
                date=row.date,
                amount=row.amount,
                kind=row.kind,
                category_id=category.id,
                account_id=account.id,
                member_id=member_id,
                memo=row.memo,
                source="import",
            )
        )

    # 이체 검토 행 — 행별 결정 적용
    review_by_row = {r.row: r for r in review}
    skipped_out = [schemas.ImportSkippedRow(row=s.row, reason=s.reason) for s in skipped]
    consumed: set[int] = set()  # 페어 이체로 함께 소비된 상대 행
    transfer_count = converted_count = 0

    for r in review:
        if r.row in consumed:
            continue
        decision = decisions_by_row.get(r.row)
        if decision is None or decision.action == "skip":
            reason = "검토에서 건너뜀" if decision else "검토 결정 없음 — 건너뜀"
            skipped_out.append(schemas.ImportSkippedRow(row=r.row, reason=reason))
            continue

        if decision.action in ("income", "expense"):
            origin = r.major if r.minor == excel_import.UNCLASSIFIED else f"{r.major} > {r.minor}"
            label = "수입" if decision.action == "income" else "지출"
            trace = f"[이체→{label}: {origin}]"
            memo = f"{r.description} {trace}" if r.description else trace
            db.add(
                models.Transaction(
                    date=r.date,
                    amount=abs(r.amount),
                    kind=decision.action,
                    category_id=ensure_category(r.major, r.minor, decision.action).id,
                    account_id=ensure_account(r.account_name).id,
                    member_id=member_id,
                    memo=memo[: excel_import.MEMO_MAX],
                    source="import",
                )
            )
            converted_count += 1
            continue

        # action == "transfer"
        pair = review_by_row.get(r.pair_row) if r.pair_row else None
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
            own = ensure_account(r.account_name)
            if counter.id == own.id:
                raise HTTPException(
                    status_code=422,
                    detail=f"{r.row}행: 상대 계정이 결제수단 계정과 같을 수 없습니다",
                )
            # 부호가 방향을 정한다 — 음수면 결제수단에서 출금, 양수면 입금
            from_account, to_account = (own, counter) if r.amount < 0 else (counter, own)
            base = r
        minor = r.major if r.major in TRANSFER_MINOR_MAJORS else excel_import.UNCLASSIFIED
        db.add(
            models.Transaction(
                date=base.date,
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

    commit_or_conflict(db, "가져오기 저장 중 무결성 오류가 발생했습니다")
    return schemas.ImportResult(
        month=month,
        deleted_count=deleted,
        created_count=len(parsed) + converted_count + transfer_count,
        transfer_count=transfer_count,
        converted_count=converted_count,
        skipped=skipped_out,
        created_categories=created_categories,
        created_accounts=created_accounts,
    )
