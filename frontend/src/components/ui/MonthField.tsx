/*
 * 월(YYYY-MM) 선택 필드.
 *
 * SEED DatePicker는 '일'까지 고르는 달력이라 월 단위 선택에는 맞지 않는다.
 * DateField와 같은 뼈대(FieldButton + Dialog)를 쓰되, 안쪽만 연도 이동 + 12개월 그리드로 짠다.
 */
import { useState } from 'react'
import {
  IconCalendarLine,
  IconChevronLeftLine,
  IconChevronRightLine,
} from '@karrotmarket/react-monochrome-icon'
import { Icon } from '@seed-design/react'
import { ActionButton } from 'seed-design/ui/action-button'
import { DialogContent, DialogRoot } from 'seed-design/ui/dialog'
import { FieldButton, FieldButtonPlaceholder, FieldButtonValue } from 'seed-design/ui/field-button'

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

interface MonthFieldProps {
  label?: string
  /** 'YYYY-MM' 문자열. 빈 문자열('')은 미선택 상태 */
  value: string
  onChange: (next: string) => void
  placeholder?: string
  /** true면 선택 해제 버튼 표시 (해제 시 onChange('')) */
  clearable?: boolean
}

export function MonthField({
  label,
  value,
  onChange,
  placeholder = '월 선택',
  clearable = false,
}: MonthFieldProps) {
  const [open, setOpen] = useState(false)
  const selectedYear = value ? Number(value.slice(0, 4)) : null
  const selectedMonth = value ? Number(value.slice(5, 7)) : null
  const [viewYear, setViewYear] = useState(() => selectedYear ?? new Date().getFullYear())

  const openDialog = () => {
    // 열 때마다 선택값의 연도(없으면 올해)로 보기 초기화
    setViewYear(selectedYear ?? new Date().getFullYear())
    setOpen(true)
  }

  const displayValue =
    selectedYear !== null && selectedMonth !== null ? `${selectedYear}년 ${selectedMonth}월` : ''

  return (
    <>
      <FieldButton
        label={label}
        size="responsive"
        prefixIcon={<IconCalendarLine />}
        showClearButton={clearable && value !== ''}
        values={[value]}
        onValuesChange={([v]) => onChange(v ?? '')}
        buttonProps={{
          onClick: openDialog,
          'aria-label': displayValue
            ? `${label ?? '월'} 변경. 현재 ${displayValue}`
            : (label ?? placeholder),
        }}
      >
        {displayValue ? (
          <FieldButtonValue>{displayValue}</FieldButtonValue>
        ) : (
          <FieldButtonPlaceholder>{placeholder}</FieldButtonPlaceholder>
        )}
      </FieldButton>

      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent title={label ?? '월 선택'} showCloseButton>
          <div className="flex flex-col gap-x4 p-x4">
            <div className="flex items-center justify-between">
              <ActionButton
                variant="ghost"
                size="small"
                layout="iconOnly"
                aria-label="이전 연도"
                onClick={() => setViewYear((y) => y - 1)}
              >
                <Icon svg={<IconChevronLeftLine />} />
              </ActionButton>
              <span className="t5-bold select-none tabular-nums">{viewYear}년</span>
              <ActionButton
                variant="ghost"
                size="small"
                layout="iconOnly"
                aria-label="다음 연도"
                onClick={() => setViewYear((y) => y + 1)}
              >
                <Icon svg={<IconChevronRightLine />} />
              </ActionButton>
            </div>
            <div className="grid grid-cols-3 gap-x2">
              {MONTH_LABELS.map((monthLabel, i) => {
                const month = i + 1
                const isSelected = viewYear === selectedYear && month === selectedMonth
                return (
                  <ActionButton
                    key={month}
                    size="small"
                    variant={isSelected ? 'brandSolid' : 'neutralWeak'}
                    onClick={() => {
                      onChange(`${viewYear}-${String(month).padStart(2, '0')}`)
                      setOpen(false)
                    }}
                  >
                    {monthLabel}
                  </ActionButton>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </DialogRoot>
    </>
  )
}
