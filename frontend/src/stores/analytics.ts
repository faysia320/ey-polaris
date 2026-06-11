import { create } from 'zustand'

import { api } from '@/lib/api'
import type { Assets, Dashboard } from '@/types'

interface AnalyticsState {
  dashboard: Dashboard | null
  assets: Assets | null
  fetchDashboard: (month: string, memberId?: number | null) => Promise<void>
  fetchAssets: (memberId?: number | null) => Promise<void>
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  dashboard: null,
  assets: null,

  fetchDashboard: async (month, memberId) => {
    const params = new URLSearchParams({ month })
    if (memberId != null) params.set('member_id', String(memberId))
    const dashboard = await api.get<Dashboard>(`/analytics/dashboard?${params.toString()}`)
    set({ dashboard })
  },

  fetchAssets: async (memberId) => {
    const qs = memberId != null ? `?member_id=${memberId}` : ''
    const assets = await api.get<Assets>(`/analytics/assets${qs}`)
    set({ assets })
  },
}))
