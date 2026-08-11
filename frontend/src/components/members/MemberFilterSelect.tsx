import { useEffect } from 'react'
import { IconPerson2Fill } from '@karrotmarket/react-monochrome-icon'
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectRoot,
  SelectTrigger,
} from 'seed-design/ui/select'

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
    // SEED Select는 값을 배열로 다룬다 (다중 선택과 API를 공유) — 단일 선택은 항목 하나짜리 배열
    <SelectRoot
      size="responsive"
      value={[memberId === null ? 'all' : String(memberId)]}
      onValueChange={([v]) => setMemberId(v === 'all' ? null : Number(v))}
    >
      <SelectTrigger
        aria-label="구성원 필터"
        prefixIcon={<IconPerson2Fill />}
        className="w-x16 md:w-auto md:min-w-x16"
      />
      <SelectContent>
        <SelectGroup>
          <SelectItem value="all" label="전체" />
          {members.map((m) => (
            <SelectItem key={m.id} value={String(m.id)} label={m.name} />
          ))}
        </SelectGroup>
      </SelectContent>
    </SelectRoot>
  )
}
