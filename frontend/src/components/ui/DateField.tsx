/*
 * 날짜 선택 필드.
 *
 * SEED의 DatePicker는 인라인 달력이라 트리거가 없다. SEED가 권장하는 조합인
 * FieldButton(피커를 여는 입력 필드형 버튼) + 달력을 담은 Dialog로 구성한다.
 *
 * 값은 앱 전역과 동일하게 'YYYY-MM-DD' 문자열로 주고받고, SEED가 쓰는
 * `{ year, month, day }`로의 변환은 이 컴포넌트 경계에서만 일어난다.
 */
import { useState } from 'react'
import { IconCalendarLine } from '@karrotmarket/react-monochrome-icon'
import { Box, DatePicker, dateOnOrBefore } from '@seed-design/react'
import { DialogContent, DialogRoot } from 'seed-design/ui/dialog'
import {
  FieldButton,
  FieldButtonPlaceholder,
  FieldButtonValue,
} from 'seed-design/ui/field-button'

import { formatDateLabel, fromCalendarDate, toCalendarDate, todayISO } from '@/lib/format'

interface DateFieldProps {
  label?: string
  /** 'YYYY-MM-DD' 문자열. 빈 문자열('')은 미선택 상태 */
  value: string
  onChange: (next: string) => void
  placeholder?: string
  /** true면 선택 해제 버튼 표시 (해제 시 onChange('')) */
  clearable?: boolean
  /** true면 오늘 이후 날짜 선택 비활성 */
  disableFuture?: boolean
  invalid?: boolean
  errorMessage?: string
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = '날짜 선택',
  clearable = false,
  disableFuture = false,
  invalid,
  errorMessage,
}: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const today = toCalendarDate(todayISO())!

  return (
    <>
      <FieldButton
        label={label}
        size="responsive"
        invalid={invalid}
        errorMessage={errorMessage}
        prefixIcon={<IconCalendarLine />}
        showClearButton={clearable && value !== ''}
        values={[value]}
        onValuesChange={([v]) => onChange(v ?? '')}
        buttonProps={{
          onClick: () => setOpen(true),
          'aria-label': value ? `${label ?? '날짜'} 변경. 현재 ${formatDateLabel(value)}` : (label ?? placeholder),
        }}
      >
        {value ? (
          <FieldButtonValue>{formatDateLabel(value)}</FieldButtonValue>
        ) : (
          <FieldButtonPlaceholder>{placeholder}</FieldButtonPlaceholder>
        )}
      </FieldButton>

      {/* 피커는 폼(사이드 패널) 위에 겹쳐 뜬다 — 여기까지 패널로 바꾸면 패널 안의 패널이 된다.
          maxWidth를 달력 폭에 맞춰 못박지 않으면 다이얼로그 기본 폭(480px)이 남아
          달력 오른쪽에 빈 여백이 생긴다 */}
      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent title={label ?? '날짜 선택'} showCloseButton maxWidth="390px">
          {/* DatePicker는 스스로 폭을 제한하지 않고 부모를 채운다 */}
          <Box width="100%" padding="x4">
            <DatePicker
              today={today}
              value={toCalendarDate(value)}
              defaultViewDate={toCalendarDate(value)}
              constraints={disableFuture ? [dateOnOrBefore(today)] : undefined}
              onValueChange={(d) => {
                onChange(fromCalendarDate(d))
                setOpen(false)
              }}
            />
          </Box>
        </DialogContent>
      </DialogRoot>
    </>
  )
}
