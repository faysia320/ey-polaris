/*
 * 시간 선택 필드.
 *
 * 네이티브 `<input type="time">`을 쓰지 않는다 — SEED text-input의 스타일이 Chrome의
 * `::-webkit-calendar-picker-indicator` 박스를 입력 전체 크기로 늘려버려, 시계 아이콘을
 * 눌러도 피커가 열리지 않고 포커스만 들어간다.
 *
 * DateField와 같은 뼈대(FieldButton + Dialog)에 SEED TimePicker를 담았다.
 * 휠은 스크롤이 멎을 때마다 값을 확정하므로, 그때마다 닫지 않고 '확인'으로 닫는다.
 */
import { useState } from 'react'
import { IconClockLine } from '@karrotmarket/react-monochrome-icon'
import { Box, ResponsivePair, TimePicker } from '@seed-design/react'
import { ActionButton } from 'seed-design/ui/action-button'
import { DialogContent, DialogFooter, DialogRoot } from 'seed-design/ui/dialog'
import {
  FieldButton,
  FieldButtonPlaceholder,
  FieldButtonValue,
} from 'seed-design/ui/field-button'

import { fromClockTime, formatTimeLabel, toClockTime, type ClockTime } from '@/lib/format'

/** 값이 없을 때 휠이 처음 가리킬 시각 */
const DEFAULT_TIME: ClockTime = { hour: 12, minute: 0 }

interface TimeFieldProps {
  label?: string
  /** 'HH:MM' 또는 'HH:MM:SS'. 빈 문자열('')은 미선택 상태 */
  value: string
  onChange: (next: string) => void
  placeholder?: string
  /** true면 선택 해제 버튼 표시 (해제 시 onChange('')) */
  clearable?: boolean
}

export function TimeField({
  label,
  value,
  onChange,
  placeholder = '시간 선택',
  clearable = false,
}: TimeFieldProps) {
  const [open, setOpen] = useState(false)
  // 휠이 굴러가는 동안의 임시 값 — 확인을 눌러야 폼에 반영한다.
  // 열 때 현재 값으로 되돌리는 일은 effect가 아니라 열기 핸들러에서 한다
  // (effect에서 setState하면 연쇄 렌더가 된다)
  const [draft, setDraft] = useState<ClockTime>(() => toClockTime(value) ?? DEFAULT_TIME)

  const openPicker = () => {
    setDraft(toClockTime(value) ?? DEFAULT_TIME)
    setOpen(true)
  }

  const displayValue = formatTimeLabel(value)

  return (
    <>
      <FieldButton
        label={label}
        size="responsive"
        prefixIcon={<IconClockLine />}
        showClearButton={clearable && value !== ''}
        values={[value]}
        onValuesChange={([v]) => onChange(v ?? '')}
        buttonProps={{
          onClick: openPicker,
          'aria-label': displayValue
            ? `${label ?? '시간'} 변경. 현재 ${displayValue}`
            : (label ?? placeholder),
        }}
      >
        {displayValue ? (
          <FieldButtonValue>{displayValue}</FieldButtonValue>
        ) : (
          <FieldButtonPlaceholder>{placeholder}</FieldButtonPlaceholder>
        )}
      </FieldButton>

      {/* 피커는 폼(사이드 패널) 위에 겹쳐 뜬다 — DateField와 같은 폭으로 맞춘다 */}
      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent title={label ?? '시간 선택'} showCloseButton maxWidth="390px">
          <Box width="100%" padding="x4">
            {/* minuteStep 기본값은 5분 — 엑셀에서 올라온 분 단위 시각을 그대로 고를 수 있게 1로 둔다 */}
            <TimePicker minuteStep={1} value={draft} onValueChange={setDraft} />
          </Box>
          <DialogFooter>
            {/* SEED 푸터는 flex-column 컨테이너일 뿐이라 배치는 호출부가 짠다.
                ResponsivePair는 넓으면 가로, 좁으면 세로로 접히고 wrap-reverse라
                접힐 때 주요 액션(뒤에 쓴 것)이 위로 온다 */}
            <ResponsivePair gap="x2">
              <ActionButton variant="neutralWeak" onClick={() => setOpen(false)}>
                취소
              </ActionButton>
              <ActionButton
                variant="neutralSolid"
                onClick={() => {
                  onChange(fromClockTime(draft))
                  setOpen(false)
                }}
              >
                확인
              </ActionButton>
            </ResponsivePair>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  )
}
