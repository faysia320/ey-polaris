import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">예산 설정</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeMonth(-1)}>
            <ChevronLeft />
          </Button>
          <span className="w-24 text-center font-medium tabular-nums">{month}</span>
          <Button variant="outline" size="icon" onClick={() => changeMonth(1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleCopyClick}>
          <Copy />
          전월 복사
        </Button>
      </div>

      <Card className="border-yellow-300/30">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">{month} 총 예산</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{formatKRW(total)}</p>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>지출 대분류</TableHead>
              <TableHead className="hidden sm:table-cell">현재 예산</TableHead>
              <TableHead className="w-32 sm:w-64">변경 금액 (원)</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenseMajors.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
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
                    <span className="block text-xs text-muted-foreground sm:hidden">
                      {budget ? formatKRW(budget.amount) : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {budget ? formatKRW(budget.amount) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder={budget ? formatNumber(budget.amount) : '예산 입력'}
                        // 내부 draft는 순수 숫자 문자열로 유지하고 표시값에만 콤마를 적용
                        value={drafts[major] ? formatNumber(Number(drafts[major])) : ''}
                        onChange={(e) =>
                          setDrafts({ ...drafts, [major]: e.target.value.replace(/[^\d]/g, '') })
                        }
                      />
                      <div className="flex flex-wrap gap-1">
                        {QUICK_AMOUNTS.map((q) => (
                          <Button
                            key={q.value}
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => addAmount(major, q.value)}
                          >
                            {q.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!drafts[major]}
                        onClick={() => saveRow(major)}
                      >
                        저장
                      </Button>
                      {budget && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() =>
                            remove(budget.id).catch((e: Error) => setError(e.message))
                          }
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>전월 예산 복사</DialogTitle>
            <DialogDescription>
              {month}의 기존 예산을 모두 삭제하고 {prevMonth} 예산으로 덮어씁니다. 계속할까요?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              취소
            </Button>
            <Button onClick={confirmCopy}>덮어쓰기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
