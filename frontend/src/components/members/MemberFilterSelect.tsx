import { useEffect } from 'react'
import { Users } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMasterDataStore } from '@/stores/masterData'
import { useMemberFilterStore } from '@/stores/memberFilter'

/** 페이지 헤더 우측에 놓는 구성원 필터 — 옵션은 전체 + 등록된 구성원 목록 */
export function MemberFilterSelect() {
  const { members, loaded, fetchAll } = useMasterDataStore()
  const { memberId, setMemberId } = useMemberFilterStore()

  useEffect(() => {
    // 실패해도 '전체' 옵션만 남을 뿐이라 페이지 에러로 올리지 않는다
    if (!loaded) fetchAll().catch(() => {})
  }, [loaded, fetchAll])

  return (
    <Select
      value={memberId === null ? 'all' : String(memberId)}
      onValueChange={(v) => setMemberId(v === 'all' ? null : Number(v))}
    >
      <SelectTrigger className="w-32">
        <Users className="size-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">전체</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={String(m.id)}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
