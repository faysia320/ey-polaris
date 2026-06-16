import { create } from 'zustand'

import { api } from '@/lib/api'
import { addMonths, currentMonth } from '@/lib/format'
import type { Budget } from '@/types'

interface BudgetState {
  month: string
  items: Budget[]
  fetch: (month?: string) => Promise<void>
  /** 해당 월·지출 대분류 예산을 생성 또는 수정한다. */
  save: (major: string, amount: number) => Promise<void>
  remove: (id: number) => Promise<void>
  /** 직전 월 예산을 현재 월로 복사한다. 현재 월 기존 예산은 삭제 후 덮어쓴다. */
  copyFromPrevMonth: () => Promise<void>
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

  copyFromPrevMonth: async () => {
    const { month } = get()
    await api.post('/budgets/copy', {
      source_month: addMonths(month, -1),
      target_month: month,
    })
    await get().fetch()
  },
}))
