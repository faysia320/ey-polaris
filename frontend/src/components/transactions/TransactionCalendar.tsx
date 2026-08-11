import { useMemo } from 'react'
import { DatePicker, Text } from '@seed-design/react'

import { formatKRW, fromCalendarDate, toCalendarDate, todayISO } from '@/lib/format'
import type { Transaction } from '@/types'

interface DayTotals {
  income: number
  expense: number
}

interface TransactionCalendarProps {
  /** 표시할 월 (YYYY-MM) */
  month: string
  /** 표시할 거래 (이 월의 거래만 합계에 반영됨) */
  transactions: Transaction[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
  /** DatePicker 자체 헤더의 월 이동 — 주면 페이지의 월 상태와 동기화된다 */
  onMonthChange?: (month: string) => void
}

/**
 * 일별 수입/지출 합계를 얹은 달력.
 *
 * 직접 만든 7열 그리드 대신 SEED DatePicker의 `renderDateCellSupplement`를 쓴다 —
 * 날짜 숫자 아래에 부가 정보를 붙이라고 정의된 확장 지점이고, 셀의 DOM·ARIA·키보드 이동은
 * 컴포넌트가 계속 소유해 접근성을 잃지 않는다.
 */
export function TransactionCalendar({
  month,
  transactions,
  selectedDate,
  onSelectDate,
  onMonthChange,
}: TransactionCalendarProps) {
  const totalsByDate = useMemo(() => {
    const map = new Map<string, DayTotals>()
    for (const t of transactions) {
      // 이체는 자산 이동일 뿐 — 일별 수입/지출 합계에서 제외
      if (t.kind === 'transfer') continue
      const totals = map.get(t.date) ?? { income: 0, expense: 0 }
      if (t.kind === 'income') totals.income += t.amount
      else totals.expense += t.amount
      map.set(t.date, totals)
    }
    return map
  }, [transactions])

  const viewDate = toCalendarDate(`${month}-01`)
  const selected = selectedDate ? toCalendarDate(selectedDate) : undefined

  return (
    <div className="rounded-r2 border border-stroke-neutral-weak p-x3">
      <DatePicker
        aria-label={`${month} 거래 달력`}
        today={toCalendarDate(todayISO())}
        viewDate={viewDate}
        onViewDateChange={(d) => onMonthChange?.(fromCalendarDate(d).slice(0, 7))}
        value={selected}
        onValueChange={(d) => onSelectDate(fromCalendarDate(d))}
        renderDateCellSupplement={({ date }) => {
          const totals = totalsByDate.get(fromCalendarDate(date))
          if (!totals) return null
          return (
            <>
              {totals.income > 0 && (
                <Text as="span" textStyle="t1Regular" color="fg.positive" maxLines={1}>
                  +{formatKRW(totals.income)}
                </Text>
              )}
              {totals.expense > 0 && (
                <Text as="span" textStyle="t1Regular" color="fg.critical" maxLines={1}>
                  -{formatKRW(totals.expense)}
                </Text>
              )}
            </>
          )
        }}
      />
    </div>
  )
}
