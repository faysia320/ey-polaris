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
  Eye,
  FileUp,
  Link2,
  Pencil,
  Plus,
  Table2,
  Trash2,
  Unlink,
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
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MonthPicker } from '@/components/ui/month-picker'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { MemberFilterSelect } from '@/components/members/MemberFilterSelect'
import { TransactionCalendar } from '@/components/transactions/TransactionCalendar'
import { api } from '@/lib/api'
import { addMonths, categoryLabel, currentMonth, formatKRW, formatNumber, KIND_LABEL, todayISO } from '@/lib/format'
import { cn, touchTarget } from '@/lib/utils'
import { useMasterDataStore } from '@/stores/masterData'
import { useMemberFilterStore } from '@/stores/memberFilter'
import { useTransactionStore } from '@/stores/transactions'
import type {
  ImportAction,
  ImportPreview,
  ImportResult,
  LinkType,
  Transaction,
  TransactionKind,
} from '@/types'

interface FormState {
  date: string
  /** 거래 시각 "HH:MM" — 미입력이면 빈 문자열 */
  time: string
  kind: TransactionKind
  /** 대분류 — 소분류(category_id) 선택을 위한 중간 단계 */
  category_major: string
  category_id: string
  account_id: string
  /** 이체 전용 — 입금 계정 (account_id가 출금 계정) */
  counter_account_id: string
  member_id: string
  amount: string
  memo: string
}

const emptyForm = (): FormState => ({
  date: todayISO(),
  time: '',
  kind: 'expense',
  category_major: '',
  category_id: '',
  account_id: '',
  counter_account_id: '',
  member_id: 'none',
  amount: '',
  memo: '',
})

/** 구분별 배지 색 — 금액 텍스트와 같은 의미색(수입=녹/지출=적/이체=청)의 은은한 틴트.
 *  다크 전용 테마라 반투명 배경 + 밝은 동일 계열 글자로 다크 배경에서 가독성을 확보한다. */
const KIND_BADGE_CLASS: Record<TransactionKind, string> = {
  income: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  expense: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  transfer: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
}

/** 엑셀 평가액 반영 시 자산 유형 라벨 — 주식은 총합 직접 입력이라 엑셀 반영 대상이 아니다 */
const VALUATION_TYPE_LABEL: Record<'real_estate', string> = {
  real_estate: '부동산',
}

/** 사후 묶음 유형 라벨 — transfer(계좌 간 이체) | refund(카드 결제+환불) */
const LINK_LABEL: Record<LinkType, string> = {
  transfer: '이체 묶음',
  refund: '환불 묶음',
}
/** 묶음 배지 — 이체 색(청)과 구분되도록 보라 계열의 은은한 틴트 */
const LINK_BADGE_CLASS = 'gap-1 bg-violet-500/15 text-violet-300 border-violet-500/25'

/** 거래 시각 표시 — "HH:MM:SS"/"HH:MM"을 "HH:MM"으로 축약 */
const formatTime = (time: string) => time.slice(0, 5)

const kindAmountClass = (kind: TransactionKind) =>
  kind === 'income' ? 'text-emerald-400' : kind === 'expense' ? 'text-rose-400' : 'text-sky-400'

const kindAmountSign = (kind: TransactionKind) =>
  kind === 'income' ? '+' : kind === 'expense' ? '-' : ''

/** 묶인 거래(병합 행으로 표시)인지 — 링크 정보와 짝 요약이 모두 있을 때만 병합할 수 있다 */
const isBundle = (t: Transaction) =>
  t.link_id != null && t.link_type != null && t.linked_partner != null

/** 병합 행/묶음 보기가 쓰는 한 다리 요약 (앵커 자신 또는 짝) */
interface BundleLeg {
  amount: number
  date: string
  time: string | null
  account_name: string
  category_name: string
  memo: string | null
}

/** 묶음 앵커 거래에서 지출/수입 두 다리를 뽑는다 (앵커가 어느 쪽이든 결과는 동일) */
const bundleLegs = (t: Transaction): { expense: BundleLeg; income: BundleLeg } => {
  const partner = t.linked_partner!
  const self: BundleLeg = {
    amount: t.amount,
    date: t.date,
    time: t.time,
    account_name: t.account_name,
    category_name: t.category_name,
    memo: t.memo,
  }
  const other: BundleLeg = {
    amount: partner.amount,
    date: partner.date,
    time: partner.time,
    account_name: partner.account_name,
    category_name: partner.category_name,
    memo: partner.memo,
  }
  return t.kind === 'expense' ? { expense: self, income: other } : { expense: other, income: self }
}

/** 병합 행의 표시값 — 이체 묶음: 출금→입금·거래 금액(청), 환불 묶음: 순지출(적) */
const bundleDisplay = (t: Transaction) => {
  const { expense, income } = bundleLegs(t)
  if (t.link_type === 'transfer') {
    return {
      kind: 'transfer' as TransactionKind,
      amount: expense.amount,
      accountText: `${expense.account_name} → ${income.account_name}`,
      category_name: expense.category_name,
    }
  }
  return {
    kind: 'expense' as TransactionKind,
    amount: Math.max(expense.amount - income.amount, 0),
    accountText: expense.account_name,
    category_name: expense.category_name,
  }
}

export function TransactionsPage() {
  const { items, filters, fetch, setFilters, create, update, remove, removeMonth, link, unlink } =
    useTransactionStore()
  const { categories, accounts, members, loaded, fetchAll } = useMasterDataStore()
  const memberId = useMemberFilterStore((s) => s.memberId)

  const [view, setView] = useState<'table' | 'calendar'>('table')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  // 월 일괄 삭제 — 파괴적 동작이라 확인 단계를 반드시 거친다
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  // 실패 시 다이얼로그가 열린 채 남으므로 에러도 다이얼로그 안에 띄운다
  // (pageError는 오버레이 뒤에 가려져 보이지 않는다)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)
  // 삭제 완료처럼 오류가 아닌 안내 (pageError는 destructive 색이라 성공에 쓰지 않는다)
  const [pageNotice, setPageNotice] = useState<string | null>(null)

  // 거래 묶기 — 수정 모달의 "묶음" 버튼에서 진입하는 연결 대상 선택 다이얼로그.
  // linkSource: 수정 중이던(묶을 기준) 거래, linkTarget: 목록에서 고른 상대 거래
  const [linkPickerOpen, setLinkPickerOpen] = useState(false)
  const [linkSource, setLinkSource] = useState<Transaction | null>(null)
  const [linkTarget, setLinkTarget] = useState<Transaction | null>(null)
  const [linkType, setLinkType] = useState<LinkType>('transfer')
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  // 묶음 보기 — 병합 행에서 두 다리 상세를 확인하고 해제하는 다이얼로그
  const [viewOpen, setViewOpen] = useState(false)
  const [viewTx, setViewTx] = useState<Transaction | null>(null)
  const [viewError, setViewError] = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importMonth, setImportMonth] = useState(() => addMonths(currentMonth(), -1))
  const [importMemberId, setImportMemberId] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  // 이체 검토 단계 — 미리보기 결과와 행별 결정 (행번호 → 결정)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [reviewDecisions, setReviewDecisions] = useState<
    Record<number, { action: ImportAction; counter_account_id: string }>
  >({})

  // 전역 구성원 필터를 거래 필터에 동기화 — 마운트 시 조회를 겸한다 (setFilters가 fetch 포함)
  useEffect(() => {
    setFilters({ member_id: memberId }).catch((e: Error) => setPageError(e.message))
  }, [memberId, setFilters])

  useEffect(() => {
    if (!loaded) fetchAll().catch((e: Error) => setPageError(e.message))
  }, [fetchAll, loaded])

  // 삭제 안내는 그 조회 조건에 대한 것이므로, 조건이 바뀌면 더는 유효하지 않다.
  useEffect(() => {
    setPageNotice(null)
  }, [filters.month, filters.kind, filters.major, filters.category_id, filters.member_id])

  // 캘린더 뷰는 항상 특정 월을 기준으로 한다 (월 필터가 비어 있으면 현재 월)
  const calendarMonth = filters.month ?? currentMonth()

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
      time: t.time ?? '',
      kind: t.kind,
      category_major: categories.find((c) => c.id === t.category_id)?.major ?? '',
      category_id: String(t.category_id),
      account_id: String(t.account_id),
      counter_account_id: t.counter_account_id ? String(t.counter_account_id) : '',
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
    if (!form.account_id)
      return setFormError(form.kind === 'transfer' ? '출금 계정을 선택해주세요' : '자산 계정을 선택해주세요')
    if (form.kind === 'transfer') {
      if (!form.counter_account_id) return setFormError('입금 계정을 선택해주세요')
      if (form.counter_account_id === form.account_id)
        return setFormError('출금 계정과 입금 계정은 서로 달라야 합니다')
    }
    const payload = {
      date: form.date,
      time: form.time || null,
      kind: form.kind,
      amount,
      category_id: Number(form.category_id),
      account_id: Number(form.account_id),
      counter_account_id:
        form.kind === 'transfer' ? Number(form.counter_account_id) : null,
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

  // 병합 표시 행 — 묶인 두 다리를 한 행으로 합친다. link_id당 1행만 노출하며,
  // 양다리가 모두 로드됐으면 지출 leg를, 한쪽만 로드됐으면 그 leg를 앵커로 삼는다.
  const displayRows = useMemo(() => {
    const legsByLink = new Map<number, Transaction[]>()
    for (const t of items) {
      if (t.link_id != null) {
        const arr = legsByLink.get(t.link_id)
        if (arr) arr.push(t)
        else legsByLink.set(t.link_id, [t])
      }
    }
    const anchorByLink = new Map<number, number>()
    for (const [linkId, legs] of legsByLink) {
      const expense = legs.find((l) => l.kind === 'expense')
      anchorByLink.set(linkId, (expense ?? legs[0]).id)
    }
    const rows: Transaction[] = []
    const emitted = new Set<number>()
    for (const t of items) {
      if (t.link_id == null) {
        rows.push(t)
        continue
      }
      if (emitted.has(t.link_id)) continue
      if (anchorByLink.get(t.link_id) !== t.id) continue
      rows.push(t)
      emitted.add(t.link_id)
    }
    return rows
  }, [items])

  // 캘린더 일별 상세도 병합 표시 행을 공유한다 (선택일이 표시 월을 벗어나면 숨김).
  // 병합 행의 앵커 날짜(지출 leg)를 기준으로 그 날짜 칸에 한 건으로 나타난다.
  const dayRows =
    selectedDate && selectedDate.startsWith(calendarMonth)
      ? displayRows.filter((t) => t.date === selectedDate)
      : null

  // 묶음 보기 진입 — columns 정의보다 앞서야 셀에서 참조할 수 있다
  const openView = (t: Transaction) => {
    setViewTx(t)
    setViewError(null)
    setViewOpen(true)
  }

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        id: 'date',
        accessorFn: (t) => t.date,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            날짜 <ArrowUpDown className="size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col whitespace-nowrap tabular-nums">
            <span>{row.original.date}</span>
            {row.original.time && (
              <span className="text-xs text-muted-foreground">
                {formatTime(row.original.time)}
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'kind',
        header: '구분',
        cell: ({ row }) => {
          const kind = isBundle(row.original) ? bundleDisplay(row.original).kind : row.original.kind
          return (
            <Badge variant="outline" className={KIND_BADGE_CLASS[kind]}>
              {KIND_LABEL[kind]}
            </Badge>
          )
        },
      },
      {
        id: 'category',
        header: '카테고리',
        cell: ({ row }) => {
          const t = row.original
          const category = isBundle(t) ? bundleDisplay(t).category_name : t.category_name
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <span>{category}</span>
              {t.link_type && (
                <Badge variant="outline" className={LINK_BADGE_CLASS}>
                  <Link2 className="size-3" />
                  {LINK_LABEL[t.link_type]}
                </Badge>
              )}
            </div>
          )
        },
      },
      {
        id: 'amount',
        accessorFn: (t) => (isBundle(t) ? bundleDisplay(t).amount : t.amount),
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-end"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            금액 <ArrowUpDown className="size-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const t = row.original
          const { kind, amount } = isBundle(t)
            ? bundleDisplay(t)
            : { kind: t.kind, amount: t.amount }
          return (
            <span className={`block text-right tabular-nums ${kindAmountClass(kind)}`}>
              {kindAmountSign(kind)}
              {formatNumber(amount)}
            </span>
          )
        },
      },
      {
        id: 'account',
        header: '계정',
        cell: ({ row }) => {
          const t = row.original
          if (isBundle(t)) return bundleDisplay(t).accountText
          // 이체는 출금 → 입금 흐름을 함께 표시
          return t.kind === 'transfer' && t.counter_account_name
            ? `${t.account_name} → ${t.counter_account_name}`
            : t.account_name
        },
      },
      {
        id: 'member',
        header: '구성원',
        cell: ({ row }) => row.original.member_name ?? '—',
      },
      {
        id: 'memo',
        header: '메모',
        cell: ({ row }) => row.original.memo ?? '',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const t = row.original
          // 묶인 행은 "묶음 보기"만 — 수정/삭제는 해제 후 개별 행에서 한다
          if (isBundle(t)) {
            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="묶음 보기"
                  title="묶음 보기"
                  onClick={() => openView(t)}
                >
                  <Eye />
                </Button>
              </div>
            )
          }
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="거래 수정"
                onClick={() => openEdit(t)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="거래 삭제"
                onClick={() => remove(t.id).catch((e: Error) => setPageError(e.message))}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          )
        },
      },
    ],
    [remove],
  )

  const table = useReactTable({
    data: displayRows,
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

  const commitImport = async (preview: ImportPreview | null) => {
    if (!importFile) return
    const decisions = (preview?.review ?? []).map((r) => {
      const d = reviewDecisions[r.row]
      return {
        row: r.row,
        action: d?.action ?? 'skip',
        counter_account_id: d?.counter_account_id ? Number(d.counter_account_id) : null,
      }
    })
    const body = new FormData()
    body.append('file', importFile)
    body.append('month', importMonth)
    body.append('member_id', importMemberId)
    body.append('decisions', JSON.stringify(decisions))
    const result = await api.upload<ImportResult>('/transactions/import', body)
    setImportResult(result)
    setImportPreview(null)
    // 새 카테고리/계정이 생겼을 수 있으니 기준정보까지 재조회
    await Promise.all([fetch(), fetchAll()])
  }

  // 1단계: 미리보기 — 검토할 이체 행도, 확인할 평가액도 없으면 곧바로 확정까지 진행한다
  const runImport = async () => {
    if (!importFile) return setImportError('업로드할 .xlsx 파일을 선택해주세요')
    if (!importMonth) return setImportError('가져올 월을 선택해주세요')
    if (!importMemberId) return setImportError('업로드할 구성원을 선택해주세요')
    setImporting(true)
    setImportError(null)
    try {
      const body = new FormData()
      body.append('file', importFile)
      body.append('month', importMonth)
      // 미리보기도 계정 매칭을 업로드 구성원으로 스코프한다 — 확정 결과와 평가액 건수 파리티 유지
      body.append('member_id', importMemberId)
      const preview = await api.upload<ImportPreview>('/transactions/import/preview', body)
      if (
        preview.review.length === 0 &&
        preview.valuations.length === 0 &&
        preview.liabilities.length === 0
      ) {
        await commitImport(preview)
      } else {
        // 기본 제안으로 결정 초기화 후 검토 단계 진입
        const initial: Record<number, { action: ImportAction; counter_account_id: string }> = {}
        for (const r of preview.review) {
          initial[r.row] = { action: r.suggested, counter_account_id: '' }
        }
        setReviewDecisions(initial)
        setImportPreview(preview)
      }
    } catch (e) {
      setImportError((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  /** 페어 자동 이체로 처리되는 행인지 — 양쪽 다리 모두 이체+상대 계정 미지정일 때 */
  const isPairAuto = (row: number, pairRow: number | null) => {
    if (!pairRow) return false
    const mine = reviewDecisions[row]
    const pair = reviewDecisions[pairRow]
    return (
      mine?.action === 'transfer' &&
      !mine.counter_account_id &&
      pair?.action === 'transfer' &&
      !pair.counter_account_id
    )
  }

  // 2단계: 검토 확정
  const confirmReview = async () => {
    if (!importPreview) return
    for (const r of importPreview.review) {
      const d = reviewDecisions[r.row]
      if (d?.action === 'transfer' && !isPairAuto(r.row, r.pair_row) && !d.counter_account_id) {
        return setImportError(`${r.row}행: 이체로 처리하려면 상대 계정을 선택해주세요`)
      }
    }
    setImporting(true)
    setImportError(null)
    try {
      await commitImport(importPreview)
    } catch (e) {
      setImportError((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const openImport = () => {
    setImportFile(null)
    setImportMonth(addMonths(currentMonth(), -1))
    setImportMemberId('')
    setImportError(null)
    setImportResult(null)
    setImportPreview(null)
    setReviewDecisions({})
    setImportOpen(true)
  }

  // 월 외에 추가로 걸린 필터의 사람이 읽을 수 있는 요약 (확인 다이얼로그용)
  const bulkDeleteScope = useMemo(() => {
    const parts: string[] = []
    if (filters.kind) parts.push(`구분 ${KIND_LABEL[filters.kind]}`)
    if (filters.major) parts.push(`대분류 ${filters.major}`)
    if (filters.category_id) {
      const c = categories.find((x) => x.id === filters.category_id)
      if (c) parts.push(`소분류 ${c.minor}`)
    }
    if (filters.member_id) {
      const m = members.find((x) => x.id === filters.member_id)
      if (m) parts.push(`구성원 ${m.name}`)
    }
    return parts
  }, [filters.kind, filters.major, filters.category_id, filters.member_id, categories, members])

  const openBulkDelete = () => {
    setBulkDeleteError(null)
    setBulkDeleteOpen(true)
  }

  const confirmBulkDelete = async () => {
    setBulkDeleting(true)
    setBulkDeleteError(null)
    setPageNotice(null)
    try {
      const deleted = await removeMonth()
      setBulkDeleteOpen(false)
      setPageNotice(`${filters.month} 거래 ${deleted}건을 삭제했어요.`)
    } catch (e) {
      // 다이얼로그가 열린 채 남으므로 그 안에 표시해야 사용자에게 보인다
      setBulkDeleteError((e as Error).message)
    } finally {
      setBulkDeleting(false)
    }
  }

  // ----- 거래 묶기(연결) -----
  // 수정 모달의 "묶음" 버튼 → 연결 대상 선택 다이얼로그. 수정 모달은 닫고 전환한다.
  const openLinkPicker = (source: Transaction) => {
    setDialogOpen(false)
    setLinkSource(source)
    setLinkTarget(null)
    setLinkType('transfer')
    setLinkError(null)
    setLinkPickerOpen(true)
  }

  // 연결 후보 — 현재 목록에서 반대 구분·미묶임이며 자기 자신이 아닌 거래
  const linkCandidates = useMemo(() => {
    if (!linkSource) return []
    const wantKind: TransactionKind = linkSource.kind === 'expense' ? 'income' : 'expense'
    return items.filter(
      (t) => t.id !== linkSource.id && t.link_id == null && t.kind === wantKind,
    )
  }, [items, linkSource])

  // 미리보기용 — source/target에서 뽑은 지출·수입 다리
  const linkExpense =
    linkSource && linkTarget
      ? linkSource.kind === 'expense'
        ? linkSource
        : linkTarget
      : null
  const linkIncome =
    linkSource && linkTarget
      ? linkSource.kind === 'income'
        ? linkSource
        : linkTarget
      : null

  // 후보를 고르면 계정 일치 여부로 유형을 기본 제안한다 (사용자가 바꿀 수 있음)
  const selectCandidate = (candidate: Transaction) => {
    if (!linkSource) return
    setLinkTarget(candidate)
    const income = linkSource.kind === 'income' ? linkSource : candidate
    const expense = linkSource.kind === 'expense' ? linkSource : candidate
    setLinkType(income.account_id === expense.account_id ? 'refund' : 'transfer')
    setLinkError(null)
  }

  const confirmLink = async () => {
    if (!linkSource || !linkTarget) return
    const income = linkSource.kind === 'income' ? linkSource : linkTarget
    const expense = linkSource.kind === 'expense' ? linkSource : linkTarget
    // 서버도 검증하지만, 더 친절한 메시지를 위해 클라이언트에서 먼저 막는다
    if (linkType === 'transfer') {
      if (income.account_id === expense.account_id)
        return setLinkError('이체 묶음은 출금·입금 계정이 서로 달라야 해요')
      if (income.amount !== expense.amount)
        return setLinkError('이체 묶음은 두 거래의 금액이 같아야 해요')
    } else if (income.amount > expense.amount) {
      return setLinkError('환불 금액이 지출 금액보다 클 수 없어요')
    }
    setLinking(true)
    setLinkError(null)
    try {
      await link([linkSource.id, linkTarget.id], linkType)
      setLinkPickerOpen(false)
      setLinkSource(null)
      setLinkTarget(null)
    } catch (e) {
      setLinkError((e as Error).message)
    } finally {
      setLinking(false)
    }
  }

  // ----- 묶음 해제 (묶음 보기 다이얼로그) -----
  const confirmUnlink = async () => {
    if (!viewTx?.link_id) return
    setUnlinking(true)
    setViewError(null)
    try {
      await unlink(viewTx.link_id)
      setViewOpen(false)
      setViewTx(null)
    } catch (e) {
      setViewError((e as Error).message)
    } finally {
      setUnlinking(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 모바일: 제목/액션 세로 적층 + 액션 줄바꿈 허용 (한 줄 강제 시 375px에서 가로 스크롤) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">지출/수입 내역</h1>
        <div className="flex flex-wrap items-center gap-2">
          <MemberFilterSelect />
          {/* 전체를 h-8(=select 트리거)로 고정한 세그먼트 컨트롤 — 버튼이 프레임을 꽉 채우도록 h-full + 모서리 클립 */}
          <div className="flex h-8 overflow-hidden rounded-lg border">
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-full rounded-none"
              onClick={() => switchView('table')}
            >
              <Table2 /> 테이블
            </Button>
            <Button
              variant={view === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-full rounded-none"
              onClick={() => switchView('calendar')}
            >
              <CalendarDays /> 캘린더
            </Button>
          </div>
          <Button variant="outline" onClick={openImport}>
            <FileUp /> 엑셀 업로드
          </Button>
          {/* 월 미선택(전체 기간)이면 전체 삭제 사고를 막기 위해 비활성 */}
          <Button
            variant="outline"
            className="text-destructive"
            disabled={!filters.month || items.length === 0}
            title={filters.month ? undefined : '삭제할 월을 먼저 선택해주세요'}
            onClick={openBulkDelete}
          >
            <Trash2 /> 월 전체 삭제
          </Button>
          <Button onClick={openCreate}>
            <Plus /> 거래 추가
          </Button>
        </div>
      </div>

      {pageError && <p className="text-sm text-destructive">{pageError}</p>}
      {pageNotice && <p className="text-sm text-muted-foreground">{pageNotice}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="filter-month">조회 월</Label>
          <MonthPicker
            id="filter-month"
            className="w-40"
            placeholder="전체 기간"
            clearable
            value={filters.month ?? ''}
            onChange={(month) =>
              setFilters({ month: month || null }).catch((err: Error) =>
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
              <SelectItem value="transfer">이체</SelectItem>
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
          {/* 데스크톱(sm+): 표 / 모바일(sm 미만): 카드 목록 — 같은 정렬·페이지네이션 데이터 재사용 */}
          <div className="hidden rounded-lg border sm:block">
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

          {/* 모바일(sm 미만) 전용 카드 목록 — 표와 동일한 행 데이터(정렬·페이지네이션 반영)를 쓴다 */}
          <div className="space-y-2 sm:hidden">
            {table.getRowModel().rows.length === 0 ? (
              <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
                조건에 맞는 거래가 없습니다.
              </p>
            ) : (
              table.getRowModel().rows.map((row) => {
                const t = row.original
                const bundle = isBundle(t)
                const disp = bundle ? bundleDisplay(t) : null
                const kind = disp ? disp.kind : t.kind
                const amount = disp ? disp.amount : t.amount
                const category = disp ? disp.category_name : t.category_name
                const account = disp
                  ? disp.accountText
                  : t.kind === 'transfer' && t.counter_account_name
                    ? `${t.account_name} → ${t.counter_account_name}`
                    : t.account_name
                return (
                  <div key={row.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={KIND_BADGE_CLASS[kind]}>{KIND_LABEL[kind]}</Badge>
                          {t.link_type && (
                            <Badge variant="outline" className={LINK_BADGE_CLASS}>
                              <Link2 className="size-3" />
                              {LINK_LABEL[t.link_type]}
                            </Badge>
                          )}
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {t.date}
                            {t.time && ` ${formatTime(t.time)}`}
                          </span>
                        </div>
                        <span className="truncate font-medium">{category}</span>
                      </div>
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${kindAmountClass(kind)}`}
                      >
                        {kindAmountSign(kind)}
                        {formatNumber(amount)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div className="flex min-w-0 flex-col text-xs text-muted-foreground">
                        <span className="truncate">
                          {account}
                          {t.member_name ? ` · ${t.member_name}` : ''}
                        </span>
                        {t.memo && <span className="truncate">{t.memo}</span>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {bundle ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className={touchTarget}
                            aria-label="묶음 보기"
                            onClick={() => openView(t)}
                          >
                            <Eye />
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className={touchTarget}
                              aria-label="거래 수정"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className={touchTarget}
                              aria-label="거래 삭제"
                              onClick={() =>
                                remove(t.id).catch((e: Error) => setPageError(e.message))
                              }
                            >
                              <Trash2 className="text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
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
                filters.kind && KIND_LABEL[filters.kind],
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
          {dayRows && (
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm font-medium">{selectedDate} 거래</p>
              {dayRows.length === 0 && (
                <p className="text-sm text-muted-foreground">이 날의 거래가 없습니다.</p>
              )}
              {dayRows.map((t) => {
                const bundle = isBundle(t)
                const disp = bundle ? bundleDisplay(t) : null
                const kind = disp ? disp.kind : t.kind
                const amount = disp ? disp.amount : t.amount
                const category = disp ? disp.category_name : t.category_name
                const account = disp
                  ? disp.accountText
                  : t.kind === 'transfer' && t.counter_account_name
                    ? `${t.account_name} → ${t.counter_account_name}`
                    : t.account_name
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Badge variant="outline" className={KIND_BADGE_CLASS[kind]}>{KIND_LABEL[kind]}</Badge>
                      {t.link_type && (
                        <Badge variant="outline" className={LINK_BADGE_CLASS}>
                          <Link2 className="size-3" />
                          {LINK_LABEL[t.link_type]}
                        </Badge>
                      )}
                      <span className="min-w-0 truncate">{category}</span>
                      <span className="min-w-0 truncate text-xs text-muted-foreground">
                        {account}
                      </span>
                      {t.memo && (
                        <span className="min-w-0 truncate text-xs text-muted-foreground">{t.memo}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={kindAmountClass(kind)}>
                        {kindAmountSign(kind)}
                        {formatNumber(amount)}
                      </span>
                      {bundle ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={touchTarget}
                          aria-label="묶음 보기"
                          onClick={() => openView(t)}
                        >
                          <Eye />
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className={touchTarget}
                            aria-label="거래 수정"
                            onClick={() => openEdit(t)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className={touchTarget}
                            aria-label="거래 삭제"
                            onClick={() => remove(t.id).catch((e: Error) => setPageError(e.message))}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {/* 필드가 많아 짧은 뷰포트에서 세로로 넘칠 수 있으므로, import 다이얼로그와 동일하게
            헤더/푸터는 고정하고 본문만 스크롤시킨다 (grid 자식이 줄어들 수 있게 min-h-0 필요) */}
        <DialogContent className="sm:max-w-md max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]">
          <DialogHeader>
            <DialogTitle>{editing ? '거래 수정' : '거래 추가'}</DialogTitle>
            <DialogDescription>
              {editing ? '거래 내용을 수정합니다.' : '새 지출/수입/이체 거래를 기록합니다.'}
            </DialogDescription>
          </DialogHeader>
          {/* pr-3: 스크롤바가 콘텐츠와 겹치지 않게 여백 확보 */}
          <ScrollArea className="min-h-0 pr-3">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="tx-date">날짜</Label>
                <DatePicker
                  id="tx-date"
                  value={form.date}
                  onChange={(date) => setForm({ ...form, date })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tx-time">시간 (선택)</Label>
                <Input
                  id="tx-time"
                  type="time"
                  step="1"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
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
                      counter_account_id: '',
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">지출</SelectItem>
                    <SelectItem value="income">수입</SelectItem>
                    <SelectItem value="transfer">이체</SelectItem>
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
                <Label>{form.kind === 'transfer' ? '출금 계정' : '자산 계정'}</Label>
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
              {form.kind === 'transfer' && (
                <div className="space-y-1">
                  <Label>입금 계정</Label>
                  <Select
                    value={form.counter_account_id || undefined}
                    onValueChange={(v) => setForm({ ...form, counter_account_id: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((a) => a.is_active && String(a.id) !== form.account_id)
                        .map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
          </ScrollArea>
          {/* footer 좌측 끝에 "묶음" 진입 버튼 — 수정 중이며 아직 묶이지 않은 수입/지출일 때만.
              이체는 묶음(수입+지출) 대상이 아니고, 이미 묶인 거래는 해제 후 수정하도록 안내한다. */}
          <DialogFooter className="sm:justify-between">
            {editing && !editing.link_id && editing.kind !== 'transfer' ? (
              <Button variant="outline" onClick={() => openLinkPicker(editing)}>
                <Link2 /> 묶음
              </Button>
            ) : editing?.link_id ? (
              <span className="self-center text-xs text-muted-foreground">
                묶음을 해제한 뒤 수정할 수 있어요
              </span>
            ) : (
              // 좌측 자리 유지용 — 오른쪽 버튼 그룹을 우측에 고정 (추가 모달·이체엔 묶음 없음)
              <span className="hidden sm:block" />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={submit}>{editing ? '수정' : '추가'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        {/* 본문만 스크롤시키고 헤더/푸터는 고정 — grid 자식이 줄어들 수 있게 min-h-0 필요 */}
        <DialogContent
          className={`max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] ${
            importPreview && !importResult ? 'sm:max-w-2xl' : 'sm:max-w-md'
          }`}
        >
          <DialogHeader>
            <DialogTitle>
              {importPreview && !importResult
                ? importPreview.review.length > 0
                  ? '이체 내역 검토'
                  : '업로드 내용 확인'
                : '엑셀 업로드'}
            </DialogTitle>
            <DialogDescription>
              {importPreview && !importResult
                ? importPreview.review.length > 0
                  ? '이체 타입 행은 자동 반영되지 않아요. 행마다 처리 방법을 정해주세요.'
                  : '아래 내용으로 가져올게요. 확인 후 진행해주세요.'
                : '뱅크샐러드 내보내기 파일의 "가계부 내역"에서 선택한 달만 가져옵니다.'}
            </DialogDescription>
          </DialogHeader>
          {/* pr-3: 스크롤바가 Root 우측에 겹쳐 그려지므로 콘텐츠와 겹치지 않게 여백 확보 */}
          <ScrollArea className="min-h-0 pr-3">
          {importResult ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">{importResult.month}</span> 가져오기 완료 — 등록{' '}
                {importResult.created_count}건
                {importResult.transfer_count > 0 && ` (이체 ${importResult.transfer_count}건)`}
                {importResult.converted_count > 0 &&
                  ` (수입/지출 전환 ${importResult.converted_count}건)`}
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
              {importResult.valuation_count > 0 && (
                <p className="text-muted-foreground">
                  부동산 평가액 {importResult.valuation_count}건을 오늘 날짜로 반영했어요.
                </p>
              )}
              {importResult.loan_count > 0 && (
                <p className="text-muted-foreground">
                  대출 잔액 {importResult.loan_count}건을 오늘 날짜로 반영했어요.
                </p>
              )}
              {/* 다이얼로그 본문 전체가 스크롤되므로 여기서 다시 스크롤하지 않는다 */}
              {importResult.skipped.length > 0 && (
                <div className="space-y-1 rounded-md border p-2">
                  {importResult.skipped.map((s) => (
                    <p key={s.row} className="text-xs text-muted-foreground">
                      {s.row}행: {s.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : importPreview ? (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">
                {importPreview.review.length > 0 ? (
                  <>
                    수입/지출 {importPreview.importable_count}건은 바로 등록돼요. 아래 이체{' '}
                    {importPreview.review.length}건만 정해주시면 돼요 — 내계좌이체 짝이 맞는 행은
                    자동으로 한 건의 이체가 돼요.
                  </>
                ) : (
                  <>수입/지출 {importPreview.importable_count}건을 등록하고, 아래 평가액을 반영할게요.</>
                )}
              </p>
              {importPreview.valuations.length > 0 && (
                <div className="space-y-1 rounded-md border p-2">
                  <p className="text-xs font-medium">
                    반영될 평가액 — 부동산 {importPreview.valuations.length}건 (오늘 날짜)
                  </p>
                  <div className="space-y-1">
                    {importPreview.valuations.map((v, i) => (
                      <div
                        key={`${i}-${v.account_type}-${v.product_name}`}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                          <Badge variant="secondary">
                            {VALUATION_TYPE_LABEL[v.account_type]}
                          </Badge>
                          <span className="truncate">{v.product_name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">{formatKRW(v.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {importPreview.liabilities.length > 0 && (
                <div className="space-y-1 rounded-md border p-2">
                  <p className="text-xs font-medium">
                    반영될 대출 잔액 — {importPreview.liabilities.length}건 (오늘 날짜, 총자산 차감)
                  </p>
                  <div className="space-y-1">
                    {importPreview.liabilities.map((v, i) => (
                      <div
                        key={`${i}-loan-${v.product_name}`}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                          <Badge variant="secondary">대출</Badge>
                          <span className="truncate">{v.product_name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-rose-400">
                          -{formatKRW(v.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 다이얼로그 본문 전체가 스크롤되므로 여기서 다시 스크롤하지 않는다 */}
              <div className="space-y-2">
                {importPreview.review.map((r) => {
                  const decision = reviewDecisions[r.row]
                  const pairAuto = isPairAuto(r.row, r.pair_row)
                  const pairRow = r.pair_row
                    ? importPreview.review.find((p) => p.row === r.pair_row)
                    : undefined
                  return (
                    <div key={r.row} className="space-y-2 rounded-md border p-2">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
                        <span className="text-muted-foreground">
                          {r.date} · {r.minor === '미분류' ? r.major : `${r.major} > ${r.minor}`}{' '}
                          · {r.account_name}
                        </span>
                        <span className={r.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {r.amount > 0 ? '+' : ''}
                          {formatKRW(r.amount)}
                        </span>
                      </div>
                      {r.description && (
                        <p className="truncate text-xs text-muted-foreground">{r.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={decision?.action ?? r.suggested}
                          onValueChange={(v) =>
                            setReviewDecisions((prev) => ({
                              ...prev,
                              [r.row]: {
                                action: v as ImportAction,
                                counter_account_id:
                                  v === 'transfer' ? (prev[r.row]?.counter_account_id ?? '') : '',
                              },
                            }))
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">수입</SelectItem>
                            <SelectItem value="expense">지출</SelectItem>
                            <SelectItem value="transfer">이체</SelectItem>
                            <SelectItem value="skip">건너뛰기</SelectItem>
                          </SelectContent>
                        </Select>
                        {decision?.action === 'transfer' &&
                          (pairAuto ? (
                            <span className="text-xs text-sky-400">
                              자동 페어 ↔ {pairRow?.account_name} ({r.pair_row}행)
                            </span>
                          ) : (
                            <Select
                              value={decision.counter_account_id || undefined}
                              onValueChange={(v) =>
                                setReviewDecisions((prev) => ({
                                  ...prev,
                                  [r.row]: { ...prev[r.row], counter_account_id: v },
                                }))
                              }
                            >
                              <SelectTrigger className="w-44">
                                <SelectValue
                                  placeholder={r.amount < 0 ? '입금받을 계정' : '출금된 계정'}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts
                                  .filter((a) => a.is_active && a.name !== r.account_name)
                                  .map((a) => (
                                    <SelectItem key={a.id} value={String(a.id)}>
                                      {a.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ))}
                      </div>
                      {r.major === '카드대금' && decision?.action === 'expense' && (
                        <p className="text-xs text-amber-400">
                          ⚠️ 카드대금을 지출로 등록하면 카드 사용 내역과 이중 계산돼요 —
                          이체(상대: 카드 계정)를 권장해요.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
              {importError && <p className="text-sm text-destructive">{importError}</p>}
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
                <MonthPicker
                  id="import-month"
                  className="w-40"
                  value={importMonth}
                  onChange={setImportMonth}
                />
              </div>
              <div className="space-y-1">
                <Label>구성원</Label>
                <Select value={importMemberId || undefined} onValueChange={setImportMemberId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  업로드되는 모든 거래가 이 구성원의 거래로 기록돼요. 엑셀에 처음 등장하는
                  자산 계정도 이 구성원의 소유로 생성돼요.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                해당 월에 같은 구성원으로 업로드한 내역이 있으면 삭제 후 다시 등록돼요. 다른
                구성원의 업로드 내역과 직접 입력한 거래는 그대로 유지됩니다.
              </p>
              {importError && <p className="text-sm text-destructive">{importError}</p>}
            </div>
          )}
          </ScrollArea>
          <DialogFooter>
            {importResult ? (
              <Button onClick={() => setImportOpen(false)}>닫기</Button>
            ) : importPreview ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportPreview(null)
                    setImportError(null)
                  }}
                >
                  이전
                </Button>
                <Button onClick={confirmReview} disabled={importing}>
                  {importing ? '등록 중…' : '확정하고 가져오기'}
                </Button>
              </>
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

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>월 전체 삭제</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{filters.month}</span> 거래{' '}
              <span className="font-medium text-foreground">{items.length}건</span>을 삭제할게요.
              되돌릴 수 없어요.
            </DialogDescription>
          </DialogHeader>
          {/* 현재 화면 필터에 걸리는 것만 지우므로, 어떤 필터가 걸려 있는지 밝힌다 */}
          {bulkDeleteScope.length > 0 && (
            <p className="text-sm text-muted-foreground">
              적용 중인 필터: {bulkDeleteScope.join(' · ')} — 이 조건에 맞는 거래만 삭제돼요.
            </p>
          )}
          {bulkDeleteError && (
            <p className="text-sm text-destructive">{bulkDeleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? '삭제 중…' : `${items.length}건 삭제`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 연결 대상 선택 — 수정 모달 "묶음" 버튼에서 진입. 현재 목록의 반대 구분 후보를 고른다.
          본문만 스크롤(후보가 많을 수 있음), 헤더/푸터 고정 */}
      <Dialog open={linkPickerOpen} onOpenChange={setLinkPickerOpen}>
        <DialogContent className="sm:max-w-md max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]">
          <DialogHeader>
            <DialogTitle>연결할 거래 선택</DialogTitle>
            <DialogDescription>
              현재 목록에서 묶을 상대 거래를 골라 하나의 묶음으로 연결해요. 원본은 그대로 남고
              통계에만 반영돼요.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="min-h-0 pr-3">
            <div className="space-y-3 text-sm">
              {linkSource && (
                <div className="space-y-1 rounded-md border p-2 text-xs">
                  <p className="font-medium">묶을 기준 거래</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {KIND_LABEL[linkSource.kind]} · {linkSource.category_name} ·{' '}
                      {linkSource.account_name}
                    </span>
                    <span
                      className={`shrink-0 tabular-nums ${kindAmountClass(linkSource.kind)}`}
                    >
                      {kindAmountSign(linkSource.kind)}
                      {formatNumber(linkSource.amount)}
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  현재 목록에서 연결할 {linkSource?.kind === 'expense' ? '수입' : '지출'} 거래를
                  고르세요.
                </p>
                {linkCandidates.length === 0 ? (
                  <p className="rounded-md border py-6 text-center text-xs text-muted-foreground">
                    현재 목록에 묶을 수 있는{' '}
                    {linkSource?.kind === 'expense' ? '수입' : '지출'} 거래가 없어요. 조회 월·필터를
                    옮겨 상대 거래가 보이게 한 뒤 다시 시도해주세요.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {linkCandidates.map((c) => {
                      const active = linkTarget?.id === c.id
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectCandidate(c)}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-md border p-2 text-left text-xs transition-colors hover:bg-accent/50',
                            active && 'border-primary bg-accent',
                          )}
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate">
                              {c.date}
                              {c.time && ` ${formatTime(c.time)}`} · {c.category_name}
                            </span>
                            <span className="truncate text-muted-foreground">
                              {c.account_name}
                              {c.memo ? ` · ${c.memo}` : ''}
                            </span>
                          </span>
                          <span className={`shrink-0 tabular-nums ${kindAmountClass(c.kind)}`}>
                            {kindAmountSign(c.kind)}
                            {formatNumber(c.amount)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              {linkExpense && linkIncome && (
                <>
                  <div className="space-y-1">
                    <Label>묶음 유형</Label>
                    <Select value={linkType} onValueChange={(v) => setLinkType(v as LinkType)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transfer">이체 (계좌 간 이동)</SelectItem>
                        <SelectItem value="refund">환불 (결제 취소)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {linkType === 'transfer' ? (
                    <p className="text-xs text-muted-foreground">
                      {linkExpense.account_name} → {linkIncome.account_name} 이체로 묶어요. 두 건
                      모두 수입/지출 통계에서 빠지고, 계정 잔액은 그대로 유지돼요.
                      {linkIncome.amount !== linkExpense.amount && (
                        <span className="mt-1 block text-amber-400">
                          ⚠️ 두 거래의 금액이 달라 이체로 묶을 수 없어요.
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      지출에서 환불액을 뺀 순지출{' '}
                      <span className="tabular-nums text-foreground">
                        {formatKRW(Math.max(linkExpense.amount - linkIncome.amount, 0))}
                      </span>
                      만 통계에 반영되고, 환불 수입은 수입 합계에서 빠져요.
                      {linkIncome.amount > linkExpense.amount && (
                        <span className="mt-1 block text-amber-400">
                          ⚠️ 환불 금액이 지출 금액보다 커서 묶을 수 없어요.
                        </span>
                      )}
                    </p>
                  )}
                </>
              )}
              {linkError && <p className="text-sm text-destructive">{linkError}</p>}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkPickerOpen(false)}>
              취소
            </Button>
            <Button onClick={confirmLink} disabled={linking || !linkTarget}>
              {linking ? '묶는 중…' : '묶기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 묶음 보기 — 병합 행에서 두 다리 상세 확인 + 해제 */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>묶음 보기</DialogTitle>
            <DialogDescription>
              {viewTx?.link_type ? LINK_LABEL[viewTx.link_type] : '묶음'}으로 연결된 두 거래예요.
              해제하면 각각 개별 거래로 돌아가요.
            </DialogDescription>
          </DialogHeader>
          {viewTx &&
            isBundle(viewTx) &&
            (() => {
              const { expense, income } = bundleLegs(viewTx)
              return (
                <div className="min-w-0 space-y-3 text-sm">
                  {/* 지출 다리 */}
                  <div className="space-y-1 rounded-md border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1">
                        <Badge variant="outline" className={KIND_BADGE_CLASS.expense}>
                          {KIND_LABEL.expense}
                        </Badge>
                        <span className="truncate">{expense.category_name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-rose-400">
                        -{formatNumber(expense.amount)}
                      </span>
                    </div>
                    <p className="truncate text-muted-foreground">
                      {expense.date}
                      {expense.time && ` ${formatTime(expense.time)}`} · {expense.account_name}
                      {expense.memo ? ` · ${expense.memo}` : ''}
                    </p>
                  </div>
                  {/* 수입 다리 */}
                  <div className="space-y-1 rounded-md border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1">
                        <Badge variant="outline" className={KIND_BADGE_CLASS.income}>
                          {KIND_LABEL.income}
                        </Badge>
                        <span className="truncate">{income.category_name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-emerald-400">
                        +{formatNumber(income.amount)}
                      </span>
                    </div>
                    <p className="truncate text-muted-foreground">
                      {income.date}
                      {income.time && ` ${formatTime(income.time)}`} · {income.account_name}
                      {income.memo ? ` · ${income.memo}` : ''}
                    </p>
                  </div>
                  {/* 유형별 효과 요약 */}
                  <p className="text-xs text-muted-foreground">
                    {viewTx.link_type === 'transfer' ? (
                      '두 건 모두 수입/지출 통계에서 빠지고, 계정 잔액은 그대로예요.'
                    ) : (
                      <>
                        지출에서 환불액을 뺀 순지출{' '}
                        <span className="tabular-nums text-foreground">
                          {formatKRW(Math.max(expense.amount - income.amount, 0))}
                        </span>
                        만 통계에 반영돼요.
                      </>
                    )}
                  </p>
                  {viewError && <p className="text-sm text-destructive">{viewError}</p>}
                </div>
              )
            })()}
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              className="text-destructive"
              onClick={confirmUnlink}
              disabled={unlinking}
            >
              <Unlink /> {unlinking ? '해제 중…' : '묶음 해제'}
            </Button>
            <Button onClick={() => setViewOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
