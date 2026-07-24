export type AccountType =
  | 'bank'
  | 'cash'
  | 'card'
  | 'easy_pay'
  /** 전자금융자산 — 네이버페이·온라인상품권 등 선불 충전형(자체 잔액 보유, easy_pay와 달리 패스스루 아님) */
  | 'e_money'
  | 'investment'
  | 'stock'
  | 'real_estate'
  /** 보증금 — 전세·임차 보증금 등 시세 변동 없는 고정 금액 자산 */
  | 'deposit'
  /** 대출 — 부채. 음수 잔액으로 두면 총자산에서 자동 차감(순자산) */
  | 'loan'
  | 'other'
/** transfer는 계좌 간 자산 이동 — 수입/지출 통계에 포함되지 않는다 */
export type TransactionKind = 'income' | 'expense' | 'transfer'
export type CategoryNature = 'fixed' | 'variable'
/** 사후 묶음 유형 — transfer(계좌 간 이체) | refund(카드 결제+환불) */
export type LinkType = 'transfer' | 'refund'

/** 묶음의 짝 다리 요약 — 병합 행 렌더·묶음 보기 모달용. 짝이 현재 조회 필터 밖이어도 채워진다 */
export interface TransactionLinkPartner {
  id: number
  date: string
  time: string | null
  kind: TransactionKind
  amount: number
  category_name: string
  account_name: string
  memo: string | null
}

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
  /** 거래 시각 "HH:MM:SS" — 없으면 null */
  time: string | null
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
  /** 사후 묶음 그룹 id — 묶이지 않았으면 null */
  link_id: number | null
  /** 묶음 유형 — 묶이지 않았으면 null */
  link_type: LinkType | null
  /** 묶음의 짝 다리 요약 — 묶이지 않았거나 짝을 못 찾으면 null */
  linked_partner: TransactionLinkPartner | null
}

export interface TransactionInput {
  date: string
  /** 거래 시각 "HH:MM" 또는 "HH:MM:SS" — 미입력이면 null */
  time: string | null
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
  /** 소유 구성원 — 구성원별 분할 표시에 사용 */
  member_id: number
  member_name: string
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

/**
 * 뱅샐현황 자산 표에서 읽은 부동산 평가액 (오늘 날짜로 반영 예정).
 * 주식은 보유 총합을 자산 페이지에서 직접 입력하므로 엑셀에서 읽지 않는다.
 */
export interface ImportValuationRow {
  /** 엑셀 상품명 — 같은 이름의 계정과 매칭 */
  product_name: string
  account_type: 'real_estate'
  value: number
}

export interface ImportPreview {
  month: string
  month_rows: number
  /** 검토 없이 적재되는 수입/지출 행 수 */
  importable_count: number
  review: ImportReviewRow[]
  skipped: ImportSkippedRow[]
  valuations: ImportValuationRow[]
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
  /** 오늘 날짜로 기록·갱신된 부동산 평가액 수 */
  valuation_count: number
}

export interface AIReport {
  id: number
  year_month: string
  /** 마크다운 리포트 본문 */
  content: string
  /** 생성에 사용한 OpenAI 모델명 */
  model: string
  created_at: string
}

export interface AISettings {
  model: string
  /** API 키 등록 여부 — 원문 키는 서버가 반환하지 않는다 */
  api_key_set: boolean
  /** 등록된 키 끝 4자리 힌트 (예: "…ab12"), 미등록이면 null */
  api_key_hint: string | null
}

export interface AISettingsUpdate {
  /** 미포함/빈 값이면 기존 키 유지 */
  api_key?: string | null
  model?: string | null
}
