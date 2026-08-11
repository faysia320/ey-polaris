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
  IconArrowUpArrowDownLine,
  IconArrowUpBracketDownLine,
  IconChevronLeftLine,
  IconChevronRightLine,
  IconEyeLine,
  IconPaperclipLine,
  IconPencilLine,
  IconPlusLine,
  IconScissorsLine,
  IconTrashcanLine,
} from '@karrotmarket/react-monochrome-icon'
import { Badge, Icon, PrefixIcon, ResponsivePair, SuffixIcon, VStack } from '@seed-design/react'
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
import {
  ResponsiveSidePanelBody,
  ResponsiveSidePanelContent,
  ResponsiveSidePanelFooter,
  ResponsiveSidePanelRoot,
} from 'seed-design/ui/responsive-side-panel'
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectRoot,
  SelectTrigger,
} from 'seed-design/ui/select'
import { SegmentedControl, SegmentedControlItem } from 'seed-design/ui/segmented-control'
import { TextField, TextFieldInput } from 'seed-design/ui/text-field'

import { DateField } from '@/components/ui/DateField'
import { TimeField } from '@/components/ui/TimeField'
import { MonthField } from '@/components/ui/MonthField'
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
import {
  ACCOUNT_TYPES,
  accountTypeLabel,
  addMonths,
  categoryLabel,
  currentMonth,
  formatKRW,
  formatNumber,
  KIND_LABEL,
  todayISO,
} from '@/lib/format'
import { cn, touchTarget } from '@/lib/utils'
import { useMasterDataStore } from '@/stores/masterData'
import { useMemberFilterStore } from '@/stores/memberFilter'
import { useTransactionStore } from '@/stores/transactions'
import type {
  AccountType,
  ImportAccountMapping,
  ImportAccountMapResult,
  ImportAccountSource,
  ImportAction,
  ImportMappingAction,
  ImportPreview,
  ImportResult,
  ImportReviewRow,
  ImportSourceKind,
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
  /** 간편결제 계정으로 결제한 건의 실제 결제 계정 — 'none'이면 미지정(계정 기본 연결에 맡김) */
  linked_account_id: string
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
  linked_account_id: 'none',
  member_id: 'none',
  amount: '',
  memo: '',
})

/** 구분별 배지 톤 — SEED Badge의 역할 토큰에 그대로 얹는다.
 *  수입=positive(녹) / 지출=critical(적) / 이체=informative(청)로 금액 텍스트와 색을 맞춘다. */
const KIND_BADGE_TONE: Record<TransactionKind, 'positive' | 'critical' | 'informative'> = {
  income: 'positive',
  expense: 'critical',
  transfer: 'informative',
}

/** 엑셀 평가액 반영 시 자산 유형 라벨 — 주식은 총합 직접 입력이라 엑셀 반영 대상이 아니다 */
const VALUATION_TYPE_LABEL: Record<'real_estate', string> = {
  real_estate: '부동산',
}

/** 계정 매핑 스텝 — 소스가 엑셀 어디에서 왔는지 */
const SOURCE_KIND_LABEL: Record<ImportSourceKind, string> = {
  ledger: '결제수단',
  valuation: '부동산',
  liability: '대출',
}

/** 소스 종류가 강제하는 계정 유형 — 백엔드 SOURCE_REQUIRED_TYPE와 일치. ledger는 자유 선택 */
const SOURCE_REQUIRED_TYPE: Partial<Record<ImportSourceKind, AccountType>> = {
  valuation: 'real_estate',
  liability: 'loan',
}

/** 소스 식별자 — 같은 이름이 결제수단이면서 상품명일 수 있어 종류까지 포함한다 */
const sourceKey = (s: { kind: ImportSourceKind; name: string }) => `${s.kind}|${s.name}`

interface MappingChoice {
  action: ImportMappingAction
  /** link 전용 — Select 값이라 문자열로 보관 */
  account_id: string
  /** create 전용 */
  type: AccountType
}

/** 사후 묶음 유형 라벨 — transfer(계좌 간 이체) | refund(카드 결제+환불) */
const LINK_LABEL: Record<LinkType, string> = {
  transfer: '이체 묶음',
  refund: '환불 묶음',
}
/** 묶음 배지 — 이체(informative)와 구분되도록 SEED 팔레트의 보라 계열을 직접 쓴다.
 *  '사후 묶음'은 SEED의 역할 토큰(positive/critical/informative/warning)에 대응이 없다. */
const LINK_BADGE_CLASS =
  'gap-x1 border-palette-purple-500 bg-palette-purple-800 text-palette-purple-300'

/** 거래 시각 표시 — "HH:MM:SS"/"HH:MM"을 "HH:MM"으로 축약 */
const formatTime = (time: string) => time.slice(0, 5)

const kindAmountClass = (kind: TransactionKind) =>
  kind === 'income'
    ? 'text-fg-positive'
    : kind === 'expense'
      ? 'text-fg-critical'
      : 'text-fg-informative'

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
  /** 이 다리가 실제로 귀속되는 결제 계정 이름 (간편결제가 아니면 null) */
  linked_account_name: string | null
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
    linked_account_name: t.linked_account_name,
    category_name: t.category_name,
    memo: t.memo,
  }
  const other: BundleLeg = {
    amount: partner.amount,
    date: partner.date,
    time: partner.time,
    account_name: partner.account_name,
    linked_account_name: partner.linked_account_name,
    category_name: partner.category_name,
    memo: partner.memo,
  }
  return t.kind === 'expense' ? { expense: self, income: other } : { expense: other, income: self }
}

/** 결제수단 표기 — 간편결제면 실제 결제가 빠지는 계정을 괄호로 덧붙인다.
 *  한 행에 계정이 둘 이상 나오는 자리(이체의 출금→입금)에서 화살표 의미가 섞이지 않게
 *  `출금계정(→결제계정) → 입금계정` 형태로 중첩한다. */
const payerText = (accountName: string, settlementName: string | null) =>
  settlementName ? `${accountName}(→${settlementName})` : accountName

/** 계정이 하나만 나오는 자리(환불 묶음 행·묶음 보기의 각 다리)의 계정 표기 —
 *  화살표를 중첩할 필요가 없어 `계정 → 결제계정`으로 편다. */
const legAccountText = (leg: BundleLeg) =>
  leg.linked_account_name ? `${leg.account_name} → ${leg.linked_account_name}` : leg.account_name

/** 병합 행의 표시값 — 이체 묶음: 출금→입금·거래 금액(청), 환불 묶음: 순지출(적) */
const bundleDisplay = (t: Transaction) => {
  const { expense, income } = bundleLegs(t)
  if (t.link_type === 'transfer') {
    return {
      kind: 'transfer' as TransactionKind,
      amount: expense.amount,
      accountText: `${payerText(expense.account_name, expense.linked_account_name)} → ${income.account_name}`,
      category_name: expense.category_name,
    }
  }
  return {
    kind: 'expense' as TransactionKind,
    amount: Math.max(expense.amount - income.amount, 0),
    accountText: legAccountText(expense),
    category_name: expense.category_name,
  }
}

/** 목록(표·모바일 카드)이 공유하는 계정 표시 텍스트.
 *  이체는 출금 → 입금, 간편결제는 실제 결제가 빠지는 계정까지 함께 보여준다
 *  (건별 지정이든 계정 기본 연결이든 서버가 최종 귀속 계정을 linked_account_name으로 준다). */
const accountText = (t: Transaction) => {
  if (isBundle(t)) return bundleDisplay(t).accountText
  if (t.kind === 'transfer' && t.counter_account_name)
    return `${payerText(t.account_name, t.linked_account_name)} → ${t.counter_account_name}`
  return t.linked_account_name ? `${t.account_name} → ${t.linked_account_name}` : t.account_name
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
  // 업로드 스텝 — 입력(form) → 자산계정 매핑(accounts) → 이체 검토(review) → 결과(importResult)
  const [importStep, setImportStep] = useState<'form' | 'accounts' | 'review'>('form')
  // 이체 검토 단계 — 미리보기 결과와 행별 결정 (행번호 → 결정)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [reviewDecisions, setReviewDecisions] = useState<
    Record<number, { action: ImportAction; counter_account_id: string }>
  >({})
  // 자산계정 매핑 단계 — 소스키(`kind|name`) → 사용자 선택
  const [mappingChoices, setMappingChoices] = useState<Record<string, MappingChoice>>({})
  // 매핑 확정 결과 — 최종 가져오기 요청에 그대로 실어 보낸다 (연결 또는 제외)
  const [resolvedMappings, setResolvedMappings] = useState<ImportAccountMapping[]>([])
  // 매핑 확정으로 만들어진 계정명 — 결과 화면에서 임포트가 만든 계정과 합쳐 보여준다
  const [mappingCreatedAccounts, setMappingCreatedAccounts] = useState<string[]>([])

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

  // 건별 연결 계정은 간편결제 계정으로 결제한 건에서만 의미가 있다 (백엔드 검증과 동일 조건)
  const formAccountIsEasyPay =
    accounts.find((a) => String(a.id) === form.account_id)?.type === 'easy_pay'
  // 건별 연결 후보 — 활성 카드/은행 계정만 (백엔드 LINKABLE_TYPES와 일치)
  const linkableAccounts = accounts.filter(
    (a) => a.is_active && (a.type === 'card' || a.type === 'bank'),
  )

  const switchView = (next: 'table' | 'calendar') => {
    setView(next)
    if (next === 'calendar' && !filters.month) {
      setFilters({ month: currentMonth() }).catch((e: Error) => setPageError(e.message))
    }
  }

  /** 달력이 보는 월을 바꾼다 (페이지 상단 이동 버튼과 DatePicker 자체 헤더가 공유) */
  const setCalendarMonth = (month: string) => {
    setSelectedDate(null)
    setFilters({ month }).catch((e: Error) => setPageError(e.message))
  }

  const moveCalendarMonth = (delta: number) => setCalendarMonth(addMonths(calendarMonth, delta))

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
      linked_account_id: t.linked_account_id ? String(t.linked_account_id) : 'none',
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
      // 간편결제 계정으로 결제한 건에서만 보낸다 — 그 외에는 백엔드가 422로 거부한다
      linked_account_id:
        formAccountIsEasyPay && form.linked_account_id !== 'none'
          ? Number(form.linked_account_id)
          : null,
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
          <ActionButton
            variant="ghost"
            size="small"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            날짜 <SuffixIcon svg={<IconArrowUpArrowDownLine />} />
          </ActionButton>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col whitespace-nowrap tabular-nums">
            <span>{row.original.date}</span>
            {row.original.time && (
              <span className="t2-regular text-fg-neutral-muted">
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
            <Badge variant="weak" tone={KIND_BADGE_TONE[kind]}>
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
            <div className="flex flex-wrap items-center gap-x1_5">
              <span>{category}</span>
              {t.link_type && (
                <Badge variant="outline" className={LINK_BADGE_CLASS}>
                  <Icon svg={<IconPaperclipLine />} size="x3" />
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
          <ActionButton
            variant="ghost"
            size="small"
            className="w-full justify-end"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            금액 <SuffixIcon svg={<IconArrowUpArrowDownLine />} />
          </ActionButton>
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
        cell: ({ row }) => accountText(row.original),
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
              <div className="flex justify-end gap-x1">
                <ActionButton
                  variant="ghost"
                  size="small" layout="iconOnly"
                  aria-label="묶음 보기"
                  title="묶음 보기"
                  onClick={() => openView(t)}
                >
                  <Icon svg={<IconEyeLine />} />
                </ActionButton>
              </div>
            )
          }
          return (
            <div className="flex justify-end gap-x1">
              <ActionButton
                variant="ghost"
                size="small" layout="iconOnly"
                aria-label="거래 수정"
                onClick={() => openEdit(t)}
              >
                <Icon svg={<IconPencilLine />} />
              </ActionButton>
              <ActionButton
                variant="ghost"
                size="small" layout="iconOnly"
                aria-label="거래 삭제"
                onClick={() => remove(t.id).catch((e: Error) => setPageError(e.message))}
              >
                <Icon svg={<IconTrashcanLine />} />
              </ActionButton>
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

  /** rows: 화면에 실제로 표시한 검토 행만 — 서버도 제외 행은 결정 없이 건너뛴다 */
  const commitImport = async (rows: ImportReviewRow[], mappings: ImportAccountMapping[]) => {
    if (!importFile) return
    const decisions = rows.map((r) => {
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
    // 매핑 스텝에서 확정한 계정(연결/제외)을 그대로 전달 — 서버가 이름 재매칭을 하지 않게 한다
    body.append('account_mappings', JSON.stringify(mappings))
    const result = await api.upload<ImportResult>('/transactions/import', body)
    setImportResult(result)
    setImportPreview(null)
    // 새 카테고리/계정이 생겼을 수 있으니 기준정보까지 재조회
    await Promise.all([fetch(), fetchAll()])
  }

  // 1단계: 미리보기 → 자산계정 매핑 스텝 진입 (계정 소스가 하나도 없을 때만 건너뛴다)
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
      // 이체 검토 결정은 기본 제안으로 초기화해 둔다 (매핑 확정 후 검토 스텝에서 사용)
      const decisions: Record<number, { action: ImportAction; counter_account_id: string }> = {}
      for (const r of preview.review) {
        decisions[r.row] = { action: r.suggested, counter_account_id: '' }
      }
      setReviewDecisions(decisions)
      setImportPreview(preview)

      if (preview.account_sources.length === 0) {
        // 매핑할 계정이 없다 — 검토/확인할 것도 없으면 곧바로 확정
        if (
          preview.review.length === 0 &&
          preview.valuations.length === 0 &&
          preview.liabilities.length === 0
        ) {
          await commitImport(preview.review, [])
        } else {
          setResolvedMappings([])
          setImportStep('review')
        }
        return
      }

      // 매핑 기본값 — 동명 계정이 있으면 연결, 없으면 추정 유형으로 새로 만들기
      const choices: Record<string, MappingChoice> = {}
      for (const s of preview.account_sources) {
        choices[sourceKey(s)] = s.matched_account_id
          ? { action: 'link', account_id: String(s.matched_account_id), type: s.suggested_type }
          : { action: 'create', account_id: '', type: s.suggested_type }
      }
      setMappingChoices(choices)
      setImportStep('accounts')
    } catch (e) {
      setImportError((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  // 결과 화면의 "새 자산 계정" — 매핑 스텝에서 만든 계정과 임포트가 만든 계정을 합쳐 보여준다
  const importCreatedAccounts = [
    ...new Set([...mappingCreatedAccounts, ...(importResult?.created_accounts ?? [])]),
  ]

  // 검토 스텝은 매핑에서 제외한 소스를 빼고 보여준다 — 실제로 등록되지 않을 항목을
  // "반영될" 대상으로 표시하면 같은 화면의 제외 안내와 모순된다
  const excludedSourceKeys = new Set(
    resolvedMappings.filter((m) => m.action === 'exclude').map((m) => `${m.kind}|${m.name}`),
  )
  const previewValuations = (importPreview?.valuations ?? []).filter(
    (v) => !excludedSourceKeys.has(`valuation|${v.product_name}`),
  )
  const previewLiabilities = (importPreview?.liabilities ?? []).filter(
    (v) => !excludedSourceKeys.has(`liability|${v.product_name}`),
  )
  // 자동 페어는 한쪽 다리만 제외돼도 서버가 두 다리를 함께 건너뛴다 — 화면에서도 같이 감춘다
  // (남겨두면 상대 계정명이 빈 "자동 페어 ↔ (N행)"으로 보이고 이체 건수도 실제와 어긋난다)
  const isLedgerExcluded = (accountName: string) =>
    excludedSourceKeys.has(`ledger|${accountName}`)
  const previewReview = (importPreview?.review ?? []).filter((r) => {
    if (isLedgerExcluded(r.account_name)) return false
    const pair = r.pair_row
      ? importPreview?.review.find((p) => p.row === r.pair_row)
      : undefined
    return !(pair && isLedgerExcluded(pair.account_name))
  })
  const previewImportableCount =
    (importPreview?.importable_count ?? 0) -
    (importPreview?.account_sources ?? [])
      .filter((s) => s.kind === 'ledger' && excludedSourceKeys.has(sourceKey(s)))
      .reduce((sum, s) => sum + s.importable_count, 0)

  /** 소스에 연결할 수 있는 계정 후보 — 업로드 구성원 소유 + 소스가 요구하는 유형.
   *  비활성 계정도 후보에 남긴다: preview의 완전일치(matched_account_id)는 활성 여부를 가리지
   *  않으므로, 여기서 걸러내면 기본 선택값이 목록에 없어 빈 칸으로 보이게 된다(라벨로 구분). */
  const mappingCandidates = (source: ImportAccountSource) => {
    const required = SOURCE_REQUIRED_TYPE[source.kind]
    return accounts.filter(
      (a) => a.member_id === Number(importMemberId) && (!required || a.type === required),
    )
  }

  // 2단계: 자산계정 매핑 확정 — 여기서 계정이 실제로 만들어진다
  const confirmAccounts = async () => {
    if (!importPreview) return
    const sources = importPreview.account_sources
    for (const s of sources) {
      const choice = mappingChoices[sourceKey(s)]
      if (choice?.action !== 'link') continue
      if (!choice.account_id) {
        return setImportError(`'${s.name}': 연결할 계정을 선택해주세요`)
      }
      // 고른 계정이 후보에 없으면(유형·소유자 변경 등) 화면에 표시되지 않으므로 그대로 넘기지 않는다
      if (!mappingCandidates(s).some((a) => String(a.id) === choice.account_id)) {
        return setImportError(`'${s.name}': 연결할 계정을 다시 선택해주세요`)
      }
    }
    setImporting(true)
    setImportError(null)
    try {
      const mappings: ImportAccountMapping[] = sources.map((s) => {
        const choice = mappingChoices[sourceKey(s)]
        if (choice.action === 'exclude') return { kind: s.kind, name: s.name, action: 'exclude' }
        if (choice.action === 'link') {
          return {
            kind: s.kind,
            name: s.name,
            action: 'link',
            account_id: Number(choice.account_id),
          }
        }
        return { kind: s.kind, name: s.name, action: 'create', type: choice.type }
      })
      const result = await api.post<ImportAccountMapResult>('/transactions/import/accounts', {
        member_id: Number(importMemberId),
        mappings,
      })
      // 확정 결과를 최종 요청용 매핑(연결/제외)으로 굳힌다 — 이름 재매칭 없이 계정 id로 적재
      setResolvedMappings(
        result.resolved.map((r) =>
          r.excluded
            ? { kind: r.kind, name: r.name, action: 'exclude' }
            : { kind: r.kind, name: r.name, action: 'link', account_id: r.account_id },
        ),
      )
      // 매핑 스텝을 오가며 여러 번 확정할 수 있으므로 생성 이력은 누적한다
      setMappingCreatedAccounts((prev) => [...new Set([...prev, ...result.created_accounts])])
      // 새로 만든 계정을 이체 상대 계정 드롭다운에서 바로 고를 수 있게 기준정보 재조회
      await fetchAll()
      setImportStep('review')
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

  // 3단계: 검토 확정 — 확정된 계정 매핑과 함께 실제 적재
  const confirmReview = async () => {
    if (!importPreview) return
    // 제외한 소스의 행은 화면에도 없고 등록되지도 않으므로 상대 계정 검증 대상이 아니다
    for (const r of previewReview) {
      const d = reviewDecisions[r.row]
      if (d?.action === 'transfer' && !isPairAuto(r.row, r.pair_row) && !d.counter_account_id) {
        return setImportError(`${r.row}행: 이체로 처리하려면 상대 계정을 선택해주세요`)
      }
    }
    setImporting(true)
    setImportError(null)
    try {
      await commitImport(previewReview, resolvedMappings)
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
    setImportStep('form')
    setMappingChoices({})
    setResolvedMappings([])
    setMappingCreatedAccounts([])
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
    <div className="flex flex-col gap-x6">
      {/* 모바일: 제목/액션 세로 적층 + 액션 줄바꿈 허용 (한 줄 강제 시 375px에서 가로 스크롤) */}
      <div className="flex flex-col gap-x3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="screen-title shrink-0 whitespace-nowrap">지출/수입 내역</h1>
        <div className="flex flex-wrap items-center gap-x2">
          <MemberFilterSelect />
          {/* 표/캘린더 전환 — 상호배타 뷰 전환은 SEED에서 SegmentedControl의 역할이다 */}
          <SegmentedControl
            aria-label="보기 전환"
            value={view}
            onValueChange={(v) => switchView(v as 'table' | 'calendar')}
          >
            <SegmentedControlItem value="table">테이블</SegmentedControlItem>
            <SegmentedControlItem value="calendar">캘린더</SegmentedControlItem>
          </SegmentedControl>
          <ActionButton variant="neutralOutline" size="small" onClick={openImport}>
            <PrefixIcon svg={<IconArrowUpBracketDownLine />} />
            엑셀 업로드
          </ActionButton>
          {/* 월 미선택(전체 기간)이면 전체 삭제 사고를 막기 위해 비활성 */}
          <ActionButton
            variant="neutralOutline"
            size="small"
            className="text-fg-critical"
            disabled={!filters.month || items.length === 0}
            title={filters.month ? undefined : '삭제할 월을 먼저 선택해주세요'}
            onClick={openBulkDelete}
          >
            <PrefixIcon svg={<IconTrashcanLine />} />월 전체 삭제
          </ActionButton>
          <ActionButton variant="neutralSolid" size="small" onClick={openCreate}>
            <PrefixIcon svg={<IconPlusLine />} />
            거래 추가
          </ActionButton>
        </div>
      </div>

      {pageError && <p className="t4-regular text-fg-critical">{pageError}</p>}
      {pageNotice && <p className="t4-regular text-fg-neutral-muted">{pageNotice}</p>}

      <div className="flex flex-wrap items-end gap-x3">
        <div className="w-48">
          <MonthField
            label="조회 월"
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
        <div className="w-32">
          <SelectRoot
            label="구분"
            size="responsive"
            value={[filters.kind ?? 'all']}
            onValueChange={([v]) =>
              // 구분이 바뀌면 다른 구분의 카테고리 필터는 의미가 없으므로 함께 초기화
              setFilters({
                kind: v === 'all' ? null : (v as TransactionKind),
                major: null,
                category_id: null,
              }).catch((err: Error) => setPageError(err.message))
            }
          >
            <SelectTrigger aria-label="구분" />
            <SelectContent>
              <SelectGroup>
                              <SelectItem value="all" label="전체" />
                  <SelectItem value="income" label="수입" />
                  <SelectItem value="expense" label="지출" />
                  <SelectItem value="transfer" label="이체" />
                </SelectGroup>
            </SelectContent>
          </SelectRoot>
        </div>
        <div className="w-40">
          <SelectRoot
            label="대분류"
            size="responsive"
            value={[filters.major ?? 'all']}
            onValueChange={([v]) =>
              setFilters({ major: v === 'all' ? null : v, category_id: null }).catch(
                (err: Error) => setPageError(err.message),
              )
            }
          >
            <SelectTrigger aria-label="대분류" />
            <SelectContent>
              <SelectGroup>
                              <SelectItem value="all" label="전체" />
                  {filterMajors.map((m) => (
                    <SelectItem key={m} value={m} label={m} />
                  ))}
                </SelectGroup>
            </SelectContent>
          </SelectRoot>
        </div>
        {filters.major && (
          <div className="w-40">
            <SelectRoot
              label="소분류"
              size="responsive"
              value={[filters.category_id ? String(filters.category_id) : 'all']}
              onValueChange={([v]) =>
                setFilters({ category_id: v === 'all' ? null : Number(v) }).catch(
                  (err: Error) => setPageError(err.message),
                )
              }
            >
              <SelectTrigger aria-label="소분류" />
              <SelectContent>
                <SelectGroup>
                              <SelectItem value="all" label="전체" />
                    {filterMinors.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)} label={c.minor} />
                    ))}
                  </SelectGroup>
              </SelectContent>
            </SelectRoot>
          </div>
        )}
      </div>

      {view === 'table' ? (
        <>
          {/* 데스크톱(sm+): 표 / 모바일(sm 미만): 카드 목록 — 같은 정렬·페이지네이션 데이터 재사용 */}
          <div className="hidden rounded-r2 border sm:block">
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
                      className="py-x10 text-center text-fg-neutral-muted"
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
          <div className="space-y-(--dimension-x2) sm:hidden">
            {table.getRowModel().rows.length === 0 ? (
              <p className="rounded-r2 border py-x10 text-center t4-regular text-fg-neutral-muted">
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
                const account = accountText(t)
                return (
                  <div key={row.id} className="rounded-r2 border p-x3">
                    <div className="flex items-start justify-between gap-x2">
                      <div className="flex min-w-0 flex-col gap-x1">
                        <div className="flex flex-wrap items-center gap-x2">
                          <Badge variant="weak" tone={KIND_BADGE_TONE[kind]}>{KIND_LABEL[kind]}</Badge>
                          {t.link_type && (
                            <Badge variant="outline" className={LINK_BADGE_CLASS}>
                              <Icon svg={<IconPaperclipLine />} size="x3" />
                              {LINK_LABEL[t.link_type]}
                            </Badge>
                          )}
                          <span className="t2-regular tabular-nums text-fg-neutral-muted">
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
                    <div className="mt-x2 flex items-end justify-between gap-x2">
                      <div className="flex min-w-0 flex-col t2-regular text-fg-neutral-muted">
                        <span className="truncate">
                          {account}
                          {t.member_name ? ` · ${t.member_name}` : ''}
                        </span>
                        {t.memo && <span className="truncate">{t.memo}</span>}
                      </div>
                      <div className="flex shrink-0 items-center gap-x2">
                        {bundle ? (
                          <ActionButton
                            variant="ghost"
                            size="small" layout="iconOnly"
                            className={touchTarget}
                            aria-label="묶음 보기"
                            onClick={() => openView(t)}
                          >
                            <Icon svg={<IconEyeLine />} />
                          </ActionButton>
                        ) : (
                          <>
                            <ActionButton
                              variant="ghost"
                              size="small" layout="iconOnly"
                              className={touchTarget}
                              aria-label="거래 수정"
                              onClick={() => openEdit(t)}
                            >
                              <Icon svg={<IconPencilLine />} />
                            </ActionButton>
                            <ActionButton
                              variant="ghost"
                              size="small" layout="iconOnly"
                              className={touchTarget}
                              aria-label="거래 삭제"
                              onClick={() =>
                                remove(t.id).catch((e: Error) => setPageError(e.message))
                              }
                            >
                              <Icon svg={<IconTrashcanLine />} />
                            </ActionButton>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-end gap-x2">
            <span className="t4-regular text-fg-neutral-muted">
              {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}{' '}
              페이지
            </span>
            <ActionButton
              variant="neutralOutline"
              size="small"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              이전
            </ActionButton>
            <ActionButton
              variant="neutralOutline"
              size="small"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              다음
            </ActionButton>
          </div>
        </>
      ) : (
        <div className="space-y-(--dimension-x4)">
          <div className="flex items-center justify-center gap-x2">
            <ActionButton variant="neutralOutline" size="medium" layout="iconOnly" onClick={() => moveCalendarMonth(-1)}>
              <Icon svg={<IconChevronLeftLine />} />
            </ActionButton>
            <span className="w-24 text-center font-medium tabular-nums">{calendarMonth}</span>
            <ActionButton variant="neutralOutline" size="medium" layout="iconOnly" onClick={() => moveCalendarMonth(1)}>
              <Icon svg={<IconChevronRightLine />} />
            </ActionButton>
          </div>
          {(filters.kind || filters.major || filters.category_id) && (
            <p className="text-center t2-regular text-fg-neutral-muted">
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
            onMonthChange={setCalendarMonth}
          />
          {dayRows && (
            <div className="space-y-(--dimension-x2) rounded-r2 border p-x4">
              <p className="t4-medium">{selectedDate} 거래</p>
              {dayRows.length === 0 && (
                <p className="t4-regular text-fg-neutral-muted">이 날의 거래가 없습니다.</p>
              )}
              {dayRows.map((t) => {
                const bundle = isBundle(t)
                const disp = bundle ? bundleDisplay(t) : null
                const kind = disp ? disp.kind : t.kind
                const amount = disp ? disp.amount : t.amount
                const category = disp ? disp.category_name : t.category_name
                const account = accountText(t)
                return (
                  <div key={t.id} className="flex items-center justify-between gap-x2 t4-regular">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-x2 gap-y-x0_5">
                      <Badge variant="weak" tone={KIND_BADGE_TONE[kind]}>{KIND_LABEL[kind]}</Badge>
                      {t.link_type && (
                        <Badge variant="outline" className={LINK_BADGE_CLASS}>
                          <Icon svg={<IconPaperclipLine />} size="x3" />
                          {LINK_LABEL[t.link_type]}
                        </Badge>
                      )}
                      <span className="min-w-0 truncate">{category}</span>
                      <span className="min-w-0 truncate t2-regular text-fg-neutral-muted">
                        {account}
                      </span>
                      {t.memo && (
                        <span className="min-w-0 truncate t2-regular text-fg-neutral-muted">{t.memo}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-x2">
                      <span className={kindAmountClass(kind)}>
                        {kindAmountSign(kind)}
                        {formatNumber(amount)}
                      </span>
                      {bundle ? (
                        <ActionButton
                          variant="ghost"
                          size="small" layout="iconOnly"
                          className={touchTarget}
                          aria-label="묶음 보기"
                          onClick={() => openView(t)}
                        >
                          <Icon svg={<IconEyeLine />} />
                        </ActionButton>
                      ) : (
                        <>
                          <ActionButton
                            variant="ghost"
                            size="small" layout="iconOnly"
                            className={touchTarget}
                            aria-label="거래 수정"
                            onClick={() => openEdit(t)}
                          >
                            <Icon svg={<IconPencilLine />} />
                          </ActionButton>
                          <ActionButton
                            variant="ghost"
                            size="small" layout="iconOnly"
                            className={touchTarget}
                            aria-label="거래 삭제"
                            onClick={() => remove(t.id).catch((e: Error) => setPageError(e.message))}
                          >
                            <Icon svg={<IconTrashcanLine />} />
                          </ActionButton>
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

      <ResponsiveSidePanelRoot open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveSidePanelContent
          title={editing ? '거래 수정' : '거래 추가'}
          description={editing ? '거래 내용을 수정합니다.' : '새 지출/수입/이체 거래를 기록합니다.'}
        >
          {/* 필드가 많아 짧은 뷰포트에서 넘친다 — DialogBody가 자체적으로 본문만 스크롤시킨다 */}
          <ResponsiveSidePanelBody>
            <div className="flex flex-col gap-x4">
              <div className="grid grid-cols-2 gap-x3">
                <DateField
                  label="날짜"
                  value={form.date}
                  onChange={(date) => setForm({ ...form, date })}
                />
                <TimeField
                  label="시간 (선택)"
                  placeholder="시간 없음"
                  clearable
                  value={form.time}
                  onChange={(time) => setForm({ ...form, time })}
                />
                <SelectRoot size="responsive"
                  label="구분"
                  value={[form.kind]}
                  onValueChange={([v]) =>
                    setForm({
                      ...form,
                      kind: v as TransactionKind,
                      category_major: '',
                      category_id: '',
                      counter_account_id: '',
                    })
                  }
                >
                  <SelectTrigger aria-label="구분" />
                  <SelectContent>
                    <SelectGroup>
                              <SelectItem value="expense" label="지출" />
                        <SelectItem value="income" label="수입" />
                        <SelectItem value="transfer" label="이체" />
                      </SelectGroup>
                  </SelectContent>
                </SelectRoot>
              </div>
              <TextField size="responsive"
                label="금액 (원)"
                value={form.amount}
                onValueChange={({ value }) => setForm({ ...form, amount: value })}
              >
                <TextFieldInput type="number" min={1} placeholder="예: 15000" />
              </TextField>
              <div className="grid grid-cols-2 gap-x3">
                <SelectRoot size="responsive"
                  label="대분류"
                  value={form.category_major ? [form.category_major] : []}
                  onValueChange={([v]) =>
                    setForm({ ...form, category_major: v ?? '', category_id: '' })
                  }
                >
                  <SelectTrigger aria-label="대분류" placeholder="선택" />
                  <SelectContent>
                    <SelectGroup>
                        {formMajors.map((m) => (
                          <SelectItem key={m} value={m} label={m} />
                        ))}
                      </SelectGroup>
                  </SelectContent>
                </SelectRoot>
                <SelectRoot size="responsive"
                  label="소분류"
                  value={form.category_id ? [form.category_id] : []}
                  onValueChange={([v]) => setForm({ ...form, category_id: v ?? '' })}
                >
                  <SelectTrigger
                    aria-label="소분류"
                    placeholder={form.category_major ? '선택' : '대분류 먼저'}
                  />
                  <SelectContent>
                    <SelectGroup>
                        {formMinors.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)} label={c.minor} />
                        ))}
                      </SelectGroup>
                  </SelectContent>
                </SelectRoot>
              </div>
              <div className="grid grid-cols-2 gap-x3">
                <SelectRoot size="responsive"
                  label={form.kind === 'transfer' ? '출금 계정' : '자산 계정'}
                  value={form.account_id ? [form.account_id] : []}
                  onValueChange={([v]) => {
                    // 간편결제가 아닌 계정으로 바꾸면 건별 연결은 의미가 없어져 비운다
                    const isEasyPay = accounts.find((a) => String(a.id) === v)?.type === 'easy_pay'
                    setForm({
                      ...form,
                      account_id: v ?? '',
                      linked_account_id: isEasyPay ? form.linked_account_id : 'none',
                    })
                  }}
                >
                  <SelectTrigger aria-label="자산 계정" placeholder="선택" />
                  <SelectContent>
                    <SelectGroup>
                        {accounts
                          .filter((a) => a.is_active)
                          .map((a) => (
                            <SelectItem key={a.id} value={String(a.id)} label={a.name} />
                          ))}
                      </SelectGroup>
                  </SelectContent>
                </SelectRoot>
                {form.kind === 'transfer' && (
                  <SelectRoot size="responsive"
                    label="입금 계정"
                    value={form.counter_account_id ? [form.counter_account_id] : []}
                    onValueChange={([v]) => setForm({ ...form, counter_account_id: v ?? '' })}
                  >
                    <SelectTrigger aria-label="입금 계정" placeholder="선택" />
                    <SelectContent>
                      <SelectGroup>
                          {accounts
                            .filter((a) => a.is_active && String(a.id) !== form.account_id)
                            .map((a) => (
                              <SelectItem key={a.id} value={String(a.id)} label={a.name} />
                            ))}
                        </SelectGroup>
                    </SelectContent>
                  </SelectRoot>
                )}
                {formAccountIsEasyPay && (
                  <div className="col-span-2">
                    <SelectRoot size="responsive"
                      label="연결 계정 (선택)"
                      description="이 건이 실제로 결제된 카드/은행 계정이에요. 고르지 않으면 계정에 설정된 기본 연결을 따라가요."
                      value={[form.linked_account_id]}
                      onValueChange={([v]) => setForm({ ...form, linked_account_id: v })}
                    >
                      <SelectTrigger aria-label="연결 계정" />
                      <SelectContent>
                        <SelectGroup>
                              <SelectItem value="none" label="선택 안 함 (계정 기본 연결)" />
                            {linkableAccounts.map((a) => (
                              <SelectItem key={a.id} value={String(a.id)} label={a.name} />
                            ))}
                          </SelectGroup>
                      </SelectContent>
                    </SelectRoot>
                  </div>
                )}
                <SelectRoot size="responsive"
                  label="구성원"
                  value={[form.member_id]}
                  onValueChange={([v]) => setForm({ ...form, member_id: v })}
                >
                  <SelectTrigger aria-label="구성원" />
                  <SelectContent>
                    <SelectGroup>
                              <SelectItem value="none" label="선택 안 함" />
                        {members.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)} label={m.name} />
                        ))}
                      </SelectGroup>
                  </SelectContent>
                </SelectRoot>
                <div className="col-span-2">
                  <TextField size="responsive"
                    label="메모"
                    value={form.memo}
                    onValueChange={({ value }) => setForm({ ...form, memo: value })}
                  >
                    <TextFieldInput placeholder="선택 입력" />
                  </TextField>
                </div>
              </div>
              {formError && <p className="t4-regular text-fg-critical">{formError}</p>}
            </div>
          </ResponsiveSidePanelBody>
          {/* "묶음" 진입 버튼 — 수정 중이며 아직 묶이지 않은 수입/지출일 때만.
              이체는 묶음(수입+지출) 대상이 아니고, 이미 묶인 거래는 해제 후 수정하도록 안내한다. */}
          <ResponsiveSidePanelFooter>
            <VStack gap="x2">
              {editing && !editing.link_id && editing.kind !== 'transfer' && (
                <ActionButton variant="neutralOutline" onClick={() => openLinkPicker(editing)}>
                  <PrefixIcon svg={<IconPaperclipLine />} />
                  묶음
                </ActionButton>
              )}
              {editing?.link_id && (
                <p className="t2-regular text-center text-fg-neutral-muted">
                  묶음을 해제한 뒤 수정할 수 있어요
                </p>
              )}
              <ResponsivePair gap="x2">
                <ActionButton variant="neutralWeak" onClick={() => setDialogOpen(false)}>
                  취소
                </ActionButton>
                {/* 검증 실패 시 패널을 열어둬야 하므로 자동 닫힘이 없는 ActionButton을 쓴다 */}
                <ActionButton variant="neutralSolid" onClick={submit}>
                  {editing ? '수정' : '추가'}
                </ActionButton>
              </ResponsivePair>
            </VStack>
          </ResponsiveSidePanelFooter>
        </ResponsiveSidePanelContent>
      </ResponsiveSidePanelRoot>

      <ResponsiveSidePanelRoot open={importOpen} onOpenChange={setImportOpen}>
        {/* 계정 매핑/검토 단계는 표가 넓어 다이얼로그 폭을 넓힌다 */}
        <ResponsiveSidePanelContent
          maxWidth={importPreview && !importResult ? '42rem' : '28rem'}
          title={
              importResult
                ? '엑셀 업로드'
                : importStep === 'accounts'
                  ? '자산 계정 매핑 (1/2)'
                  : importStep === 'review'
                    ? previewReview.length > 0
                      ? '이체 내역 검토 (2/2)'
                      : '업로드 내용 확인 (2/2)'
                    : '엑셀 업로드'
          }
          description={
              importResult
                ? '뱅크샐러드 내보내기 파일의 "가계부 내역"에서 선택한 달만 가져옵니다.'
                : importStep === 'accounts'
                  ? '엑셀에 등장하는 계정을 먼저 정리해요. 기존 계정에 연결하거나, 새로 만들거나, 이번엔 제외할 수 있어요.'
                  : importStep === 'review'
                    ? previewReview.length > 0
                      ? '이체 타입 행은 자동 반영되지 않아요. 행마다 처리 방법을 정해주세요.'
                      : '아래 내용으로 가져올게요. 확인 후 진행해주세요.'
                    : '뱅크샐러드 내보내기 파일의 "가계부 내역"에서 선택한 달만 가져옵니다.'
          }
        >
          <ResponsiveSidePanelBody>
          {importResult ? (
            <div className="space-y-(--dimension-x3) t4-regular">
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
                <p className="text-fg-neutral-muted">
                  새 카테고리: {importResult.created_categories.join(', ')}
                </p>
              )}
              {importCreatedAccounts.length > 0 && (
                <p className="text-fg-neutral-muted">
                  새 자산 계정: {importCreatedAccounts.join(', ')}
                </p>
              )}
              {importResult.valuation_count > 0 && (
                <p className="text-fg-neutral-muted">
                  부동산 평가액 {importResult.valuation_count}건을 오늘 날짜로 반영했어요.
                </p>
              )}
              {importResult.loan_count > 0 && (
                <p className="text-fg-neutral-muted">
                  대출 잔액 {importResult.loan_count}건을 오늘 날짜로 반영했어요.
                </p>
              )}
              {/* 다이얼로그 본문 전체가 스크롤되므로 여기서 다시 스크롤하지 않는다 */}
              {importResult.skipped.length > 0 && (
                <div className="space-y-(--dimension-x1) rounded-r1_5 border p-x2">
                  {importResult.skipped.map((s) => (
                    <p key={s.row} className="t2-regular text-fg-neutral-muted">
                      {s.row}행: {s.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : importPreview && importStep === 'accounts' ? (
            <div className="space-y-(--dimension-x3) t4-regular">
              <p className="t2-regular text-fg-neutral-muted">
                엑셀에 나온 계정 {importPreview.account_sources.length}개예요. 여기서 확정하면
                계정이 바로 만들어져요 (업로드를 취소해도 계정은 남고, 설정에서 지울 수 있어요).
              </p>
              <div className="space-y-(--dimension-x2)">
                {importPreview.account_sources.map((s) => {
                  const key = sourceKey(s)
                  const choice = mappingChoices[key]
                  const candidates = mappingCandidates(s)
                  const requiredType = SOURCE_REQUIRED_TYPE[s.kind]
                  return (
                    <div key={key} className="space-y-(--dimension-x2) rounded-r1_5 border p-x2">
                      <div className="flex flex-wrap items-center justify-between gap-x-x2 gap-y-x1">
                        <span className="flex min-w-0 items-center gap-x1">
                          <Badge variant="weak">{SOURCE_KIND_LABEL[s.kind]}</Badge>
                          <span className="truncate font-medium">{s.name}</span>
                        </span>
                        <span className="shrink-0 t2-regular text-fg-neutral-muted tabular-nums">
                          {s.kind === 'ledger'
                            ? `${s.row_count}건`
                            : s.amount !== null
                              ? `${s.kind === 'liability' ? '-' : ''}${formatKRW(s.amount)}`
                              : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x2">
                        <SelectRoot size="responsive"
                          value={[choice?.action ?? 'create']}
                          onValueChange={([v]) =>
                            setMappingChoices((prev) => ({
                              ...prev,
                              [key]: {
                                ...prev[key],
                                action: v as ImportMappingAction,
                                account_id:
                                  v === 'link'
                                    ? (prev[key]?.account_id ??
                                      (s.matched_account_id ? String(s.matched_account_id) : ''))
                                    : '',
                              },
                            }))
                          }
                        >
                          <SelectTrigger className="w-32" />
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem
                                value="link"
                                disabled={candidates.length === 0}
                                label="기존 계정 연결"
                              />
                              <SelectItem value="create" label="새로 만들기" />
                              <SelectItem value="exclude" label="이번엔 제외" />
                            </SelectGroup>
                          </SelectContent>
                        </SelectRoot>
                        {choice?.action === 'link' && (
                          <SelectRoot size="responsive"
                            value={choice.account_id ? [choice.account_id] : []}
                            onValueChange={([v]) =>
                              setMappingChoices((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], account_id: v },
                              }))
                            }
                          >
                            <SelectTrigger placeholder="연결할 계정" className="w-44" />
                            <SelectContent>
                              <SelectGroup>                                {/* 같은 이름·다른 유형 계정이 공존할 수 있어(복합 유니크) 유형을
                                    함께 보여야 고를 수 있다. 비활성 계정도 후보에 남으므로 표시 */}
                                {candidates.map((a) => (
                                  <SelectItem
                                    key={a.id}
                                    value={String(a.id)}
                                    label={`${a.name} · ${accountTypeLabel(a.type)}${
                                      a.is_active ? '' : ' (비활성)'
                                    }`}
                                  />
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </SelectRoot>
                        )}
                        {choice?.action === 'create' &&
                          (requiredType ? (
                            // 부동산·대출 항목은 유형이 고정이라 선택지를 주지 않는다
                            <span className="t2-regular text-fg-neutral-muted">
                              {SOURCE_KIND_LABEL[s.kind]} 계정으로 생성
                            </span>
                          ) : (
                            <SelectRoot size="responsive"
                              value={[choice.type]}
                              onValueChange={([v]) =>
                                setMappingChoices((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], type: v as AccountType },
                                }))
                              }
                            >
                              <SelectTrigger className="w-36" />
                              {/* 간편결제도 연결 계정 없이 만들 수 있어 전 유형을 고를 수 있다 */}
                              <SelectContent>
                                <SelectGroup>                                  {ACCOUNT_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value} label={t.label} />
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </SelectRoot>
                          ))}
                      </div>
                      {choice?.action === 'exclude' && (
                        <p className="t2-regular text-fg-warning">
                          {s.kind === 'ledger'
                            ? '이 결제수단의 거래는 이번 업로드에서 등록되지 않아요.'
                            : '이 항목은 이번 업로드에서 반영되지 않아요.'}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
              {importError && <p className="t4-regular text-fg-critical">{importError}</p>}
            </div>
          ) : importPreview ? (
            <div className="space-y-(--dimension-x3) t4-regular">
              <p className="t2-regular text-fg-neutral-muted">
                {previewReview.length > 0 ? (
                  <>
                    수입/지출 {previewImportableCount}건은 바로 등록돼요. 아래 이체{' '}
                    {previewReview.length}건만 정해주시면 돼요 — 내계좌이체 짝이 맞는 행은
                    자동으로 한 건의 이체가 돼요.
                  </>
                ) : (
                  <>수입/지출 {previewImportableCount}건을 등록할게요.</>
                )}
              </p>
              {resolvedMappings.some((m) => m.action === 'exclude') && (
                <p className="t2-regular text-fg-warning">
                  제외한 계정({resolvedMappings
                    .filter((m) => m.action === 'exclude')
                    .map((m) => m.name)
                    .join(', ')})의 내역은 등록되지 않아요.
                </p>
              )}
              {previewValuations.length > 0 && (
                <div className="space-y-(--dimension-x1) rounded-r1_5 border p-x2">
                  <p className="t2-medium">
                    반영될 평가액 — 부동산 {previewValuations.length}건 (오늘 날짜)
                  </p>
                  <div className="space-y-(--dimension-x1)">
                    {previewValuations.map((v, i) => (
                      <div
                        key={`${i}-${v.account_type}-${v.product_name}`}
                        className="flex items-center justify-between gap-x2 t2-regular"
                      >
                        <span className="flex min-w-0 items-center gap-x1 text-fg-neutral-muted">
                          <Badge variant="weak">
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
              {previewLiabilities.length > 0 && (
                <div className="space-y-(--dimension-x1) rounded-r1_5 border p-x2">
                  <p className="t2-medium">
                    반영될 대출 잔액 — {previewLiabilities.length}건 (오늘 날짜, 총자산 차감)
                  </p>
                  <div className="space-y-(--dimension-x1)">
                    {previewLiabilities.map((v, i) => (
                      <div
                        key={`${i}-loan-${v.product_name}`}
                        className="flex items-center justify-between gap-x2 t2-regular"
                      >
                        <span className="flex min-w-0 items-center gap-x1 text-fg-neutral-muted">
                          <Badge variant="weak">대출</Badge>
                          <span className="truncate">{v.product_name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-fg-critical">
                          -{formatKRW(v.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 다이얼로그 본문 전체가 스크롤되므로 여기서 다시 스크롤하지 않는다 */}
              <div className="space-y-(--dimension-x2)">
                {previewReview.map((r) => {
                  const decision = reviewDecisions[r.row]
                  const pairAuto = isPairAuto(r.row, r.pair_row)
                  const pairRow = r.pair_row
                    ? previewReview.find((p) => p.row === r.pair_row)
                    : undefined
                  return (
                    <div key={r.row} className="space-y-(--dimension-x2) rounded-r1_5 border p-x2">
                      <div className="flex flex-wrap items-center justify-between gap-x-x2 gap-y-x1 t2-regular">
                        <span className="text-fg-neutral-muted">
                          {r.date} · {r.minor === '미분류' ? r.major : `${r.major} > ${r.minor}`}{' '}
                          · {r.account_name}
                        </span>
                        <span className={r.amount > 0 ? 'text-fg-positive' : 'text-fg-critical'}>
                          {r.amount > 0 ? '+' : ''}
                          {formatKRW(r.amount)}
                        </span>
                      </div>
                      {r.description && (
                        <p className="truncate t2-regular text-fg-neutral-muted">{r.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x2">
                        <SelectRoot size="responsive"
                          value={[decision?.action ?? r.suggested]}
                          onValueChange={([v]) =>
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
                          <SelectTrigger className="w-28" />
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="income" label="수입" />
                              <SelectItem value="expense" label="지출" />
                              <SelectItem value="transfer" label="이체" />
                              <SelectItem value="skip" label="건너뛰기" />
                            </SelectGroup>
                          </SelectContent>
                        </SelectRoot>
                        {decision?.action === 'transfer' &&
                          (pairAuto ? (
                            <span className="t2-regular text-fg-informative">
                              자동 페어 ↔ {pairRow?.account_name} ({r.pair_row}행)
                            </span>
                          ) : (
                            <SelectRoot size="responsive"
                              value={decision.counter_account_id ? [decision.counter_account_id] : []}
                              onValueChange={([v]) =>
                                setReviewDecisions((prev) => ({
                                  ...prev,
                                  [r.row]: { ...prev[r.row], counter_account_id: v },
                                }))
                              }
                            >
                              <SelectTrigger placeholder={r.amount < 0 ? '입금받을 계정' : '출금된 계정'} className="w-44" />
                              <SelectContent>
                                <SelectGroup>                                  {accounts
                                    .filter((a) => a.is_active && a.name !== r.account_name)
                                    .map((a) => (
                                      <SelectItem key={a.id} value={String(a.id)} label={a.name} />
                                    ))}
                                </SelectGroup>
                              </SelectContent>
                            </SelectRoot>
                          ))}
                      </div>
                      {r.major === '카드대금' && decision?.action === 'expense' && (
                        <p className="t2-regular text-fg-warning">
                          ⚠️ 카드대금을 지출로 등록하면 카드 사용 내역과 이중 계산돼요 —
                          이체(상대: 카드 계정)를 권장해요.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
              {importError && <p className="t4-regular text-fg-critical">{importError}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-x4">
              {/* 파일 입력은 네이티브를 그대로 쓴다 — SEED의 AttachmentField는 이미지 첨부용이다 */}
              <div className="flex flex-col gap-x1">
                <label className="t4-medium" htmlFor="import-file">
                  엑셀 파일 (.xlsx)
                </label>
                <input
                  id="import-file"
                  type="file"
                  accept=".xlsx"
                  className="t4-regular rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default p-x2 file:mr-x2 file:rounded-r1_5 file:border-0 file:bg-bg-neutral-weak file:px-x2 file:py-x1 file:text-fg-neutral"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="w-40">
                <MonthField label="가져올 월" value={importMonth} onChange={setImportMonth} />
              </div>
              <SelectRoot size="responsive"
                label="구성원"
                description="업로드되는 모든 거래가 이 구성원의 거래로 기록돼요. 엑셀에 처음 등장하는 자산 계정도 이 구성원의 소유로 생성돼요."
                value={importMemberId ? [importMemberId] : []}
                onValueChange={([v]) => setImportMemberId(v ?? '')}
              >
                <SelectTrigger aria-label="구성원" placeholder="선택" />
                <SelectContent>
                  <SelectGroup>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)} label={m.name} />
                    ))}
                  </SelectGroup>
                </SelectContent>
              </SelectRoot>
              <p className="t2-regular text-fg-neutral-muted">
                해당 월에 같은 구성원으로 업로드한 내역이 있으면 삭제 후 다시 등록돼요. 다른
                구성원의 업로드 내역과 직접 입력한 거래는 그대로 유지됩니다.
              </p>
              {importError && <p className="t4-regular text-fg-critical">{importError}</p>}
            </div>
          )}
          </ResponsiveSidePanelBody>
          <ResponsiveSidePanelFooter>
            {importResult ? (
              <ActionButton variant="neutralSolid" onClick={() => setImportOpen(false)}>
                닫기
              </ActionButton>
            ) : importPreview && importStep === 'accounts' ? (
              <ResponsivePair gap="x2">
                <ActionButton
                  variant="neutralOutline"
                  onClick={() => {
                    setImportPreview(null)
                    setImportStep('form')
                    setResolvedMappings([])
                    setImportError(null)
                  }}
                >
                  이전
                </ActionButton>
                <ActionButton variant="neutralSolid" onClick={confirmAccounts} loading={importing}>
                  계정 확정하고 다음
                </ActionButton>
              </ResponsivePair>
            ) : importPreview ? (
              <ResponsivePair gap="x2">
                <ActionButton
                  variant="neutralOutline"
                  onClick={() => {
                    setImportError(null)
                    // 계정 소스가 있으면 매핑 스텝으로, 없으면 입력 화면으로 되돌아간다
                    if (importPreview.account_sources.length > 0) {
                      setImportStep('accounts')
                    } else {
                      setImportPreview(null)
                      setImportStep('form')
                    }
                  }}
                >
                  이전
                </ActionButton>
                <ActionButton variant="neutralSolid" onClick={confirmReview} loading={importing}>
                  확정하고 가져오기
                </ActionButton>
              </ResponsivePair>
            ) : (
              <ResponsivePair gap="x2">
                <ActionButton variant="neutralWeak" onClick={() => setImportOpen(false)}>
                  취소
                </ActionButton>
                <ActionButton variant="neutralSolid" onClick={runImport} loading={importing}>
                  업로드
                </ActionButton>
              </ResponsivePair>
            )}
          </ResponsiveSidePanelFooter>
        </ResponsiveSidePanelContent>
      </ResponsiveSidePanelRoot>

      {/* 되돌릴 수 없는 일괄 삭제라 Dialog가 아니라 AlertDialog를 쓴다 */}
      <AlertDialogRoot open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>월 전체 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {filters.month} 거래 {items.length}건을 삭제할게요. 되돌릴 수 없어요.
              {/* 현재 화면 필터에 걸리는 것만 지우므로, 어떤 필터가 걸려 있는지 밝힌다 */}
              {bulkDeleteScope.length > 0 &&
                ` 적용 중인 필터: ${bulkDeleteScope.join(' · ')} — 이 조건에 맞는 거래만 삭제돼요.`}
              {bulkDeleteError ? ` (${bulkDeleteError})` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <ResponsivePair gap="x2">
              <AlertDialogAction variant="neutralWeak" onClick={() => setBulkDeleteOpen(false)}>
                취소
              </AlertDialogAction>
              <ActionButton
                variant="criticalSolid"
                onClick={confirmBulkDelete}
                loading={bulkDeleting}
              >
                {items.length}건 삭제
              </ActionButton>
            </ResponsivePair>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>

      {/* 연결 대상 선택 — 수정 모달 "묶음" 버튼에서 진입. 현재 목록의 반대 구분 후보를 고른다.
          본문만 스크롤(후보가 많을 수 있음), 헤더/푸터 고정 */}
      <ResponsiveSidePanelRoot open={linkPickerOpen} onOpenChange={setLinkPickerOpen}>
        <ResponsiveSidePanelContent
          title="연결할 거래 선택"
          description="현재 목록에서 묶을 상대 거래를 골라 하나의 묶음으로 연결해요. 원본은 그대로 남고 통계에만 반영돼요."
        >
          <ResponsiveSidePanelBody>
            <div className="space-y-(--dimension-x3) t4-regular">
              {linkSource && (
                <div className="space-y-(--dimension-x1) rounded-r1_5 border p-x2 t2-regular">
                  <p className="font-medium">묶을 기준 거래</p>
                  <div className="flex items-center justify-between gap-x2">
                    <span className="min-w-0 truncate text-fg-neutral-muted">
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
              <div className="space-y-(--dimension-x1)">
                <p className="t2-regular text-fg-neutral-muted">
                  현재 목록에서 연결할 {linkSource?.kind === 'expense' ? '수입' : '지출'} 거래를
                  고르세요.
                </p>
                {linkCandidates.length === 0 ? (
                  <p className="rounded-r1_5 border py-x6 text-center t2-regular text-fg-neutral-muted">
                    현재 목록에 묶을 수 있는{' '}
                    {linkSource?.kind === 'expense' ? '수입' : '지출'} 거래가 없어요. 조회 월·필터를
                    옮겨 상대 거래가 보이게 한 뒤 다시 시도해주세요.
                  </p>
                ) : (
                  <div className="space-y-(--dimension-x1)">
                    {linkCandidates.map((c) => {
                      const active = linkTarget?.id === c.id
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectCandidate(c)}
                          className={cn(
                            'flex w-full items-center justify-between gap-x2 rounded-r1_5 border p-x2 text-left t2-regular transition-colors hover:bg-bg-neutral-weak',
                            active && 'border-stroke-brand-solid bg-bg-neutral-weak',
                          )}
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate">
                              {c.date}
                              {c.time && ` ${formatTime(c.time)}`} · {c.category_name}
                            </span>
                            <span className="truncate text-fg-neutral-muted">
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
                  <SelectRoot size="responsive"
                    label="묶음 유형"
                    value={[linkType]}
                    onValueChange={([v]) => setLinkType(v as LinkType)}
                  >
                    <SelectTrigger aria-label="묶음 유형" />
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="transfer" label="이체 (계좌 간 이동)" />
                        <SelectItem value="refund" label="환불 (결제 취소)" />
                      </SelectGroup>
                    </SelectContent>
                  </SelectRoot>
                  {linkType === 'transfer' ? (
                    <p className="t2-regular text-fg-neutral-muted">
                      {linkExpense.account_name} → {linkIncome.account_name} 이체로 묶어요. 두 건
                      모두 수입/지출 통계에서 빠지고, 계정 잔액은 그대로 유지돼요.
                      {linkIncome.amount !== linkExpense.amount && (
                        <span className="mt-x1 block text-fg-warning">
                          ⚠️ 두 거래의 금액이 달라 이체로 묶을 수 없어요.
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="t2-regular text-fg-neutral-muted">
                      지출에서 환불액을 뺀 순지출{' '}
                      <span className="tabular-nums text-fg-neutral">
                        {formatKRW(Math.max(linkExpense.amount - linkIncome.amount, 0))}
                      </span>
                      만 통계에 반영되고, 환불 수입은 수입 합계에서 빠져요.
                      {linkIncome.amount > linkExpense.amount && (
                        <span className="mt-x1 block text-fg-warning">
                          ⚠️ 환불 금액이 지출 금액보다 커서 묶을 수 없어요.
                        </span>
                      )}
                    </p>
                  )}
                </>
              )}
              {linkError && <p className="t4-regular text-fg-critical">{linkError}</p>}
            </div>
          </ResponsiveSidePanelBody>
          <ResponsiveSidePanelFooter>
            <ResponsivePair gap="x2">
              <ActionButton variant="neutralWeak" onClick={() => setLinkPickerOpen(false)}>
                취소
              </ActionButton>
              <ActionButton
                variant="neutralSolid"
                onClick={confirmLink}
                loading={linking}
                disabled={!linkTarget}
              >
                묶기
              </ActionButton>
            </ResponsivePair>
          </ResponsiveSidePanelFooter>
        </ResponsiveSidePanelContent>
      </ResponsiveSidePanelRoot>

      {/* 묶음 보기 — 병합 행에서 두 다리 상세 확인 + 해제 */}
      <ResponsiveSidePanelRoot open={viewOpen} onOpenChange={setViewOpen}>
        <ResponsiveSidePanelContent
          title="묶음 보기"
          description={`${viewTx?.link_type ? LINK_LABEL[viewTx.link_type] : '묶음'}으로 연결된 두 거래예요. 해제하면 각각 개별 거래로 돌아가요.`}
        >
          <ResponsiveSidePanelBody>
          {viewTx &&
            isBundle(viewTx) &&
            (() => {
              const { expense, income } = bundleLegs(viewTx)
              return (
                <div className="min-w-0 space-y-(--dimension-x3) t4-regular">
                  {/* 지출 다리 */}
                  <div className="space-y-(--dimension-x1) rounded-r1_5 border p-x2 t2-regular">
                    <div className="flex items-center justify-between gap-x2">
                      <span className="flex min-w-0 items-center gap-x1">
                        <Badge variant="weak" tone="critical">
                          {KIND_LABEL.expense}
                        </Badge>
                        <span className="truncate">{expense.category_name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-fg-critical">
                        -{formatNumber(expense.amount)}
                      </span>
                    </div>
                    <p className="truncate text-fg-neutral-muted">
                      {expense.date}
                      {expense.time && ` ${formatTime(expense.time)}`} · {legAccountText(expense)}
                      {expense.memo ? ` · ${expense.memo}` : ''}
                    </p>
                  </div>
                  {/* 수입 다리 */}
                  <div className="space-y-(--dimension-x1) rounded-r1_5 border p-x2 t2-regular">
                    <div className="flex items-center justify-between gap-x2">
                      <span className="flex min-w-0 items-center gap-x1">
                        <Badge variant="weak" tone="positive">
                          {KIND_LABEL.income}
                        </Badge>
                        <span className="truncate">{income.category_name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-fg-positive">
                        +{formatNumber(income.amount)}
                      </span>
                    </div>
                    <p className="truncate text-fg-neutral-muted">
                      {income.date}
                      {income.time && ` ${formatTime(income.time)}`} · {legAccountText(income)}
                      {income.memo ? ` · ${income.memo}` : ''}
                    </p>
                  </div>
                  {/* 유형별 효과 요약 */}
                  <p className="t2-regular text-fg-neutral-muted">
                    {viewTx.link_type === 'transfer' ? (
                      '두 건 모두 수입/지출 통계에서 빠지고, 계정 잔액은 그대로예요.'
                    ) : (
                      <>
                        지출에서 환불액을 뺀 순지출{' '}
                        <span className="tabular-nums text-fg-neutral">
                          {formatKRW(Math.max(expense.amount - income.amount, 0))}
                        </span>
                        만 통계에 반영돼요.
                      </>
                    )}
                  </p>
                  {viewError && <p className="t4-regular text-fg-critical">{viewError}</p>}
                </div>
              )
            })()}
          </ResponsiveSidePanelBody>
          <ResponsiveSidePanelFooter>
            <ResponsivePair gap="x2">
              <ActionButton
                variant="neutralOutline"
                className="text-fg-critical"
                onClick={confirmUnlink}
                loading={unlinking}
              >
                <PrefixIcon svg={<IconScissorsLine />} />
                묶음 해제
              </ActionButton>
              <ActionButton variant="neutralSolid" onClick={() => setViewOpen(false)}>
                닫기
              </ActionButton>
            </ResponsivePair>
          </ResponsiveSidePanelFooter>
        </ResponsiveSidePanelContent>
      </ResponsiveSidePanelRoot>
    </div>
  )
}
