import { useEffect, useMemo, useState } from 'react'
import {
  IconChevronLeftLine,
  IconChevronRightLine,
  IconSquare2StackedLine,
  IconTrashcanLine,
} from '@karrotmarket/react-monochrome-icon'
import { Icon, PrefixIcon, ResponsivePair } from '@seed-design/react'
import { ActionButton } from 'seed-design/ui/action-button'
import {
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'seed-design/ui/alert-dialog'
import { TextField, TextFieldInput } from 'seed-design/ui/text-field'

import { Surface } from '@/components/ui/Surface'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { addMonths, formatKRW, formatNumber } from '@/lib/format'
import { useBudgetStore } from '@/stores/budgets'
import { useMasterDataStore } from '@/stores/masterData'

// 빠른 입력 버튼 — 클릭 시 현재 입력값에 누적 가산
const QUICK_AMOUNTS = [
  { label: '+100만원', value: 1_000_000 },
  { label: '+10만원', value: 100_000 },
  { label: '+5만원', value: 50_000 },
]

export function BudgetsPage() {
  const { month, items, fetch, save, remove, copyFromPrevMonth } = useBudgetStore()
  const { categories, loaded, fetchAll } = useMasterDataStore()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const prevMonth = addMonths(month, -1)

  useEffect(() => {
    fetch().catch((e: Error) => setError(e.message))
    if (!loaded) fetchAll().catch((e: Error) => setError(e.message))
  }, [fetch, fetchAll, loaded])

  // 예산은 지출 대분류 단위 — 소분류 행을 펼치지 않고 고유 대분류만 나열.
  // 대분류 이름이 바뀌어 카테고리에 없는 옛 이름 예산도 행에 남겨 수정·삭제할 수 있게 한다
  const expenseMajors = useMemo(() => {
    const majors = new Set(categories.filter((c) => c.kind === 'expense').map((c) => c.major))
    for (const b of items) majors.add(b.major)
    return [...majors]
  }, [categories, items])
  const budgetByMajor = useMemo(
    () => new Map(items.map((b) => [b.major, b])),
    [items],
  )
  const total = items.reduce((sum, b) => sum + b.amount, 0)

  const changeMonth = (delta: number) => {
    setDrafts({})
    fetch(addMonths(month, delta)).catch((e: Error) => setError(e.message))
  }

  // 빠른 입력 — 현재 입력값(없으면 0)에 delta를 누적 가산
  const addAmount = (major: string, delta: number) => {
    setDrafts((d) => {
      const current = Number(d[major] ?? '') || 0
      return { ...d, [major]: String(current + delta) }
    })
  }

  const runCopy = async () => {
    setError(null)
    setDrafts({})
    try {
      await copyFromPrevMonth()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleCopyClick = () => {
    // 당월에 기존 예산이 있으면 덮어쓰기 전에 확인, 없으면 바로 복사
    if (items.length > 0) {
      setConfirmOpen(true)
    } else {
      runCopy()
    }
  }

  const confirmCopy = () => {
    setConfirmOpen(false)
    runCopy()
  }

  const saveRow = async (major: string) => {
    const raw = drafts[major]
    if (raw === undefined || raw === '') return
    const amount = Number(raw)
    if (!Number.isInteger(amount) || amount <= 0) {
      setError('예산은 1원 이상의 정수여야 합니다')
      return
    }
    setError(null)
    try {
      await save(major, amount)
      setDrafts((d) => {
        const next = { ...d }
        delete next[major]
        return next
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-x6">
      <div className="flex items-center justify-between">
        <h1 className="screen-title">예산 설정</h1>
        <div className="flex items-center gap-x2">
          <ActionButton
            variant="neutralOutline"
            size="small"
            layout="iconOnly"
            aria-label="이전 달"
            onClick={() => changeMonth(-1)}
          >
            <Icon svg={<IconChevronLeftLine />} />
          </ActionButton>
          <span className="t4-medium w-24 shrink-0 whitespace-nowrap text-center tabular-nums">{month}</span>
          <ActionButton
            variant="neutralOutline"
            size="small"
            layout="iconOnly"
            aria-label="다음 달"
            onClick={() => changeMonth(1)}
          >
            <Icon svg={<IconChevronRightLine />} />
          </ActionButton>
        </div>
      </div>

      <div className="flex justify-end">
        <ActionButton variant="neutralOutline" size="small" onClick={handleCopyClick}>
          <PrefixIcon svg={<IconSquare2StackedLine />} />
          전월 복사
        </ActionButton>
      </div>

      <Surface className="flex flex-col gap-x2 border-stroke-brand-weak">
        <p className="t4-medium text-fg-neutral-muted">{month} 총 예산</p>
        <p className="t9-bold">{formatKRW(total)}</p>
      </Surface>

      {error && <p className="t4-regular text-fg-critical">{error}</p>}

      <div className="rounded-r2 border border-stroke-neutral-weak">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>지출 대분류</TableHead>
              <TableHead className="hidden sm:table-cell">현재 예산</TableHead>
              {/* 빠른 입력 버튼이 두 줄로 접히지 않도록 컬럼을 넉넉히 잡는다 */}
              <TableHead className="w-40 sm:w-72">변경 금액 (원)</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenseMajors.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-x10 text-center text-fg-neutral-muted">
                  지출 카테고리가 없습니다. 기준정보 관리에서 먼저 추가해주세요.
                </TableCell>
              </TableRow>
            )}
            {expenseMajors.map((major) => {
              const budget = budgetByMajor.get(major)
              return (
                <TableRow key={major}>
                  <TableCell>
                    {major}
                    {/* 모바일에서는 '현재 예산' 컬럼을 숨기고 보조 줄로 표시 */}
                    <span className="t2-regular block text-fg-neutral-muted sm:hidden">
                      {budget ? formatKRW(budget.amount) : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {budget ? formatKRW(budget.amount) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-x1">
                      <TextField size="responsive"
                        aria-label={`${major} 예산 입력`}
                        // 내부 draft는 순수 숫자 문자열로 유지하고 표시값에만 콤마를 적용
                        value={drafts[major] ? formatNumber(Number(drafts[major])) : ''}
                        onValueChange={({ value }) =>
                          setDrafts({ ...drafts, [major]: value.replace(/[^\d]/g, '') })
                        }
                        suffix="원"
                      >
                        <TextFieldInput
                          type="text"
                          inputMode="numeric"
                          aria-label={`${major} 예산 입력`}
                          placeholder={budget ? formatNumber(budget.amount) : '예산 입력'}
                        />
                      </TextField>
                      <div className="flex flex-wrap gap-x1">
                        {QUICK_AMOUNTS.map((q) => (
                          <ActionButton
                            key={q.value}
                            type="button"
                            size="xsmall"
                            variant="neutralOutline"
                            onClick={() => addAmount(major, q.value)}
                          >
                            {q.label}
                          </ActionButton>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-x2">
                      <ActionButton
                        size="small"
                        variant="neutralWeak"
                        disabled={!drafts[major]}
                        onClick={() => saveRow(major)}
                      >
                        저장
                      </ActionButton>
                      {budget && (
                        <ActionButton
                          size="small"
                          variant="ghost"
                          color="fg.critical"
                          layout="iconOnly"
                          aria-label={`${major} 예산 삭제`}
                          onClick={() =>
                            remove(budget.id).catch((e: Error) => setError(e.message))
                          }
                        >
                          <Icon svg={<IconTrashcanLine />} />
                        </ActionButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* 되돌릴 수 없는 덮어쓰기라 Dialog가 아니라 AlertDialog를 쓴다 */}
      <AlertDialogRoot open={confirmOpen} onOpenChange={(open) => setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>전월 예산 복사</AlertDialogTitle>
            <AlertDialogDescription>
              {month}의 기존 예산을 모두 삭제하고 {prevMonth} 예산으로 덮어씁니다. 계속할까요?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <ResponsivePair gap="x2">
              <AlertDialogAction variant="neutralWeak" onClick={() => setConfirmOpen(false)}>
                취소
              </AlertDialogAction>
              <AlertDialogAction variant="criticalSolid" onClick={confirmCopy}>
                덮어쓰기
              </AlertDialogAction>
            </ResponsivePair>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
    </div>
  )
}
