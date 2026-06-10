import { create } from 'zustand'

import { api } from '@/lib/api'
import type { Assets, Dashboard } from '@/types'

interface AnalyticsState {
  dashboard: Dashboard | null
  assets: Assets | null
  fetchDashboard: (month: string) => Promise<void>
  fetchAssets: () => Promise<void>
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  dashboard: null,
  assets: null,

  fetchDashboard: async (month) => {
    const dashboard = await api.get<Dashboard>(`/analytics/dashboard?month=${month}`)
    set({ dashboard })
  },

  fetchAssets: async () => {
    const assets = await api.get<Assets>('/analytics/assets')
    set({ assets })
  },
}))
