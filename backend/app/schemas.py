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
# 거래/카테고리가 공유하는 구분 — transfer는 계좌 간 자산 이동(수입/지출 통계 제외)
CategoryKind = Literal["income", "expense", "transfer"]
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
    counter_account_id: int | None = Field(
        default=None, description="이체(transfer) 전용 입금 계정 — account_id가 출금 계정"
    )
    member_id: int | None = None
    memo: str | None = Field(default=None, max_length=255)


class TransactionUpdate(TransactionCreate):
    pass


class TransactionOut(TransactionCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category_name: str
    account_name: str
    counter_account_name: str | None = None
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
    major: str = Field(min_length=1, max_length=100, description="지출 대분류 이름")
    amount: int = Field(gt=0)

    @field_validator("major")
    @classmethod
    def strip_major(cls, v: str) -> str:
        # API 직접 호출 시 공백 패딩(" 교통 ")이 별도 대분류로 저장되는 것을 방지
        v = v.strip()
        if not v:
            raise ValueError("대분류 이름이 비어 있습니다")
        return v


class BudgetUpdate(BaseModel):
    amount: int = Field(gt=0)


class BudgetOut(BudgetCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Analytics ----------
class CategoryAmount(BaseModel):
    # 대시보드 도넛 차트용 대분류 집계 (소분류 56종을 그대로 내보내면 과밀)
    category_name: str
    amount: int


class BudgetProgress(BaseModel):
    major: str
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


# 이체 검토 행에 대한 사용자 결정 — transfer는 페어 행이 아니면 상대 계정 필수
ImportAction = Literal["income", "expense", "transfer", "skip"]


class ImportReviewRow(BaseModel):
    row: int = Field(description="엑셀 행 번호 (헤더 포함 1부터)")
    date: date_type
    major: str = Field(description="원본 대분류 (이체/내계좌이체/카드대금 등)")
    minor: str
    description: str | None = None
    amount: int = Field(description="부호 보존 — 음수=결제수단에서 출금, 양수=입금")
    account_name: str = Field(description="결제수단 (행 자신의 계정)")
    pair_row: int | None = Field(default=None, description="내계좌이체 자동 페어 상대 행 번호")
    suggested: ImportAction = Field(description="기본 제안")


class ImportPreview(BaseModel):
    month: str
    month_rows: int = Field(description="해당 월 전체 행 수")
    importable_count: int = Field(description="검토 없이 적재되는 수입/지출 행 수")
    review: list[ImportReviewRow]
    skipped: list[ImportSkippedRow]


class ImportDecision(BaseModel):
    row: int
    action: ImportAction
    counter_account_id: int | None = Field(
        default=None, description="transfer 전용 상대 계정 — 페어 행이면 생략 가능"
    )


class ImportResult(BaseModel):
    month: str
    deleted_count: int = Field(description="교체 삭제된 기존 가져오기 거래 수")
    created_count: int
    transfer_count: int = Field(default=0, description="이체로 적재된 거래 수 (검토 결정)")
    converted_count: int = Field(default=0, description="수입/지출로 전환 적재된 검토 행 수")
    skipped: list[ImportSkippedRow]
    created_categories: list[str] = Field(description="자동 생성된 카테고리 표시명")
    created_accounts: list[str] = Field(description="자동 생성된 자산 계정명")
