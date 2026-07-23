from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, aliased, selectinload

from app import models, schemas, settings_store
from app.database import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _month_range(month: str) -> tuple[date, date]:
    year, mon = int(month[:4]), int(month[5:7])
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end


def _signed_amount():
    """수입은 +, 지출·이체 출금은 - 로 부호를 붙인 금액 표현식.

    이체는 account_id(출금 계정) 기준으로 -만 반영된다 — 입금 계정(+) 다리는
    counter_account_id 기준의 별도 집계로 가산해야 한다.
    """
    return case(
        (models.Transaction.kind == "income", models.Transaction.amount),
        else_=-models.Transaction.amount,
    )


def _income_expense_stats(
    db: Session, start: date, end: date, member_id: int | None = None
) -> tuple[int, int, dict[str, int]]:
    """묶음(이체/환불) 상쇄를 반영한 (수입 합계, 지출 합계, 대분류별 지출 dict).

    대시보드와 AI 리포트가 공유하는 수입/지출 집계 규칙:
    - 이체 묶음(transfer): 수입·지출 두 다리를 모두 통계에서 제외한다.
    - 환불 묶음(refund): 환불(수입) 다리는 수입에서 제외하고, 그 금액을 짝 지출
      다리의 대분류에서 차감해 순지출만 반영한다. 차감은 **지출(결제) 다리의 월**을
      기준으로 앵커링한다 — 카드 익월 환불처럼 결제·환불 월이 달라도 결제 월에서
      순지출이 올바르게 상쇄되도록(환불 다리 월을 기준으로 하면 결제 월엔 짝 지출이
      없어 차감이 유실된다).
    - link_id가 NULL인 거래는 종전과 동일하게 전액 반영한다.
    잔액/자산 추이는 원본 income/expense가 이미 각 계정에 ±반영하므로 여기서 다루지 않는다.
    """
    T = models.Transaction
    L = models.TransactionLink

    def in_month(t) -> list:
        conds = [t.date >= start, t.date < end]
        if member_id is not None:
            conds.append(t.member_id == member_id)
        return conds

    # 수입 — 묶이지 않은 수입만 (이체·환불 수입 다리는 모두 제외)
    income_total = int(
        db.scalar(
            select(func.coalesce(func.sum(T.amount), 0)).where(
                *in_month(T), T.kind == "income", T.link_id.is_(None)
            )
        )
    )

    # 지출 대분류별 — 이체 묶음 지출 다리만 제외(미묶음 + 환불 묶음 지출은 포함)
    by_major: dict[str, int] = {}
    for major, amount in db.execute(
        select(models.Category.major, func.sum(T.amount))
        .join(T, T.category_id == models.Category.id)
        .outerjoin(L, L.id == T.link_id)
        .where(
            *in_month(T),
            T.kind == "expense",
            or_(T.link_id.is_(None), L.link_type == "refund"),
        )
        .group_by(models.Category.major)
    ).all():
        by_major[major] = int(amount)

    # 환불 묶음 — 환불(수입) 금액을 짝 지출 다리의 대분류에서 차감해 순지출로 만든다.
    # 앵커는 지출(결제) 다리의 월 — 위 by_major가 지출 다리를 결제 월에 담으므로
    # 차감도 같은 월·같은 대분류에 맞춰야 결제·환불 월이 달라도 유실 없이 상쇄된다.
    income_leg = aliased(T)
    expense_leg = aliased(T)
    for major, refunded in db.execute(
        select(models.Category.major, func.sum(income_leg.amount))
        .select_from(L)
        .join(income_leg, (income_leg.link_id == L.id) & (income_leg.kind == "income"))
        .join(expense_leg, (expense_leg.link_id == L.id) & (expense_leg.kind == "expense"))
        .join(models.Category, models.Category.id == expense_leg.category_id)
        .where(L.link_type == "refund", *in_month(expense_leg))
        .group_by(models.Category.major)
    ).all():
        if major in by_major:
            by_major[major] -= int(refunded)

    # 순지출이 0 이하가 된 대분류는 집계·표시에서 제외 (검증상 환불≤지출이라 음수는 없음)
    by_major = {m: v for m, v in by_major.items() if v > 0}
    expense_total = sum(by_major.values())
    return income_total, expense_total, by_major


@router.get("/dashboard", response_model=schemas.DashboardOut)
def dashboard(
    month: str = Query(pattern=schemas.YEAR_MONTH_PATTERN),
    member_id: int | None = Query(default=None, description="구성원 필터 — 미지정 시 전체"),
    db: Session = Depends(get_db),
):
    start, end = _month_range(month)
    # 묶음(이체/환불) 상쇄를 반영한 수입/지출/대분류별 지출
    income_total, expense_total, spent_by_major = _income_expense_stats(
        db, start, end, member_id
    )

    budget_rows = db.scalars(
        select(models.Budget)
        .where(models.Budget.year_month == month)
        .order_by(models.Budget.id)
    ).all()
    budgets = [
        schemas.BudgetProgress(
            major=b.major,
            amount=b.amount,
            spent=spent_by_major.get(b.major, 0),
        )
        for b in budget_rows
    ]

    return schemas.DashboardOut(
        month=month,
        income_total=income_total,
        expense_total=expense_total,
        budget_total=sum(b.amount for b in budgets),
        budget_spent=sum(b.spent for b in budgets),
        budgets=budgets,
        # 도넛 차트용 — 소분류 56종을 그대로 내보내면 과밀하므로 대분류로 집계(금액 내림차순)
        expense_by_category=[
            schemas.CategoryAmount(category_name=major, amount=amount)
            for major, amount in sorted(
                spent_by_major.items(), key=lambda kv: kv[1], reverse=True
            )
        ],
    )


@router.get("/assets", response_model=schemas.AssetsOut)
def assets(
    member_id: int | None = Query(default=None, description="소유자 필터 — 미지정 시 전체"),
    db: Session = Depends(get_db),
):
    accounts = db.scalars(
        select(models.Account)
        .options(selectinload(models.Account.member))
        .order_by(models.Account.id)
    ).all()
    # 구성원 필터 — 카드/총자산/추이는 소유 계정만으로 계산하되,
    # 목표 달성률용 전체 총자산(grand_total)은 항상 전 계정 기준으로 계산한다
    visible = accounts if member_id is None else [a for a in accounts if a.member_id == member_id]

    # 간편결제(easy_pay) 패스스루 — easy_pay 계정의 거래 net은 실제 결제가 빠지는
    # 연결 계정(linked_account_id)으로 귀속시킨다. easy_pay 계정 자체에는 net이 남지
    # 않으므로 잔액은 opening_balance로 수렴한다. (집계용 라우팅이며 거래 데이터는 불변)
    link_target = {
        a.id: a.linked_account_id
        for a in accounts
        if a.type == "easy_pay" and a.linked_account_id is not None
    }

    def _route(account_id: int | None) -> int | None:
        return link_target.get(account_id, account_id)

    # 라우팅된 계정별 net — easy_pay 계정의 거래를 연결 계정으로 귀속
    net_by_account: dict[int, int] = {}
    for account_id, total in db.execute(
        select(models.Transaction.account_id, func.sum(_signed_amount())).group_by(
            models.Transaction.account_id
        )
    ).all():
        target = _route(account_id)
        net_by_account[target] = net_by_account.get(target, 0) + int(total)
    # 이체 입금 다리(+) — _signed_amount()는 출금 계정의 -만 반영하므로 따로 가산
    for account_id, total in db.execute(
        select(models.Transaction.counter_account_id, func.sum(models.Transaction.amount))
        .where(models.Transaction.kind == "transfer")
        .group_by(models.Transaction.counter_account_id)
    ).all():
        target = _route(account_id)
        net_by_account[target] = net_by_account.get(target, 0) + int(total)

    # 계정·월별 최신 평가액만 적재 (평가 이력이 길어도 계정당 월 1행).
    # 평가액이 1건 이상 있는 계정의 잔액은 최신 평가액 단독으로 계산한다
    # (평가일 이후 거래는 가산하지 않음).
    valuation_month = func.to_char(models.AssetValuation.date, "YYYY-MM")
    ranked = select(
        models.AssetValuation.account_id,
        valuation_month.label("month"),
        models.AssetValuation.date,
        models.AssetValuation.value,
        func.row_number()
        .over(
            partition_by=(models.AssetValuation.account_id, valuation_month),
            order_by=models.AssetValuation.date.desc(),
        )
        .label("rn"),
    ).subquery()
    # 계정별 (월, 기준일, 평가액) 목록 — 월 오름차순
    monthly_valuations: dict[int, list[tuple[str, date, int]]] = {}
    for account_id, m, valued_on, value in db.execute(
        select(ranked.c.account_id, ranked.c.month, ranked.c.date, ranked.c.value)
        .where(ranked.c.rn == 1)
        .order_by(ranked.c.account_id, ranked.c.month)
    ).all():
        monthly_valuations.setdefault(account_id, []).append((m, valued_on, value))

    balances_by_id: dict[int, schemas.AccountBalance] = {}
    for a in accounts:
        history = monthly_valuations.get(a.id, [])
        if history:
            _, valued_at, balance = history[-1]
        else:
            balance, valued_at = a.opening_balance + int(net_by_account.get(a.id, 0)), None
        balances_by_id[a.id] = schemas.AccountBalance(
            id=a.id,
            name=a.name,
            type=a.type,
            is_active=a.is_active,
            balance=balance,
            valued_at=valued_at,
            member_id=a.member_id,
            member_name=a.member.name,
        )
    grand_total = sum(b.balance for b in balances_by_id.values())
    balances = [balances_by_id[a.id] for a in visible]

    # 월별 자산 추이 (최근 12개월): 계정별로
    #  - 해당 월 말 이전의 최신 평가액이 있으면 그 평가액
    #  - 없으면 개설 잔액 + 해당 월까지의 누적 순증감 (기존 방식)
    month_expr = func.to_char(models.Transaction.date, "YYYY-MM")
    account_month_net: dict[tuple[int, str], int] = {}
    # 현재 잔액 집계와 동일하게 easy_pay 거래를 연결 계정으로 라우팅
    for account_id, m, total in db.execute(
        select(models.Transaction.account_id, month_expr, func.sum(_signed_amount())).group_by(
            models.Transaction.account_id, month_expr
        )
    ).all():
        key = (_route(account_id), m)
        account_month_net[key] = account_month_net.get(key, 0) + int(total)
    # 이체 입금 다리(+) — 현재 잔액 집계와 동일한 보정
    for account_id, m, total in db.execute(
        select(
            models.Transaction.counter_account_id, month_expr, func.sum(models.Transaction.amount)
        )
        .where(models.Transaction.kind == "transfer")
        .group_by(models.Transaction.counter_account_id, month_expr)
    ).all():
        key = (_route(account_id), m)
        account_month_net[key] = account_month_net.get(key, 0) + int(total)

    today = date.today()
    months: list[str] = []
    year, mon = today.year, today.month
    for _ in range(12):
        months.append(f"{year:04d}-{mon:02d}")
        mon -= 1
        if mon == 0:
            year, mon = year - 1, 12
    months.reverse()

    # 12개월 창 이전의 거래 누적분을 계정별 시작점에 반영
    running_by_account = {
        a.id: a.opening_balance
        + sum(v for (acc_id, m), v in account_month_net.items() if acc_id == a.id and m < months[0])
        for a in visible
    }
    # 계정별 평가액 포인터 워크: 창 시작 이전의 최신 평가액을 시작점으로 두고
    # 월을 진행하며 최신값을 갱신한다 (월마다 이력 전체를 재탐색하지 않음)
    val_idx: dict[int, int] = {}
    last_value: dict[int, int | None] = {}
    for a in visible:
        history = monthly_valuations.get(a.id, [])
        i = 0
        while i < len(history) and history[i][0] < months[0]:
            i += 1
        val_idx[a.id] = i
        last_value[a.id] = history[i - 1][2] if i > 0 else None

    trend: list[schemas.MonthlyPoint] = []
    for m in months:
        total = 0
        for a in visible:
            running_by_account[a.id] += account_month_net.get((a.id, m), 0)
            history = monthly_valuations.get(a.id, [])
            i = val_idx[a.id]
            while i < len(history) and history[i][0] <= m:
                last_value[a.id] = history[i][2]
                i += 1
            val_idx[a.id] = i
            value = last_value[a.id]
            total += value if value is not None else running_by_account[a.id]
        trend.append(schemas.MonthlyPoint(month=m, total=total))

    return schemas.AssetsOut(
        accounts=balances,
        total=sum(b.balance for b in balances),
        grand_total=grand_total,
        trend=trend,
    )


# ---------- AI Report ----------
def _prev_month(month: str) -> str:
    year, mon = int(month[:4]), int(month[5:7])
    return f"{year - 1}-12" if mon == 1 else f"{year}-{mon - 1:02d}"


def _month_stats(db: Session, month: str) -> dict:
    """리포트 컨텍스트용 월간 집계 — 구성원 필터 없이 가구 전체 기준.

    대시보드(dashboard) 집계와 동일한 규칙(수입/지출 합계, 대분류 지출, 예산 대비 소진)을 모은다.
    """
    start, end = _month_range(month)
    # 대시보드와 동일한 묶음 상쇄 규칙을 적용해 두 화면의 수치가 일치하도록 한다
    income_total, expense_total, spent_by_major = _income_expense_stats(db, start, end)

    budget_rows = db.scalars(
        select(models.Budget)
        .where(models.Budget.year_month == month)
        .order_by(models.Budget.id)
    ).all()
    budgets = [
        {"major": b.major, "amount": b.amount, "spent": spent_by_major.get(b.major, 0)}
        for b in budget_rows
    ]

    return {
        "month": month,
        "income_total": income_total,
        "expense_total": expense_total,
        "net": income_total - expense_total,
        "budget_total": sum(b["amount"] for b in budgets),
        "budget_spent": sum(b["spent"] for b in budgets),
        "budgets": budgets,
        "expense_by_category": [
            {"major": major, "amount": amount}
            for major, amount in sorted(
                spent_by_major.items(), key=lambda kv: kv[1], reverse=True
            )
        ],
    }


def _won(n: int) -> str:
    return f"{n:,}원"


def _build_report_prompt(month: str, cur: dict, prev: dict) -> str:
    """LLM에 넘길 사용자 메시지(데이터 컨텍스트) 구성."""
    lines: list[str] = [f"## {month} 가계부 데이터", ""]
    lines.append(f"- 수입 합계: {_won(cur['income_total'])}")
    lines.append(f"- 지출 합계: {_won(cur['expense_total'])}")
    lines.append(f"- 순저축(수입-지출): {_won(cur['net'])}")
    if cur["budget_total"] > 0:
        rate = round(cur["budget_spent"] / cur["budget_total"] * 100)
        lines.append(
            f"- 예산: {_won(cur['budget_spent'])} / {_won(cur['budget_total'])} (소진율 {rate}%)"
        )
    else:
        lines.append("- 예산: 설정되지 않음")

    if cur["budgets"]:
        lines.append("")
        lines.append("### 예산 대분류별 (예산 / 지출)")
        for b in cur["budgets"]:
            over = " ⚠️초과" if b["spent"] > b["amount"] else ""
            lines.append(f"- {b['major']}: {_won(b['amount'])} / {_won(b['spent'])}{over}")

    if cur["expense_by_category"]:
        lines.append("")
        lines.append("### 지출 상위 대분류")
        for c in cur["expense_by_category"][:8]:
            lines.append(f"- {c['major']}: {_won(c['amount'])}")
    else:
        lines.append("")
        lines.append("### 지출 상위 대분류")
        lines.append("- (이번 달 지출 내역 없음)")

    lines.append("")
    lines.append(f"### 전월({prev['month']}) 대비")
    lines.append(f"- 전월 수입: {_won(prev['income_total'])}, 전월 지출: {_won(prev['expense_total'])}")
    lines.append(
        f"- 수입 변화: {_won(cur['income_total'] - prev['income_total'])}, "
        f"지출 변화: {_won(cur['expense_total'] - prev['expense_total'])}"
    )
    return "\n".join(lines)


_SYSTEM_PROMPT = (
    "너는 '으니영이의 북극성'이라는 부부 가계부 앱의 친근한 AI 자산 코치야. "
    "사용자의 월간 가계부 데이터를 보고 따뜻하고 격려하는 말투로 한국어 월간 리포트를 작성해. "
    "별/북극성/궤도 같은 우주 비유를 가볍게 곁들이면 좋아(과하지 않게). "
    "반드시 마크다운으로 작성하고, 다음을 포함해: "
    "① 한 줄 요약, ② 수입·지출·순저축 진단, ③ 예산 대비 분석(초과 항목이 있으면 콕 집어 알려주기), "
    "④ 지출 상위 카테고리에 대한 코멘트, ⑤ 전월 대비 변화, ⑥ 다음 달 실천 제안 2~3가지. "
    "데이터가 거의 없으면 그 사실을 부드럽게 언급하고 가계부 작성을 독려해. "
    "숫자는 데이터에 주어진 값만 사용하고 임의로 지어내지 마. 너무 길지 않게 핵심 위주로."
)


def _generate_report_content(api_key: str, model: str, user_prompt: str) -> str:
    """OpenAI 호출 — 실패 시 502로 변환(부분 저장 방지)."""
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = (resp.choices[0].message.content or "").strip()
    except Exception as e:  # noqa: BLE001 — 외부 API 오류를 그대로 클라이언트에 전달
        raise HTTPException(status_code=502, detail=f"AI 리포트 생성에 실패했습니다: {e}")
    if not content:
        raise HTTPException(status_code=502, detail="AI 리포트 응답이 비어 있습니다.")
    return content


@router.post("/ai-report", response_model=schemas.AIReportOut, status_code=201)
def create_ai_report(
    month: str = Query(pattern=schemas.YEAR_MONTH_PATTERN),
    db: Session = Depends(get_db),
):
    api_key, model = settings_store.get_openai_config(db)
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenAI API 키가 설정되지 않았습니다. 설정 > AI 설정에서 먼저 등록해 주세요.",
        )

    cur = _month_stats(db, month)
    prev = _month_stats(db, _prev_month(month))
    prompt = _build_report_prompt(month, cur, prev)
    content = _generate_report_content(api_key, model, prompt)

    report = models.AIReport(year_month=month, content=content, model=model)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/ai-report", response_model=schemas.AIReportOut | None)
def latest_ai_report(
    month: str = Query(pattern=schemas.YEAR_MONTH_PATTERN),
    db: Session = Depends(get_db),
):
    """해당 월의 가장 최근 리포트 1건. 없으면 null."""
    return db.scalars(
        select(models.AIReport)
        .where(models.AIReport.year_month == month)
        .order_by(models.AIReport.created_at.desc(), models.AIReport.id.desc())
        .limit(1)
    ).first()
