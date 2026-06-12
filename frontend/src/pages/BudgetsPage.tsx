import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { addMonths, formatKRW } from '@/lib/format'
import { useBudgetStore } from '@/stores/budgets'
import { useMasterDataStore } from '@/stores/masterData'

export function BudgetsPage() {
  const { month, items, fetch, save, remove } = useBudgetStore()
  const { categories, loaded, fetchAll } = useMasterDataStore()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

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
              <TableHead>지출 카테고리</TableHead>
              <TableHead>현재 예산</TableHead>
              <TableHead className="w-64">변경 금액 (원)</TableHead>
              <TableHead className="w-32"></TableHead>
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
                  <TableCell>{major}</TableCell>
                  <TableCell>{budget ? formatKRW(budget.amount) : '—'}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      placeholder={budget ? String(budget.amount) : '예산 입력'}
                      value={drafts[major] ?? ''}
                      onChange={(e) => setDrafts({ ...drafts, [major]: e.target.value })}
                    />
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
    </div>
  )
}
