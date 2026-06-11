from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.database import get_db
from app.routers.transactions import _to_out as transaction_to_out

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _month_range(month: str) -> tuple[date, date]:
    year, mon = int(month[:4]), int(month[5:7])
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end


def _signed_amount():
    """수입은 +, 지출은 - 로 부호를 붙인 금액 표현식."""
    return case(
        (models.Transaction.kind == "income", models.Transaction.amount),
        else_=-models.Transaction.amount,
    )


@router.get("/dashboard", response_model=schemas.DashboardOut)
def dashboard(
    month: str = Query(pattern=schemas.YEAR_MONTH_PATTERN),
    db: Session = Depends(get_db),
):
    start, end = _month_range(month)
    in_month = (models.Transaction.date >= start) & (models.Transaction.date < end)

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
    # 예산 진행률용 — 예산은 카테고리(소분류) 행 단위
    spent_by_category = dict(
        db.execute(
            select(
                models.Transaction.category_id,
                func.sum(models.Transaction.amount),
            )
            .where(in_month, models.Transaction.kind == "expense")
            .group_by(models.Transaction.category_id)
        ).all()
    )

    budget_rows = db.scalars(
        select(models.Budget)
        .options(selectinload(models.Budget.category))
        .where(models.Budget.year_month == month)
        .order_by(models.Budget.id)
    ).all()
    budgets = [
        schemas.BudgetProgress(
            category_id=b.category_id,
            category_name=b.category.display_name,
            amount=b.amount,
            spent=spent_by_category.get(b.category_id, 0),
        )
        for b in budget_rows
    ]

    recent = db.scalars(
        select(models.Transaction)
        .options(
            selectinload(models.Transaction.category),
            selectinload(models.Transaction.account),
            selectinload(models.Transaction.member),
        )
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
        .limit(5)
    ).all()

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
        recent_transactions=[transaction_to_out(t) for t in recent],
    )


@router.get("/assets", response_model=schemas.AssetsOut)
def assets(db: Session = Depends(get_db)):
    accounts = db.scalars(select(models.Account).order_by(models.Account.id)).all()
    net_by_account = dict(
        db.execute(
            select(models.Transaction.account_id, func.sum(_signed_amount())).group_by(
                models.Transaction.account_id
            )
        ).all()
    )

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

    balances: list[schemas.AccountBalance] = []
    for a in accounts:
        history = monthly_valuations.get(a.id, [])
        if history:
            _, valued_at, balance = history[-1]
        else:
            balance, valued_at = a.opening_balance + int(net_by_account.get(a.id, 0)), None
        balances.append(
            schemas.AccountBalance(
                id=a.id,
                name=a.name,
                type=a.type,
                is_active=a.is_active,
                balance=balance,
                valued_at=valued_at,
            )
        )

    # 월별 자산 추이 (최근 12개월): 계정별로
    #  - 해당 월 말 이전의 최신 평가액이 있으면 그 평가액
    #  - 없으면 개설 잔액 + 해당 월까지의 누적 순증감 (기존 방식)
    month_expr = func.to_char(models.Transaction.date, "YYYY-MM")
    account_month_net: dict[tuple[int, str], int] = {
        (account_id, m): int(total)
        for account_id, m, total in db.execute(
            select(models.Transaction.account_id, month_expr, func.sum(_signed_amount())).group_by(
                models.Transaction.account_id, month_expr
            )
        ).all()
    }

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
        for a in accounts
    }
    # 계정별 평가액 포인터 워크: 창 시작 이전의 최신 평가액을 시작점으로 두고
    # 월을 진행하며 최신값을 갱신한다 (월마다 이력 전체를 재탐색하지 않음)
    val_idx: dict[int, int] = {}
    last_value: dict[int, int | None] = {}
    for a in accounts:
        history = monthly_valuations.get(a.id, [])
        i = 0
        while i < len(history) and history[i][0] < months[0]:
            i += 1
        val_idx[a.id] = i
        last_value[a.id] = history[i - 1][2] if i > 0 else None

    trend: list[schemas.MonthlyPoint] = []
    for m in months:
        total = 0
        for a in accounts:
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
        trend=trend,
    )
