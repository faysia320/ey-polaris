import * as React from "react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/** 'YYYY-MM-DD' → 로컬 자정 Date. 빈 문자열이면 undefined. */
function parseISODate(value: string): Date | undefined {
  if (!value) return undefined
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Date → 로컬 기준 'YYYY-MM-DD'. toISOString()은 UTC 변환으로 날짜가 밀릴 수 있어 금지. */
function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`
}

interface DatePickerProps {
  id?: string
  /** 'YYYY-MM-DD' 문자열. 빈 문자열('')은 미선택 상태 */
  value: string
  onChange: (next: string) => void
  placeholder?: string
  /** true면 선택 해제 버튼 표시 (해제 시 onChange('')) */
  clearable?: boolean
  /** true면 오늘 이후 날짜 선택 비활성 */
  disableFuture?: boolean
  className?: string
}

function DatePicker({
  id,
  value,
  onChange,
  placeholder = "날짜 선택",
  clearable = false,
  disableFuture = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseISODate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          data-slot="date-picker-trigger"
          className={cn(
            "w-full justify-start font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="text-muted-foreground" />
          {selected ? format(selected, "PPP", { locale: ko }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ko}
          selected={selected}
          defaultMonth={selected}
          disabled={disableFuture ? { after: new Date() } : undefined}
          onSelect={(date) => {
            // single 모드는 선택된 날짜 재클릭 시 해제(undefined)를 보낸다 —
            // 필수 필드(clearable 아님)에서는 해제를 무시해 값이 비워지지 않게 한다
            if (!date && !clearable) {
              setOpen(false)
              return
            }
            onChange(date ? toISODate(date) : "")
            setOpen(false)
          }}
        />
        {clearable && value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="m-2 mt-0 text-muted-foreground"
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

export { DatePicker }
