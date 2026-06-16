import { create } from 'zustand'

import { api } from '@/lib/api'
import type { AISettings, AISettingsUpdate } from '@/types'

interface AISettingsState {
  settings: AISettings | null
  fetch: () => Promise<void>
  save: (payload: AISettingsUpdate) => Promise<void>
}

export const useAISettingsStore = create<AISettingsState>((set) => ({
  settings: null,

  fetch: async () => {
    const settings = await api.get<AISettings>('/settings/ai')
    set({ settings })
  },

  save: async (payload) => {
    const settings = await api.put<AISettings>('/settings/ai', payload)
    set({ settings })
  },
}))
