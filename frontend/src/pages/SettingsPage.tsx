import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  IconChevronDownSmallLine,
  IconChevronRightSmallLine,
  IconPencilLine,
  IconPlusLine,
  IconTrashcanLine,
} from '@karrotmarket/react-monochrome-icon'
import { Badge, Icon, Portal, PrefixIcon, ResponsivePair } from '@seed-design/react'
import { ActionButton } from 'seed-design/ui/action-button'
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
import { Switch } from 'seed-design/ui/switch'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'seed-design/ui/tabs'
import { TextField, TextFieldInput } from 'seed-design/ui/text-field'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ACCOUNT_TYPES, accountTypeLabel, formatKRW, KIND_LABEL } from '@/lib/format'
import { useAISettingsStore } from '@/stores/aiSettings'
import { useMasterDataStore } from '@/stores/masterData'
import type { Account, AccountType, Category, CategoryNature, Member, TransactionKind } from '@/types'

/** 간편결제 계정이 연결할 수 있는 실물 자산 유형 — 백엔드 LINKABLE_TYPES와 일치 */
const LINKABLE_TYPES: AccountType[] = ['card', 'bank']

// ---------- 카테고리 탭 ----------
function CategoriesTab() {
  const { categories, createCategory, updateCategory, deleteCategory } = useMasterDataStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [major, setMajor] = useState('')
  const [minor, setMinor] = useState('')
  const [kind, setKind] = useState<TransactionKind>('expense')
  const [nature, setNature] = useState<CategoryNature>('variable')
  const [error, setError] = useState<string | null>(null)
  // 접힌 그룹의 (kind, major) 키 집합 — 비어 있으면 전체 펼침
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // 대분류 입력 자동완성용 — 같은 구분의 기존 대분류 목록
  const majorOptions = [...new Set(categories.filter((c) => c.kind === kind).map((c) => c.major))]

  // 백엔드가 kind → major → minor 순으로 정렬해 주므로 연속 구간을 그대로 그룹으로 묶는다
  const groups: { key: string; major: string; kind: TransactionKind; items: Category[] }[] = []
  for (const c of categories) {
    const last = groups[groups.length - 1]
    if (last && last.major === c.major && last.kind === c.kind) {
      last.items.push(c)
    } else {
      groups.push({ key: `${c.kind}:${c.major}`, major: c.major, kind: c.kind, items: [c] })
    }
  }

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })

  const openCreate = () => {
    setEditing(null)
    setMajor('')
    setMinor('')
    setKind('expense')
    setNature('variable')
    setError(null)
    setOpen(true)
  }

  const openEdit = (c: Category) => {
    setEditing(c)
    setMajor(c.major)
    setMinor(c.minor)
    setKind(c.kind)
    setNature(c.nature)
    setError(null)
    setOpen(true)
  }

  const submit = async () => {
    if (!major.trim()) return setError('대분류를 입력해주세요')
    const payload = {
      major: major.trim(),
      minor: minor.trim() || '미분류',
      kind,
      nature,
    }
    try {
      if (editing) {
        await updateCategory(editing.id, payload)
      } else {
        await createCategory(payload)
      }
      setOpen(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-x4">
      <div className="flex flex-wrap items-center justify-between gap-x2">
        <p className="t4-regular min-w-0 text-fg-neutral-muted">
          고정 지출은 <Badge variant="outline">정기 궤도</Badge>, 변동 지출은{' '}
          <Badge variant="outline">유성우</Badge>로 표시돼요.
        </p>
        <ActionButton variant="neutralSolid" size="small" className="shrink-0" onClick={openCreate}>
          <PrefixIcon svg={<IconPlusLine />} />
          카테고리 추가
        </ActionButton>
      </div>
      <div className="rounded-r2 border border-stroke-neutral-weak">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>대분류</TableHead>
              <TableHead>소분류</TableHead>
              <TableHead>구분</TableHead>
              <TableHead>성격</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => {
              const isCollapsed = collapsed.has(g.key)
              return (
                <Fragment key={g.key}>
                  <TableRow
                    className="cursor-pointer bg-bg-neutral-weak hover:bg-bg-neutral-weak-pressed"
                    onClick={() => toggleGroup(g.key)}
                  >
                    <TableCell colSpan={5}>
                      <span className="t4-medium flex items-center gap-x2">
                        <Icon
                          svg={
                            isCollapsed ? <IconChevronRightSmallLine /> : <IconChevronDownSmallLine />
                          }
                          size="x4"
                          color="fg.neutralMuted"
                        />
                        {g.major}
                        <Badge variant="weak" tone={g.kind === 'income' ? 'positive' : 'neutral'}>
                          {KIND_LABEL[g.kind]}
                        </Badge>
                        <span className="t2-regular text-fg-neutral-muted">
                          소분류 {g.items.length}개
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
                  {!isCollapsed &&
                    g.items.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell />
                        <TableCell>{c.minor}</TableCell>
                        <TableCell>
                          <Badge variant="weak" tone={c.kind === 'income' ? 'positive' : 'neutral'}>
                            {KIND_LABEL[c.kind]}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.nature === 'fixed' ? '🛸 정기 궤도 (고정)' : '☄️ 유성우 (변동)'}</TableCell>
                        <TableCell>
                          <RowActions onEdit={() => openEdit(c)} onDelete={() => deleteCategory(c.id)} />
                        </TableCell>
                      </TableRow>
                    ))}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {/* Portal 필수: SEED Tabs의 content가 transform을 걸어 position:fixed의 containing block이
          되어버린다. 감싸지 않으면 패널/바텀시트가 뷰포트가 아니라 탭 패널 안에 갇힌다. */}

      <Portal>

        <ResponsiveSidePanelRoot open={open} onOpenChange={setOpen}>
        <ResponsiveSidePanelContent title={editing ? '카테고리 수정' : '카테고리 추가'}>
          <ResponsiveSidePanelBody>
            <div className="flex flex-col gap-x4">
              <TextField size="responsive" label="대분류" value={major} onValueChange={({ value }) => setMajor(value)}>
                <TextFieldInput list="cat-major-options" placeholder="예: 식비" />
              </TextField>
              <datalist id="cat-major-options">
                {majorOptions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <TextField size="responsive" label="소분류" value={minor} onValueChange={({ value }) => setMinor(value)}>
                <TextFieldInput placeholder="비우면 '미분류'" />
              </TextField>
              <SelectRoot size="responsive"
                label="구분"
                value={[kind]}
                onValueChange={([v]) => setKind(v as TransactionKind)}
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
              <SelectRoot size="responsive"
                label="성격"
                value={[nature]}
                onValueChange={([v]) => setNature(v as CategoryNature)}
              >
                <SelectTrigger aria-label="성격" />
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="fixed" label="정기 궤도 (고정)" />
                    <SelectItem value="variable" label="유성우 (변동)" />
                  </SelectGroup>
                </SelectContent>
              </SelectRoot>
              {error && <p className="t4-regular text-fg-critical">{error}</p>}
            </div>
          </ResponsiveSidePanelBody>
          <ResponsiveSidePanelFooter>
            <ResponsivePair gap="x2">
              <ActionButton variant="neutralWeak" onClick={() => setOpen(false)}>
                취소
              </ActionButton>
              <ActionButton variant="neutralSolid" onClick={submit}>
                {editing ? '수정' : '추가'}
              </ActionButton>
            </ResponsivePair>
          </ResponsiveSidePanelFooter>
        </ResponsiveSidePanelContent>
        </ResponsiveSidePanelRoot>
      </Portal>
    </div>
  )
}

// ---------- 자산 계정 탭 ----------
function AccountsTab() {
  const { accounts, members, createAccount, updateAccount, deleteAccount } = useMasterDataStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [memberId, setMemberId] = useState('')
  // 'none' = 기본 연결 없음 (거래별 지정에 맡김). Radix Select는 빈 문자열 value를 못 쓴다
  const [linkedAccountId, setLinkedAccountId] = useState('none')
  const [error, setError] = useState<string | null>(null)

  // 간편결제 연결 후보 — 카드/은행 계정만, 편집 중인 계정 자신은 제외
  const linkableAccounts = accounts.filter(
    (a) => LINKABLE_TYPES.includes(a.type) && a.id !== editing?.id,
  )

  // 목록 정렬: 소유자 → 유형(ACCOUNT_TYPES 표시 순) → 이름
  const sortedAccounts = useMemo(() => {
    const memberName = (id: number) => members.find((m) => m.id === id)?.name ?? ''
    const typeOrder = (t: AccountType) => ACCOUNT_TYPES.findIndex((x) => x.value === t)
    return [...accounts].sort(
      (a, b) =>
        memberName(a.member_id).localeCompare(memberName(b.member_id), 'ko') ||
        typeOrder(a.type) - typeOrder(b.type) ||
        a.name.localeCompare(b.name, 'ko'),
    )
  }, [accounts, members])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setType('bank')
    setOpeningBalance('0')
    setIsActive(true)
    setMemberId('')
    setLinkedAccountId('none')
    setError(null)
    setOpen(true)
  }

  const openEdit = (a: Account) => {
    setEditing(a)
    setName(a.name)
    setType(a.type)
    setOpeningBalance(String(a.opening_balance))
    setIsActive(a.is_active)
    setMemberId(String(a.member_id))
    setLinkedAccountId(a.linked_account_id ? String(a.linked_account_id) : 'none')
    setError(null)
    setOpen(true)
  }

  const submit = async () => {
    if (!name.trim()) return setError('이름을 입력해주세요')
    const balance = Number(openingBalance)
    if (!Number.isInteger(balance)) return setError('개설 잔액은 정수여야 합니다')
    if (!memberId) return setError('소유자를 선택해주세요')
    const input = {
      name: name.trim(),
      type,
      opening_balance: balance,
      is_active: isActive,
      member_id: Number(memberId),
      // 간편결제일 때만 연결 계정을 보낸다 — 그 외 유형은 백엔드에서 null이어야 함.
      // 간편결제라도 기본 연결은 선택이라 'none'이면 null로 보낸다(거래별 지정에 맡김)
      linked_account_id:
        type === 'easy_pay' && linkedAccountId !== 'none' ? Number(linkedAccountId) : null,
    }
    try {
      if (editing) {
        await updateAccount(editing.id, input)
      } else {
        await createAccount(input)
      }
      setOpen(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-x4">
      <div className="flex justify-end">
        <ActionButton variant="neutralSolid" size="small" onClick={openCreate}>
          <PrefixIcon svg={<IconPlusLine />} />
          계정 추가
        </ActionButton>
      </div>
      <div className="rounded-r2 border border-stroke-neutral-weak">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>소유자</TableHead>
              <TableHead>개설 잔액</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAccounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.name}</TableCell>
                <TableCell>
                  {accountTypeLabel(a.type)}
                  {a.type === 'easy_pay' && (
                    <span className="t2-regular text-fg-neutral-muted">
                      {' '}
                      →{' '}
                      {a.linked_account_id
                        ? (accounts.find((x) => x.id === a.linked_account_id)?.name ?? '—')
                        : '거래별 지정'}
                    </span>
                  )}
                </TableCell>
                <TableCell>{members.find((m) => m.id === a.member_id)?.name ?? '—'}</TableCell>
                <TableCell>{formatKRW(a.opening_balance)}</TableCell>
                <TableCell>
                  <Badge variant="weak" tone={a.is_active ? 'positive' : 'neutral'}>
                    {a.is_active ? '활성' : '비활성'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <RowActions onEdit={() => openEdit(a)} onDelete={() => deleteAccount(a.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Portal 필수: SEED Tabs의 content가 transform을 걸어 position:fixed의 containing block이
          되어버린다. 감싸지 않으면 패널/바텀시트가 뷰포트가 아니라 탭 패널 안에 갇힌다. */}

      <Portal>

        <ResponsiveSidePanelRoot open={open} onOpenChange={setOpen}>
        <ResponsiveSidePanelContent title={editing ? '계정 수정' : '계정 추가'}>
          <ResponsiveSidePanelBody>
            <div className="flex flex-col gap-x4">
              <TextField size="responsive" label="이름" value={name} onValueChange={({ value }) => setName(value)}>
                <TextFieldInput />
              </TextField>
              <SelectRoot size="responsive"
                label="유형"
                value={[type]}
                onValueChange={([v]) => setType(v as AccountType)}
              >
                <SelectTrigger aria-label="유형" />
                <SelectContent>
                  <SelectGroup>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} label={t.label} />
                    ))}
                  </SelectGroup>
                </SelectContent>
              </SelectRoot>
              {type === 'easy_pay' && (
                <SelectRoot size="responsive"
                  label="기본 연결 계정 (선택)"
                  description={
                    linkableAccounts.length === 0
                      ? '연결할 카드/은행 계정이 없어요. 지금은 비워두고 나중에 지정해도 돼요.'
                      : '항상 같은 카드로 결제되면 여기서 고정하세요. 건마다 다르면 비워두고 거래에서 하나씩 지정하면 돼요.'
                  }
                  value={[linkedAccountId]}
                  onValueChange={([v]) => setLinkedAccountId(v)}
                >
                  <SelectTrigger aria-label="기본 연결 계정" />
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none" label="선택 안 함 (거래별 지정)" />
                      {linkableAccounts.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)} label={a.name} />
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </SelectRoot>
              )}
              <SelectRoot size="responsive"
                label="소유자"
                value={memberId ? [memberId] : []}
                onValueChange={([v]) => setMemberId(v ?? '')}
              >
                <SelectTrigger aria-label="소유자" placeholder="선택" />
                <SelectContent>
                  <SelectGroup>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)} label={m.name} />
                    ))}
                  </SelectGroup>
                </SelectContent>
              </SelectRoot>
              <TextField size="responsive"
                label="개설 잔액 (원)"
                value={openingBalance}
                onValueChange={({ value }) => setOpeningBalance(value)}
              >
                <TextFieldInput type="number" />
              </TextField>
              {/* 이분 상태라 Select보다 Switch가 SEED 관용구에 맞는다 */}
              <div className="flex items-center justify-between gap-x2">
                <span className="t4-medium">활성 상태</span>
                <Switch
                  aria-label="활성 상태"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked === true)}
                />
              </div>
              {error && <p className="t4-regular text-fg-critical">{error}</p>}
            </div>
          </ResponsiveSidePanelBody>
          <ResponsiveSidePanelFooter>
            <ResponsivePair gap="x2">
              <ActionButton variant="neutralWeak" onClick={() => setOpen(false)}>
                취소
              </ActionButton>
              <ActionButton variant="neutralSolid" onClick={submit}>
                {editing ? '수정' : '추가'}
              </ActionButton>
            </ResponsivePair>
          </ResponsiveSidePanelFooter>
        </ResponsiveSidePanelContent>
        </ResponsiveSidePanelRoot>
      </Portal>
    </div>
  )
}

// ---------- 구성원 탭 ----------
function MembersTab() {
  const { members, createMember, updateMember, deleteMember } = useMasterDataStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#a78bfa')
  const [error, setError] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setName('')
    setColor('#a78bfa')
    setError(null)
    setOpen(true)
  }

  const openEdit = (m: Member) => {
    setEditing(m)
    setName(m.name)
    setColor(m.color)
    setError(null)
    setOpen(true)
  }

  const submit = async () => {
    if (!name.trim()) return setError('이름을 입력해주세요')
    try {
      if (editing) {
        await updateMember(editing.id, { name: name.trim(), color })
      } else {
        await createMember({ name: name.trim(), color })
      }
      setOpen(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-x4">
      <div className="flex justify-end">
        <ActionButton variant="neutralSolid" size="small" onClick={openCreate}>
          <PrefixIcon svg={<IconPlusLine />} />
          구성원 추가
        </ActionButton>
      </div>
      <div className="rounded-r2 border border-stroke-neutral-weak">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>색상</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.name}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-x2">
                    <span
                      className="inline-block size-x4 rounded-full"
                      style={{ backgroundColor: m.color }}
                    />
                    {m.color}
                  </span>
                </TableCell>
                <TableCell>
                  <RowActions onEdit={() => openEdit(m)} onDelete={() => deleteMember(m.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Portal 필수: SEED Tabs의 content가 transform을 걸어 position:fixed의 containing block이
          되어버린다. 감싸지 않으면 패널/바텀시트가 뷰포트가 아니라 탭 패널 안에 갇힌다. */}

      <Portal>

        <ResponsiveSidePanelRoot open={open} onOpenChange={setOpen}>
        <ResponsiveSidePanelContent title={editing ? '구성원 수정' : '구성원 추가'}>
          <ResponsiveSidePanelBody>
            <div className="flex flex-col gap-x4">
              <TextField size="responsive" label="이름" value={name} onValueChange={({ value }) => setName(value)}>
                <TextFieldInput />
              </TextField>
              {/* 색상은 네이티브 color 입력을 그대로 쓴다 — SEED에 대응 컴포넌트가 없다 */}
              <div className="flex flex-col gap-x1">
                <label className="t4-medium" htmlFor="mem-color">
                  색상
                </label>
                <input
                  id="mem-color"
                  type="color"
                  className="h-x10 w-x16 rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default p-x1"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
              {error && <p className="t4-regular text-fg-critical">{error}</p>}
            </div>
          </ResponsiveSidePanelBody>
          <ResponsiveSidePanelFooter>
            <ResponsivePair gap="x2">
              <ActionButton variant="neutralWeak" onClick={() => setOpen(false)}>
                취소
              </ActionButton>
              <ActionButton variant="neutralSolid" onClick={submit}>
                {editing ? '수정' : '추가'}
              </ActionButton>
            </ResponsivePair>
          </ResponsiveSidePanelFooter>
        </ResponsiveSidePanelContent>
        </ResponsiveSidePanelRoot>
      </Portal>
    </div>
  )
}

// ---------- 공통 행 액션 ----------
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex items-center justify-end gap-x2">
      {error && (
        <span className="t2-regular max-w-48 truncate text-fg-critical" title={error}>
          {error}
        </span>
      )}
      <ActionButton variant="ghost" size="small" layout="iconOnly" aria-label="수정" onClick={onEdit}>
        <Icon svg={<IconPencilLine />} />
      </ActionButton>
      <ActionButton
        variant="ghost"
        size="small"
        color="fg.critical"
        layout="iconOnly"
        aria-label="삭제"
        onClick={() => onDelete().catch((e: Error) => setError(e.message))}
      >
        <Icon svg={<IconTrashcanLine />} />
      </ActionButton>
    </div>
  )
}

// ---------- AI 설정 탭 ----------
function AISettingsTab() {
  const { settings, fetch, save } = useAISettingsStore()
  const [apiKey, setApiKey] = useState('')
  // null = 아직 편집 안 함 → 서버 설정값을 표시. 입력 시작하면 그 값을 사용.
  const [modelEdit, setModelEdit] = useState<string | null>(null)
  const model = modelEdit ?? settings?.model ?? ''
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch().catch((e: Error) => setError(e.message))
  }, [fetch])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      // 키 입력이 비어 있으면 기존 키 유지 (undefined 전송)
      await save({ api_key: apiKey.trim() || undefined, model: model.trim() || undefined })
      setApiKey('')
      setModelEdit(null)
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-x4">
      <p className="t4-regular text-fg-neutral-muted">
        대시보드 AI 리포트 생성에 사용할 OpenAI API 키와 모델을 설정합니다. 키는 서버에 저장되며 화면에
        다시 표시되지 않습니다.
      </p>
      <TextField size="responsive"
        label="OpenAI API 키"
        description={
          settings?.api_key_set
            ? `키가 등록되어 있습니다 (${settings.api_key_hint}). 변경하려면 새 키를 입력하세요.`
            : '아직 키가 등록되지 않았습니다.'
        }
        value={apiKey}
        onValueChange={({ value }) => setApiKey(value)}
      >
        <TextFieldInput type="password" autoComplete="off" placeholder="sk-..." />
      </TextField>
      <TextField size="responsive"
        label="모델"
        description="비우면 기본값(gpt-4.1-mini)이 사용됩니다. OpenAI의 가성비 모델을 권장합니다."
        value={model}
        onValueChange={({ value }) => setModelEdit(value)}
      >
        <TextFieldInput placeholder="gpt-4.1-mini" maxLength={50} />
      </TextField>
      {error && <p className="t4-regular text-fg-critical">{error}</p>}
      {saved && <p className="t4-regular text-fg-positive">저장되었습니다.</p>}
      <div className="flex">
        <ActionButton variant="neutralSolid" onClick={handleSave} loading={saving}>
          저장
        </ActionButton>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { loaded, fetchAll } = useMasterDataStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loaded) fetchAll().catch((e: Error) => setError(e.message))
  }, [loaded, fetchAll])

  if (error) {
    return <p className="t4-regular text-fg-critical">기준정보를 불러오지 못했습니다: {error}</p>
  }

  return (
    <div className="flex flex-col gap-x6">
      <h1 className="screen-title">기준정보 관리</h1>
      <TabsRoot defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">카테고리</TabsTrigger>
          <TabsTrigger value="accounts">자산 계정</TabsTrigger>
          <TabsTrigger value="members">구성원</TabsTrigger>
          <TabsTrigger value="ai">AI 설정</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-x4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="accounts" className="mt-x4">
          <AccountsTab />
        </TabsContent>
        <TabsContent value="members" className="mt-x4">
          <MembersTab />
        </TabsContent>
        <TabsContent value="ai" className="mt-x4">
          <AISettingsTab />
        </TabsContent>
      </TabsRoot>
    </div>
  )
}
