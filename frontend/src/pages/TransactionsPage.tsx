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
import { ArrowUpDown, Pencil, Plus, Trash2 } from 'lucide-react'

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
import { formatKRW, todayISO } from '@/lib/format'
import { useMasterDataStore } from '@/stores/masterData'
import { useTransactionStore } from '@/stores/transactions'
import type { Transaction, TransactionKind } from '@/types'

interface FormState {
  date: string
  kind: TransactionKind
  category_id: string
  account_id: string
  member_id: string
  amount: string
  memo: string
}

const emptyForm = (): FormState => ({
  date: todayISO(),
  kind: 'expense',
  category_id: '',
  account_id: '',
  member_id: 'none',
  amount: '',
  memo: '',
})

export function TransactionsPage() {
  const { items, filters, fetch, setFilters, create, update, remove } = useTransactionStore()
  const { categories, accounts, members, loaded, fetchAll } = useMasterDataStore()

  const [sorting, setSorting] = useState<SortingState>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  useEffect(() => {
    fetch().catch((e: Error) => setPageError(e.message))
    if (!loaded) fetchAll().catch((e: Error) => setPageError(e.message))
  }, [fetch, fetchAll, loaded])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (t: Transaction) => {
    setEditing(t)
    setForm({
      date: t.date,
      kind: t.kind,
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

  const formCategories = categories.filter((c) => c.kind === form.kind)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">지출/수입 내역</h1>
        <Button onClick={openCreate}>
          <Plus /> 거래 추가
        </Button>
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
              setFilters({ kind: v === 'all' ? null : (v as TransactionKind) }).catch(
                (err: Error) => setPageError(err.message),
              )
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
          <Label>카테고리</Label>
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
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
                <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
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
                    setForm({ ...form, kind: v as TransactionKind, category_id: '' })
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
                <Label>카테고리</Label>
                <Select
                  value={form.category_id || undefined}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {formCategories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1">
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
    </div>
  )
}
