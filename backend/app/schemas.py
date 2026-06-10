from datetime import date as date_type
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

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
AccountType = Literal["bank", "cash", "card", "investment", "other"]


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: AccountType
    opening_balance: int = 0
    is_active: bool = True


class AccountUpdate(AccountCreate):
    pass


class AccountOut(AccountCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Category ----------
CategoryKind = Literal["income", "expense"]
CategoryNature = Literal["fixed", "variable"]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
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
    category_id: int
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


class MonthlyPoint(BaseModel):
    month: str
    total: int


class AssetsOut(BaseModel):
    accounts: list[AccountBalance]
    total: int
    trend: list[MonthlyPoint]
