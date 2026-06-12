import { useMemo } from 'react'

import { cn } from '@/lib/utils'
import { formatKRW, todayISO } from '@/lib/format'
import type { Transaction } from '@/types'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

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
}

export function TransactionCalendar({
  month,
  transactions,
  selectedDate,
  onSelectDate,
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

  const year = Number(month.slice(0, 4))
  const mon = Number(month.slice(5, 7))
  const firstWeekday = new Date(year, mon - 1, 1).getDay()
  const daysInMonth = new Date(year, mon, 0).getDate()
  const today = todayISO()

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="rounded-lg border">
      <div className="grid grid-cols-7 border-b text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cn('py-2', i === 0 && 'text-rose-400', i === 6 && 'text-sky-400')}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`blank-${idx}`} className="min-h-20 border-b border-r" />
          }
          const dateStr = `${month}-${String(day).padStart(2, '0')}`
          const totals = totalsByDate.get(dateStr)
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              className={cn(
                'flex min-h-20 flex-col items-start gap-0.5 border-b border-r p-1.5 text-left transition-colors hover:bg-accent/50',
                selectedDate === dateStr && 'bg-accent',
              )}
            >
              <span
                className={cn(
                  'text-xs',
                  dateStr === today
                    ? 'flex size-5 items-center justify-center rounded-full bg-yellow-300 font-semibold text-zinc-900'
                    : 'text-muted-foreground',
                )}
              >
                {day}
              </span>
              {totals && totals.income > 0 && (
                <span className="text-[10px] leading-tight text-emerald-400">
                  +{formatKRW(totals.income)}
                </span>
              )}
              {totals && totals.expense > 0 && (
                <span className="text-[10px] leading-tight text-rose-400">
                  -{formatKRW(totals.expense)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
