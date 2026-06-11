import { useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Pencil,
  Plus,
  Table2,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TransactionCalendar } from '@/components/transactions/TransactionCalendar'
import { api } from '@/lib/api'
import { addMonths, categoryLabel, currentMonth, formatKRW, todayISO } from '@/lib/format'
import { useMasterDataStore } from '@/stores/masterData'
import { useTransactionStore } from '@/stores/transactions'
import type { ImportResult, Transaction, TransactionKind } from '@/types'

interface FormState {
  date: string
  kind: TransactionKind
  /** 대분류 — 소분류(category_id) 선택을 위한 중간 단계 */
  category_major: string
  category_id: string
  account_id: string
  member_id: string
  amount: string
  memo: string
}

const emptyForm = (): FormState => ({
  date: todayISO(),
  kind: 'expense',
  category_major: '',
  category_id: '',
  account_id: '',
  member_id: 'none',
  amount: '',
  memo: '',
})

export function TransactionsPage() {
  const { items, filters, fetch, setFilters, create, update, remove } = useTransactionStore()
  const { categories, accounts, members, loaded, fetchAll } = useMasterDataStore()

  const [view, setView] = useState<'table' | 'calendar'>('table')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importMonth, setImportMonth] = useState(() => addMonths(currentMonth(), -1))
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  useEffect(() => {
    fetch().catch((e: Error) => setPageError(e.message))
    if (!loaded) fetchAll().catch((e: Error) => setPageError(e.message))
  }, [fetch, fetchAll, loaded])

  // 캘린더 뷰는 항상 특정 월을 기준으로 한다 (월 필터가 비어 있으면 현재 월)
  const calendarMonth = filters.month ?? currentMonth()
  // 선택일이 표시 중인 월을 벗어나면 상세 목록을 숨긴다
  const dayTransactions =
    selectedDate && selectedDate.startsWith(calendarMonth)
      ? items.filter((t) => t.date === selectedDate)
      : null

  const switchView = (next: 'table' | 'calendar') => {
    setView(next)
    if (next === 'calendar' && !filters.month) {
      setFilters({ month: currentMonth() }).catch((e: Error) => setPageError(e.message))
    }
  }

  const moveCalendarMonth = (delta: number) => {
    setSelectedDate(null)
    setFilters({ month: addMonths(calendarMonth, delta) }).catch((e: Error) =>
      setPageError(e.message),
    )
  }

  const openCreate = () => {
    setEditing(null)
    const base = emptyForm()
    if (view === 'calendar' && selectedDate) base.date = selectedDate
    setForm(base)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (t: Transaction) => {
    setEditing(t)
    setForm({
      date: t.date,
      kind: t.kind,
      category_major: categories.find((c) => c.id === t.category_id)?.major ?? '',
      category_id: String(t.category_id),
      account_id: String(t.account_id),
      member_id: t.member_id ? String(t.member_id) : 'none',
      amount: String(t.amount),
      memo: t.memo ?? '',
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const submit = async () => {
    const amount = Number(form.amount)
    if (!form.date) return setFormError('날짜를 입력해주세요')
    if (!Number.isInteger(amount) || amount <= 0)
      return setFormError('금액은 1원 이상의 정수여야 합니다')
    if (!form.category_id) return setFormError('카테고리를 선택해주세요')
    if (!form.account_id) return setFormError('자산 계정을 선택해주세요')
    const payload = {
      date: form.date,
      kind: form.kind,
      amount,
      category_id: Number(form.category_id),
      account_id: Number(form.account_id),
      member_id: form.member_id === 'none' ? null : Number(form.member_id),
      memo: form.memo.trim() || null,
    }
    try {
      if (editing) {
        await update(editing.id, payload)
      } else {
        await create(payload)
      }
      setDialogOpen(false)
    } catch (e) {
      setFormError((e as Error).message)
    }
  }

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        accessorKey: 'date',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            날짜 <ArrowUpDown className="size-3" />
          </Button>
        ),
      },
      {
        accessorKey: 'kind',
        header: '구분',
        cell: ({ row }) => (
          <Badge variant={row.original.kind === 'income' ? 'secondary' : 'outline'}>
            {row.original.kind === 'income' ? '수입' : '지출'}
          </Badge>
        ),
      },
      { accessorKey: 'category_name', header: '카테고리' },
      {
        accessorKey: 'amount',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            금액 <ArrowUpDown className="size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span
            className={
              row.original.kind === 'income' ? 'text-emerald-400' : 'text-rose-400'
            }
          >
            {row.original.kind === 'income' ? '+' : '-'}
            {formatKRW(row.original.amount)}
          </span>
        ),
      },
      { accessorKey: 'account_name', header: '계정' },
      {
        accessorKey: 'member_name',
        header: '구성원',
        cell: ({ row }) => row.original.member_name ?? '—',
      },
      {
        accessorKey: 'memo',
        header: '메모',
        cell: ({ row }) => row.original.memo ?? '',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row.original)}>
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                remove(row.original.id).catch((e: Error) => setPageError(e.message))
              }
            >
              <Trash2 className="text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [remove],
  )

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  })

  // 거래 폼용 — 구분에 맞는 대분류 목록과, 선택된 대분류의 소분류 목록
  const formMajors = [
    ...new Set(categories.filter((c) => c.kind === form.kind).map((c) => c.major)),
  ]
  const formMinors = categories.filter(
    (c) => c.kind === form.kind && c.major === form.category_major,
  )
  // 필터용 — 구분 필터가 있으면 해당 구분의 대분류만
  const filterMajors = [
    ...new Set(
      categories.filter((c) => !filters.kind || c.kind === filters.kind).map((c) => c.major),
    ),
  ]
  const filterMinors = categories.filter(
    (c) => c.major === filters.major && (!filters.kind || c.kind === filters.kind),
  )

  const runImport = async () => {
    if (!importFile) return setImportError('업로드할 .xlsx 파일을 선택해주세요')
    if (!importMonth) return setImportError('가져올 월을 선택해주세요')
    setImporting(true)
    setImportError(null)
    try {
      const body = new FormData()
      body.append('file', importFile)
      body.append('month', importMonth)
      const result = await api.upload<ImportResult>('/transactions/import', body)
      setImportResult(result)
      // 새 카테고리/계정이 생겼을 수 있으니 기준정보까지 재조회
      await Promise.all([fetch(), fetchAll()])
    } catch (e) {
      setImportError((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const openImport = () => {
    setImportFile(null)
    setImportMonth(addMonths(currentMonth(), -1))
    setImportError(null)
    setImportResult(null)
    setImportOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">지출/수입 내역</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => switchView('table')}
            >
              <Table2 /> 테이블
            </Button>
            <Button
              variant={view === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => switchView('calendar')}
            >
              <CalendarDays /> 캘린더
            </Button>
          </div>
          <Button variant="outline" onClick={openImport}>
            <FileUp /> 엑셀 업로드
          </Button>
          <Button onClick={openCreate}>
            <Plus /> 거래 추가
          </Button>
        </div>
      </div>

      {pageError && <p className="text-sm text-destructive">{pageError}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="filter-month">조회 월</Label>
          <Input
            id="filter-month"
            type="month"
            className="w-40"
            value={filters.month ?? ''}
            onChange={(e) =>
              setFilters({ month: e.target.value || null }).catch((err: Error) =>
                setPageError(err.message),
              )
            }
          />
        </div>
        <div className="space-y-1">
          <Label>구분</Label>
          <Select
            value={filters.kind ?? 'all'}
            onValueChange={(v) =>
              // 구분이 바뀌면 다른 구분의 카테고리 필터는 의미가 없으므로 함께 초기화
              setFilters({
                kind: v === 'all' ? null : (v as TransactionKind),
                major: null,
                category_id: null,
              }).catch((err: Error) => setPageError(err.message))
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="income">수입</SelectItem>
              <SelectItem value="expense">지출</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>대분류</Label>
          <Select
            value={filters.major ?? 'all'}
            onValueChange={(v) =>
              setFilters({ major: v === 'all' ? null : v, category_id: null }).catch(
                (err: Error) => setPageError(err.message),
              )
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {filterMajors.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filters.major && (
          <div className="space-y-1">
            <Label>소분류</Label>
            <Select
              value={filters.category_id ? String(filters.category_id) : 'all'}
              onValueChange={(v) =>
                setFilters({ category_id: v === 'all' ? null : Number(v) }).catch(
                  (err: Error) => setPageError(err.message),
                )
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {filterMinors.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.minor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {view === 'table' ? (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="py-10 text-center text-muted-foreground"
                    >
                      조건에 맞는 거래가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">
              {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}{' '}
              페이지
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              다음
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={() => moveCalendarMonth(-1)}>
              <ChevronLeft />
            </Button>
            <span className="w-24 text-center font-medium tabular-nums">{calendarMonth}</span>
            <Button variant="outline" size="icon" onClick={() => moveCalendarMonth(1)}>
              <ChevronRight />
            </Button>
          </div>
          {(filters.kind || filters.major || filters.category_id) && (
            <p className="text-center text-xs text-muted-foreground">
              {[
                filters.kind && (filters.kind === 'income' ? '수입' : '지출'),
                filters.category_id
                  ? (() => {
                      const c = categories.find((cat) => cat.id === filters.category_id)
                      return c ? categoryLabel(c) : '카테고리'
                    })()
                  : filters.major,
              ]
                .filter(Boolean)
                .join(' · ')}{' '}
              필터가 적용된 거래만 합산하고 있어요
            </p>
          )}
          <TransactionCalendar
            month={calendarMonth}
            transactions={items}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          {dayTransactions && (
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm font-medium">{selectedDate} 거래</p>
              {dayTransactions.length === 0 && (
                <p className="text-sm text-muted-foreground">이 날의 거래가 없습니다.</p>
              )}
              {dayTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={t.kind === 'income' ? 'secondary' : 'outline'}>
                      {t.kind === 'income' ? '수입' : '지출'}
                    </Badge>
                    <span>{t.category_name}</span>
                    <span className="text-xs text-muted-foreground">{t.account_name}</span>
                    {t.memo && <span className="text-xs text-muted-foreground">{t.memo}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={t.kind === 'income' ? 'text-emerald-400' : 'text-rose-400'}>
                      {t.kind === 'income' ? '+' : '-'}
                      {formatKRW(t.amount)}
                    </span>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(t.id).catch((e: Error) => setPageError(e.message))}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '거래 수정' : '거래 추가'}</DialogTitle>
            <DialogDescription>
              {editing ? '거래 내용을 수정합니다.' : '새 지출/수입 거래를 기록합니다.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="tx-date">날짜</Label>
                <Input
                  id="tx-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>구분</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      kind: v as TransactionKind,
                      category_major: '',
                      category_id: '',
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">지출</SelectItem>
                    <SelectItem value="income">수입</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tx-amount">금액 (원)</Label>
              <Input
                id="tx-amount"
                type="number"
                min={1}
                placeholder="예: 15000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>대분류</Label>
                <Select
                  value={form.category_major || undefined}
                  onValueChange={(v) => setForm({ ...form, category_major: v, category_id: '' })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {formMajors.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>소분류</Label>
                <Select
                  value={form.category_id || undefined}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={form.category_major ? '선택' : '대분류 먼저'} />
                  </SelectTrigger>
                  <SelectContent>
                    {formMinors.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.minor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>자산 계정</Label>
                <Select
                  value={form.account_id || undefined}
                  onValueChange={(v) => setForm({ ...form, account_id: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.is_active)
                      .map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>구성원</Label>
                <Select
                  value={form.member_id}
                  onValueChange={(v) => setForm({ ...form, member_id: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">선택 안 함</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="tx-memo">메모</Label>
                <Input
                  id="tx-memo"
                  placeholder="선택 입력"
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                />
              </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={submit}>{editing ? '수정' : '추가'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>엑셀 업로드</DialogTitle>
            <DialogDescription>
              뱅크샐러드 내보내기 파일의 "가계부 내역"에서 선택한 달만 가져옵니다.
            </DialogDescription>
          </DialogHeader>
          {importResult ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">{importResult.month}</span> 가져오기 완료 — 등록{' '}
                {importResult.created_count}건
                {importResult.deleted_count > 0 && ` (기존 ${importResult.deleted_count}건 교체)`}
                {importResult.skipped.length > 0 && `, 건너뜀 ${importResult.skipped.length}건`}
              </p>
              {importResult.created_categories.length > 0 && (
                <p className="text-muted-foreground">
                  새 카테고리: {importResult.created_categories.join(', ')}
                </p>
              )}
              {importResult.created_accounts.length > 0 && (
                <p className="text-muted-foreground">
                  새 자산 계정: {importResult.created_accounts.join(', ')}
                </p>
              )}
              {importResult.skipped.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {importResult.skipped.map((s) => (
                    <p key={s.row} className="text-xs text-muted-foreground">
                      {s.row}행: {s.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="import-file">엑셀 파일 (.xlsx)</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="import-month">가져올 월</Label>
                <Input
                  id="import-month"
                  type="month"
                  className="w-40"
                  value={importMonth}
                  onChange={(e) => setImportMonth(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                해당 월에 이전에 업로드한 내역이 있으면 삭제 후 다시 등록돼요. 직접 입력한
                거래는 그대로 유지됩니다.
              </p>
              {importError && <p className="text-sm text-destructive">{importError}</p>}
            </div>
          )}
          <DialogFooter>
            {importResult ? (
              <Button onClick={() => setImportOpen(false)}>닫기</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setImportOpen(false)}>
                  취소
                </Button>
                <Button onClick={runImport} disabled={importing}>
                  {importing ? '업로드 중…' : '업로드'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
