import { create } from 'zustand'

import { api } from '@/lib/api'
import { currentMonth } from '@/lib/format'
import type { Transaction, TransactionInput, TransactionKind } from '@/types'

export interface TransactionFilters {
  month: string | null
  kind: TransactionKind | null
  /** 대분류 — 소분류 미선택 시 대분류 전체를 포괄 */
  major: string | null
  category_id: number | null
  /** 구성원 — 전역 구성원 필터와 동기화됨 */
  member_id: number | null
}

function toQuery(filters: TransactionFilters): string {
  const params = new URLSearchParams()
  if (filters.month) params.set('month', filters.month)
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.major) params.set('major', filters.major)
  if (filters.category_id) params.set('category_id', String(filters.category_id))
  if (filters.member_id) params.set('member_id', String(filters.member_id))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

interface TransactionState {
  items: Transaction[]
  filters: TransactionFilters
  loading: boolean
  fetch: () => Promise<void>
  setFilters: (filters: Partial<TransactionFilters>) => Promise<void>
  create: (input: TransactionInput) => Promise<void>
  update: (id: number, input: TransactionInput) => Promise<void>
  remove: (id: number) => Promise<void>
  /** 현재 조회 필터에 걸리는 해당 월 거래를 일괄 삭제하고 삭제 건수를 반환 */
  removeMonth: () => Promise<number>
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  items: [],
  filters: { month: currentMonth(), kind: null, major: null, category_id: null, member_id: null },
  loading: false,

  fetch: async () => {
    set({ loading: true })
    try {
      const items = await api.get<Transaction[]>(`/transactions${toQuery(get().filters)}`)
      set({ items })
    } finally {
      set({ loading: false })
    }
  },

  setFilters: async (filters) => {
    set({ filters: { ...get().filters, ...filters } })
    await get().fetch()
  },

  create: async (input) => {
    await api.post('/transactions', input)
    await get().fetch()
  },
  update: async (id, input) => {
    await api.put(`/transactions/${id}`, input)
    await get().fetch()
  },
  remove: async (id) => {
    await api.delete(`/transactions/${id}`)
    await get().fetch()
  },
  removeMonth: async () => {
    const filters = get().filters
    // 월 미선택(전체 기간) 상태에서는 전체 삭제 사고를 막기 위해 호출 자체를 차단
    if (!filters.month) throw new Error('삭제할 월을 먼저 선택해주세요')
    const { deleted_count } = await api.delete<{ deleted_count: number }>(
      `/transactions${toQuery(filters)}`
    )
    await get().fetch()
    return deleted_count
  },
}))
