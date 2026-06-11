import * as React from "react"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/** react-day-picker는 월 전용 선택 모드가 없어 12개월 그리드로 직접 구현한다. */

const MONTH_LABELS = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
]

interface MonthPickerProps {
  id?: string
  /** 'YYYY-MM' 문자열. 빈 문자열('')은 미선택 상태 */
  value: string
  onChange: (next: string) => void
  placeholder?: string
  /** true면 선택 해제 버튼 표시 (해제 시 onChange('')) */
  clearable?: boolean
  className?: string
}

function MonthPicker({
  id,
  value,
  onChange,
  placeholder = "월 선택",
  clearable = false,
  className,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false)
  const selectedYear = value ? Number(value.slice(0, 4)) : null
  const selectedMonth = value ? Number(value.slice(5, 7)) : null
  const [viewYear, setViewYear] = React.useState(
    () => selectedYear ?? new Date().getFullYear()
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // 열 때마다 선택값의 연도(없으면 올해)로 보기 초기화
        if (next) setViewYear(selectedYear ?? new Date().getFullYear())
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          data-slot="month-picker-trigger"
          className={cn(
            "w-full justify-start font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="text-muted-foreground" />
          {selectedYear !== null && selectedMonth !== null
            ? `${selectedYear}년 ${selectedMonth}월`
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto" align="start">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="이전 연도"
            onClick={() => setViewYear((y) => y - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="text-sm font-medium select-none">{viewYear}년</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="다음 연도"
            onClick={() => setViewYear((y) => y + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTH_LABELS.map((label, i) => {
            const month = i + 1
            const isSelected =
              viewYear === selectedYear && month === selectedMonth
            return (
              <Button
                key={month}
                type="button"
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className="font-normal"
                onClick={() => {
                  onChange(`${viewYear}-${String(month).padStart(2, "0")}`)
                  setOpen(false)
                }}
              >
                {label}
              </Button>
            )
          })}
        </div>
        {clearable && value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
          >
            선택 해제
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

export { MonthPicker }
