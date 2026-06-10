export type AccountType = 'bank' | 'cash' | 'card' | 'investment' | 'other'
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
  name: string
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
  category_id: number
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
