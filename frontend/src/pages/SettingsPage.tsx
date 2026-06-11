import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatKRW } from '@/lib/format'
import { useMasterDataStore } from '@/stores/masterData'
import type { Account, AccountType, Category, CategoryNature, Member, TransactionKind } from '@/types'

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'bank', label: '은행' },
  { value: 'cash', label: '현금' },
  { value: 'card', label: '카드' },
  { value: 'investment', label: '투자' },
  { value: 'stock', label: '주식' },
  { value: 'real_estate', label: '부동산' },
  { value: 'other', label: '기타' },
]

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

  // 대분류 입력 자동완성용 — 같은 구분의 기존 대분류 목록
  const majorOptions = [...new Set(categories.filter((c) => c.kind === kind).map((c) => c.major))]

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
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">
          고정 지출은 <Badge variant="outline">정기 궤도</Badge>, 변동 지출은{' '}
          <Badge variant="outline">유성우</Badge>로 표시돼요.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus /> 카테고리 추가
        </Button>
      </div>
      <div className="rounded-lg border">
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
            {categories.map((c, i) => (
              <TableRow key={c.id}>
                <TableCell>
                  {/* 같은 대분류가 연속되면 첫 행에만 표시해 그룹처럼 보이게 한다 */}
                  {i > 0 &&
                  categories[i - 1].major === c.major &&
                  categories[i - 1].kind === c.kind ? (
                    <span className="text-muted-foreground">·</span>
                  ) : (
                    c.major
                  )}
                </TableCell>
                <TableCell>{c.minor}</TableCell>
                <TableCell>
                  <Badge variant={c.kind === 'income' ? 'secondary' : 'outline'}>
                    {c.kind === 'income' ? '수입' : '지출'}
                  </Badge>
                </TableCell>
                <TableCell>{c.nature === 'fixed' ? '🛸 정기 궤도 (고정)' : '☄️ 유성우 (변동)'}</TableCell>
                <TableCell>
                  <RowActions onEdit={() => openEdit(c)} onDelete={() => deleteCategory(c.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? '카테고리 수정' : '카테고리 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="cat-major">대분류</Label>
              <Input
                id="cat-major"
                list="cat-major-options"
                placeholder="예: 식비"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
              />
              <datalist id="cat-major-options">
                {majorOptions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-minor">소분류</Label>
              <Input
                id="cat-minor"
                placeholder="비우면 '미분류'"
                value={minor}
                onChange={(e) => setMinor(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>구분</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as TransactionKind)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">지출</SelectItem>
                  <SelectItem value="income">수입</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>성격</Label>
              <Select value={nature} onValueChange={(v) => setNature(v as CategoryNature)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">정기 궤도 (고정)</SelectItem>
                  <SelectItem value="variable">유성우 (변동)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={submit}>{editing ? '수정' : '추가'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------- 자산 계정 탭 ----------
function AccountsTab() {
  const { accounts, createAccount, updateAccount, deleteAccount } = useMasterDataStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setName('')
    setType('bank')
    setOpeningBalance('0')
    setIsActive(true)
    setError(null)
    setOpen(true)
  }

  const openEdit = (a: Account) => {
    setEditing(a)
    setName(a.name)
    setType(a.type)
    setOpeningBalance(String(a.opening_balance))
    setIsActive(a.is_active)
    setError(null)
    setOpen(true)
  }

  const submit = async () => {
    if (!name.trim()) return setError('이름을 입력해주세요')
    const balance = Number(openingBalance)
    if (!Number.isInteger(balance)) return setError('개설 잔액은 정수여야 합니다')
    const input = { name: name.trim(), type, opening_balance: balance, is_active: isActive }
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus /> 계정 추가
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>개설 잔액</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.name}</TableCell>
                <TableCell>{ACCOUNT_TYPES.find((t) => t.value === a.type)?.label}</TableCell>
                <TableCell>{formatKRW(a.opening_balance)}</TableCell>
                <TableCell>
                  <Badge variant={a.is_active ? 'secondary' : 'outline'}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? '계정 수정' : '계정 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="acc-name">이름</Label>
              <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>유형</Label>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-balance">개설 잔액 (원)</Label>
              <Input
                id="acc-balance"
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>상태</Label>
              <Select
                value={isActive ? 'active' : 'inactive'}
                onValueChange={(v) => setIsActive(v === 'active')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="inactive">비활성</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={submit}>{editing ? '수정' : '추가'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus /> 구성원 추가
        </Button>
      </div>
      <div className="rounded-lg border">
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
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-4 rounded-full"
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? '구성원 수정' : '구성원 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="mem-name">이름</Label>
              <Input id="mem-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mem-color">색상</Label>
              <Input
                id="mem-color"
                type="color"
                className="h-10 w-20 p-1"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={submit}>{editing ? '수정' : '추가'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------- 공통 행 액션 ----------
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex items-center justify-end gap-1">
      {error && <span className="max-w-48 truncate text-xs text-destructive" title={error}>{error}</span>}
      <Button variant="ghost" size="icon-sm" onClick={onEdit}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onDelete().catch((e: Error) => setError(e.message))}
      >
        <Trash2 className="text-destructive" />
      </Button>
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
    return <p className="text-destructive">기준정보를 불러오지 못했습니다: {error}</p>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">기준정보 관리</h1>
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">카테고리</TabsTrigger>
          <TabsTrigger value="accounts">자산 계정</TabsTrigger>
          <TabsTrigger value="members">구성원</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <AccountsTab />
        </TabsContent>
        <TabsContent value="members" className="mt-4">
          <MembersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
