import type { AccountType, TransactionKind } from '@/types'

const krw = new Intl.NumberFormat('ko-KR')

/** 거래/카테고리 구분 한글 라벨 */
export const KIND_LABEL: Record<TransactionKind, string> = {
  income: '수입',
  expense: '지출',
  transfer: '이체',
}

/** 자산 계정 유형 목록 — 표시 순서까지 포함해 계정 선택 UI가 공유한다 */
export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'bank', label: '은행' },
  { value: 'cash', label: '현금' },
  { value: 'card', label: '카드' },
  { value: 'easy_pay', label: '간편결제' },
  { value: 'e_money', label: '전자금융자산' },
  { value: 'investment', label: '투자' },
  { value: 'stock', label: '주식' },
  { value: 'real_estate', label: '부동산' },
  { value: 'deposit', label: '보증금' },
  { value: 'other', label: '기타' },
  { value: 'loan', label: '대출' },
]

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type
}

/** 카테고리 표시명 — 소분류가 '미분류'면 대분류만 (백엔드 display_name과 동일 규칙). */
export function categoryLabel(c: { major: string; minor: string }): string {
  return c.minor === '미분류' ? c.major : `${c.major} > ${c.minor}`
}

export function formatKRW(amount: number): string {
  return `${krw.format(amount)}원`
}

/** 천단위 콤마만 적용 (접미사 없음). 예: 1000000 → "1,000,000" */
export function formatNumber(amount: number): string {
  return krw.format(amount)
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function currentMonth(): string {
  return todayISO().slice(0, 7)
}

/** 오늘 기준 직전 월(YYYY-MM). 조회 화면들의 기본 선택 월로 사용한다. */
export function previousMonth(): string {
  return addMonths(currentMonth(), -1)
}

/** YYYY-MM 문자열에 delta개월을 더한다. */
export function addMonths(month: string, delta: number): string {
  const year = Number(month.slice(0, 4))
  const mon = Number(month.slice(5, 7))
  const total = year * 12 + (mon - 1) + delta
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`
}

/** 해당 월에서 오늘까지 경과한 비율(0~1). 과거 월은 1, 미래 월은 0. */
export function monthPace(month: string): number {
  const now = currentMonth()
  if (month < now) return 1
  if (month > now) return 0
  const d = new Date()
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return d.getDate() / daysInMonth
}
