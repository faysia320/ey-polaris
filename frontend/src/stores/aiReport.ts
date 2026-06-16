import { create } from 'zustand'

import { api } from '@/lib/api'
import type { AIReport } from '@/types'

interface AIReportState {
  /** 월별 최신 리포트 캐시 (key: YYYY-MM) */
  byMonth: Record<string, AIReport | null>
  loading: boolean
  /** 해당 월의 최신 리포트를 조회해 캐시에 저장 (없으면 null) */
  fetch: (month: string) => Promise<void>
  /** 해당 월 리포트를 새로 생성하고 캐시를 갱신 */
  generate: (month: string) => Promise<void>
}

export const useAIReportStore = create<AIReportState>((set) => ({
  byMonth: {},
  loading: false,

  fetch: async (month) => {
    set({ loading: true })
    try {
      const report = await api.get<AIReport | null>(`/analytics/ai-report?month=${month}`)
      set((s) => ({ byMonth: { ...s.byMonth, [month]: report }, loading: false }))
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  generate: async (month) => {
    set({ loading: true })
    try {
      const report = await api.post<AIReport>(`/analytics/ai-report?month=${month}`, {})
      set((s) => ({ byMonth: { ...s.byMonth, [month]: report }, loading: false }))
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },
}))
