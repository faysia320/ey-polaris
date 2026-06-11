import { create } from 'zustand'

import { api } from '@/lib/api'
import type { Goal, GoalInput } from '@/types'

interface GoalState {
  items: Goal[]
  loaded: boolean
  fetch: () => Promise<void>
  create: (input: GoalInput) => Promise<void>
  update: (id: number, input: GoalInput) => Promise<void>
  remove: (id: number) => Promise<void>
}

export const useGoalStore = create<GoalState>((set, get) => ({
  items: [],
  loaded: false,

  fetch: async () => {
    const items = await api.get<Goal[]>('/goals')
    set({ items, loaded: true })
  },

  create: async (input) => {
    await api.post('/goals', input)
    await get().fetch()
  },
  update: async (id, input) => {
    await api.put(`/goals/${id}`, input)
    await get().fetch()
  },
  remove: async (id) => {
    await api.delete(`/goals/${id}`)
    await get().fetch()
  },
}))
