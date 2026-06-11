export type AccountType =
  | 'bank'
  | 'cash'
  | 'card'
  | 'investment'
  | 'stock'
  | 'real_estate'
  | 'other'
export type TransactionKind = 'income' | 'expense'
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
  member_id: number | null
  memo: string | null
  category_name: string
  account_name: string
  member_name: string | null
}

export interface TransactionInput {
  date: string
  amount: number
  kind: TransactionKind
  category_id: number
  account_id: number
  member_id: number | null
  memo: string | null
}

export interface Budget {
  id: number
  year_month: string
  category_id: number
  amount: number
  category_name: string
}

export interface BudgetProgress {
  category_id: number
  category_name: string
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
  recent_transactions: Transaction[]
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
  trend: MonthlyPoint[]
}

export interface ImportSkippedRow {
  /** 엑셀 행 번호 (헤더 포함 1부터) */
  row: number
  reason: string
}

export interface ImportResult {
  month: string
  deleted_count: number
  created_count: number
  skipped: ImportSkippedRow[]
  created_categories: string[]
  created_accounts: string[]
}
