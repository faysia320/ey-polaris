from datetime import date as date_type
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

YEAR_MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


# ---------- Member ----------
class MemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: str = Field(default="#a78bfa", max_length=20)


class MemberUpdate(MemberCreate):
    pass


class MemberOut(MemberCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Account ----------
AccountType = Literal["bank", "cash", "card", "investment", "stock", "real_estate", "other"]


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: AccountType
    opening_balance: int = 0
    is_active: bool = True
    member_id: int = Field(description="소유자 구성원 id — 모든 계정은 소유자 필수")


class AccountUpdate(AccountCreate):
    pass


class AccountOut(AccountCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Category ----------
CategoryKind = Literal["income", "expense"]
CategoryNature = Literal["fixed", "variable"]


class CategoryCreate(BaseModel):
    major: str = Field(min_length=1, max_length=100, description="대분류")
    minor: str = Field(default="미분류", min_length=1, max_length=100, description="소분류")
    kind: CategoryKind
    nature: CategoryNature = "variable"


class CategoryUpdate(CategoryCreate):
    pass


class CategoryOut(CategoryCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Transaction ----------
class TransactionCreate(BaseModel):
    date: date_type
    amount: int = Field(gt=0, description="KRW 정수(원). 항상 양수, 방향은 kind로 구분")
    kind: CategoryKind
    category_id: int
    account_id: int
    member_id: int | None = None
    memo: str | None = Field(default=None, max_length=255)


class TransactionUpdate(TransactionCreate):
    pass


class TransactionOut(TransactionCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category_name: str
    account_name: str
    member_name: str | None = None


# ---------- AssetValuation ----------
class ValuationUpsert(BaseModel):
    date: date_type
    value: int = Field(ge=0, description="KRW 정수(원) 평가액. 0 이상")

    @field_validator("date")
    @classmethod
    def date_not_in_future(cls, v: date_type) -> date_type:
        # 미래 평가액은 잔액(즉시 반영)과 추이(월말 기준)의 비일관을 만들므로 차단
        if v > date_type.today():
            raise ValueError("평가 기준일은 미래 날짜일 수 없습니다")
        return v


class ValuationOut(ValuationUpsert):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int


# ---------- Goal ----------
class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: int = Field(gt=0)
    target_date: date_type | None = None


class GoalUpdate(GoalCreate):
    pass


class GoalOut(GoalCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Budget ----------
class BudgetCreate(BaseModel):
    year_month: str = Field(pattern=YEAR_MONTH_PATTERN)
    category_id: int
    amount: int = Field(gt=0)


class BudgetUpdate(BaseModel):
    amount: int = Field(gt=0)


class BudgetOut(BudgetCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category_name: str


# ---------- Analytics ----------
class CategoryAmount(BaseModel):
    # 대시보드 도넛 차트용 대분류 집계 (소분류 56종을 그대로 내보내면 과밀)
    category_name: str
    amount: int


class BudgetProgress(BaseModel):
    category_id: int
    category_name: str
    amount: int
    spent: int


class DashboardOut(BaseModel):
    month: str
    income_total: int
    expense_total: int
    budget_total: int
    budget_spent: int
    budgets: list[BudgetProgress]
    expense_by_category: list[CategoryAmount]
    recent_transactions: list[TransactionOut]


class AccountBalance(BaseModel):
    id: int
    name: str
    type: str
    is_active: bool
    balance: int
    # 잔액이 평가액 기반이면 해당 평가 기준일, 아니면 None
    valued_at: date_type | None = None


class MonthlyPoint(BaseModel):
    month: str
    total: int


class AssetsOut(BaseModel):
    accounts: list[AccountBalance]
    total: int
    # 구성원 필터와 무관한 가구 전체 총자산 — 공동 목표 달성률 계산용
    grand_total: int
    trend: list[MonthlyPoint]


# ---------- Excel Import ----------
class ImportSkippedRow(BaseModel):
    row: int = Field(description="엑셀 행 번호 (헤더 포함 1부터)")
    reason: str


class ImportResult(BaseModel):
    month: str
    deleted_count: int = Field(description="교체 삭제된 기존 가져오기 거래 수")
    created_count: int
    skipped: list[ImportSkippedRow]
    created_categories: list[str] = Field(description="자동 생성된 카테고리 표시명")
    created_accounts: list[str] = Field(description="자동 생성된 자산 계정명")
