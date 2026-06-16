export type AccountType =
  | 'bank'
  | 'cash'
  | 'card'
  | 'easy_pay'
  | 'investment'
  | 'stock'
  | 'real_estate'
  | 'other'
/** transfer는 계좌 간 자산 이동 — 수입/지출 통계에 포함되지 않는다 */
export type TransactionKind = 'income' | 'expense' | 'transfer'
export type CategoryNature = 'fixed' | 'variable'

export interface Member {
  id: number
  name: string
  color: string
}

export interface Account {
  id: number
  name: string
  type: AccountType
  opening_balance: number
  is_active: boolean
  /** 소유자 구성원 id — 모든 계정은 소유자 필수 */
  member_id: number
  /** 간편결제(easy_pay) 전용 — 실제 결제가 빠지는 카드/은행 계정 id. 그 외 유형은 null */
  linked_account_id: number | null
}

export interface Category {
  id: number
  /** 대분류 */
  major: string
  /** 소분류 — 없으면 '미분류' */
  minor: string
  kind: TransactionKind
  nature: CategoryNature
}

export interface Transaction {
  id: number
  date: string
  amount: number
  kind: TransactionKind
  category_id: number
  account_id: number
  /** 이체 전용 — 입금 계정 (account_id가 출금 계정) */
  counter_account_id: number | null
  member_id: number | null
  memo: string | null
  category_name: string
  account_name: string
  counter_account_name: string | null
  member_name: string | null
}

export interface TransactionInput {
  date: string
  amount: number
  kind: TransactionKind
  category_id: number
  account_id: number
  /** 이체 전용 — 입금 계정. 수입/지출은 null */
  counter_account_id: number | null
  member_id: number | null
  memo: string | null
}

export interface Budget {
  id: number
  year_month: string
  /** 지출 대분류 이름 — 예산은 대분류 단위로만 설정한다 */
  major: string
  amount: number
}

export interface BudgetProgress {
  /** 지출 대분류 이름 */
  major: string
  amount: number
  spent: number
}

export interface CategoryAmount {
  /** 대분류 집계 라벨 */
  category_name: string
  amount: number
}

export interface Dashboard {
  month: string
  income_total: number
  expense_total: number
  budget_total: number
  budget_spent: number
  budgets: BudgetProgress[]
  expense_by_category: CategoryAmount[]
}

export interface AccountBalance {
  id: number
  name: string
  type: AccountType
  is_active: boolean
  balance: number
  /** 잔액이 평가액 기반이면 해당 평가 기준일(YYYY-MM-DD), 아니면 null */
  valued_at: string | null
}

export interface Valuation {
  id: number
  account_id: number
  date: string
  value: number
}

export interface ValuationInput {
  date: string
  value: number
}

export interface Goal {
  id: number
  name: string
  target_amount: number
  target_date: string | null
}

export interface GoalInput {
  name: string
  target_amount: number
  target_date: string | null
}

export interface MonthlyPoint {
  month: string
  total: number
}

export interface Assets {
  accounts: AccountBalance[]
  total: number
  /** 구성원 필터와 무관한 가구 전체 총자산 — 공동 목표 달성률 계산용 */
  grand_total: number
  trend: MonthlyPoint[]
}

export interface ImportSkippedRow {
  /** 엑셀 행 번호 (헤더 포함 1부터) */
  row: number
  reason: string
}

/** 이체 검토 행에 대한 사용자 결정 */
export type ImportAction = 'income' | 'expense' | 'transfer' | 'skip'

export interface ImportReviewRow {
  /** 엑셀 행 번호 (헤더 포함 1부터) */
  row: number
  date: string
  /** 원본 대분류 (이체/내계좌이체/카드대금 등) */
  major: string
  minor: string
  description: string | null
  /** 부호 보존 — 음수=결제수단에서 출금, 양수=입금 */
  amount: number
  account_name: string
  /** 내계좌이체 자동 페어 상대 행 번호 */
  pair_row: number | null
  suggested: ImportAction
}

export interface ImportPreview {
  month: string
  month_rows: number
  /** 검토 없이 적재되는 수입/지출 행 수 */
  importable_count: number
  review: ImportReviewRow[]
  skipped: ImportSkippedRow[]
}

export interface ImportDecision {
  row: number
  action: ImportAction
  /** transfer 전용 상대 계정 — 페어 행이면 생략 가능 */
  counter_account_id?: number | null
}

export interface ImportResult {
  month: string
  deleted_count: number
  created_count: number
  /** 이체로 적재된 거래 수 (검토 결정) */
  transfer_count: number
  /** 수입/지출로 전환 적재된 검토 행 수 */
  converted_count: number
  skipped: ImportSkippedRow[]
  created_categories: string[]
  created_accounts: string[]
}
