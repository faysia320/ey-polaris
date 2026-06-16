from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app import models, schemas
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


@router.get("/dashboard", response_model=schemas.DashboardOut)
def dashboard(
    month: str = Query(pattern=schemas.YEAR_MONTH_PATTERN),
    member_id: int | None = Query(default=None, description="구성원 필터 — 미지정 시 전체"),
    db: Session = Depends(get_db),
):
    start, end = _month_range(month)
    in_month = (models.Transaction.date >= start) & (models.Transaction.date < end)
    if member_id is not None:
        # 구성원 필터 — 거래 기반 집계(합계/카테고리/예산 spent)에 일괄 적용
        in_month = in_month & (models.Transaction.member_id == member_id)

    def month_total(kind: str) -> int:
        return db.scalar(
            select(func.coalesce(func.sum(models.Transaction.amount), 0)).where(
                in_month, models.Transaction.kind == kind
            )
        )

    # 도넛 차트용 — 소분류 56종을 그대로 내보내면 과밀하므로 대분류로 집계
    expense_rows = db.execute(
        select(
            models.Category.major,
            func.sum(models.Transaction.amount).label("amount"),
        )
        .join(models.Transaction, models.Transaction.category_id == models.Category.id)
        .where(in_month, models.Transaction.kind == "expense")
        .group_by(models.Category.major)
        .order_by(func.sum(models.Transaction.amount).desc())
    ).all()
    # 예산 진행률용 — 예산은 지출 대분류 단위, spent는 대분류 아래 모든 소분류 합산
    spent_by_major = {row.major: int(row.amount) for row in expense_rows}

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
        income_total=month_total("income"),
        expense_total=month_total("expense"),
        budget_total=sum(b.amount for b in budgets),
        budget_spent=sum(b.spent for b in budgets),
        budgets=budgets,
        expense_by_category=[
            schemas.CategoryAmount(category_name=row.major, amount=row.amount)
            for row in expense_rows
        ],
    )


@router.get("/assets", response_model=schemas.AssetsOut)
def assets(
    member_id: int | None = Query(default=None, description="소유자 필터 — 미지정 시 전체"),
    db: Session = Depends(get_db),
):
    accounts = db.scalars(select(models.Account).order_by(models.Account.id)).all()
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
