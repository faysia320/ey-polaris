import { create } from 'zustand'

import { api } from '@/lib/api'
import { currentMonth } from '@/lib/format'
import type { Budget } from '@/types'

interface BudgetState {
  month: string
  items: Budget[]
  fetch: (month?: string) => Promise<void>
  /** 해당 월·지출 대분류 예산을 생성 또는 수정한다. */
  save: (major: string, amount: number) => Promise<void>
  remove: (id: number) => Promise<void>
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  month: currentMonth(),
  items: [],

  fetch: async (month) => {
    const target = month ?? get().month
    const items = await api.get<Budget[]>(`/budgets?month=${target}`)
    set({ month: target, items })
  },

  save: async (major, amount) => {
    const { month, items } = get()
    const existing = items.find((b) => b.major === major)
    if (existing) {
      await api.put(`/budgets/${existing.id}`, { amount })
    } else {
      await api.post('/budgets', { year_month: month, major, amount })
    }
    await get().fetch()
  },

  remove: async (id) => {
    await api.delete(`/budgets/${id}`)
    await get().fetch()
  },
}))
