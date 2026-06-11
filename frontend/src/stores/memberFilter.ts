import { create } from 'zustand'

interface MemberFilterState {
  /** 선택된 구성원 id — null이면 전체 */
  memberId: number | null
  setMemberId: (memberId: number | null) => void
}

/** 대시보드/자산 상태/지출·수입 내역이 공유하는 구성원 필터 — 페이지를 이동해도 유지된다 */
export const useMemberFilterStore = create<MemberFilterState>((set) => ({
  memberId: null,
  setMemberId: (memberId) => set({ memberId }),
}))
