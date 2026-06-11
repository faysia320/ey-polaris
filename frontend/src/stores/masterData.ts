import { create } from 'zustand'

import { api } from '@/lib/api'
import type { Account, AccountType, Category, CategoryNature, Member, TransactionKind } from '@/types'

export interface MemberInput {
  name: string
  color: string
}

export interface AccountInput {
  name: string
  type: AccountType
  opening_balance: number
  is_active: boolean
  member_id: number
}

export interface CategoryInput {
  major: string
  minor: string
  kind: TransactionKind
  nature: CategoryNature
}

interface MasterDataState {
  members: Member[]
  accounts: Account[]
  categories: Category[]
  loaded: boolean
  fetchAll: () => Promise<void>
  createMember: (input: MemberInput) => Promise<void>
  updateMember: (id: number, input: MemberInput) => Promise<void>
  deleteMember: (id: number) => Promise<void>
  createAccount: (input: AccountInput) => Promise<void>
  updateAccount: (id: number, input: AccountInput) => Promise<void>
  deleteAccount: (id: number) => Promise<void>
  createCategory: (input: CategoryInput) => Promise<void>
  updateCategory: (id: number, input: CategoryInput) => Promise<void>
  deleteCategory: (id: number) => Promise<void>
}

export const useMasterDataStore = create<MasterDataState>((set, get) => ({
  members: [],
  accounts: [],
  categories: [],
  loaded: false,

  fetchAll: async () => {
    const [members, accounts, categories] = await Promise.all([
      api.get<Member[]>('/members'),
      api.get<Account[]>('/accounts'),
      api.get<Category[]>('/categories'),
    ])
    set({ members, accounts, categories, loaded: true })
  },

  createMember: async (input) => {
    await api.post('/members', input)
    await get().fetchAll()
  },
  updateMember: async (id, input) => {
    await api.put(`/members/${id}`, input)
    await get().fetchAll()
  },
  deleteMember: async (id) => {
    await api.delete(`/members/${id}`)
    await get().fetchAll()
  },

  createAccount: async (input) => {
    await api.post('/accounts', input)
    await get().fetchAll()
  },
  updateAccount: async (id, input) => {
    await api.put(`/accounts/${id}`, input)
    await get().fetchAll()
  },
  deleteAccount: async (id) => {
    await api.delete(`/accounts/${id}`)
    await get().fetchAll()
  },

  createCategory: async (input) => {
    await api.post('/categories', input)
    await get().fetchAll()
  },
  updateCategory: async (id, input) => {
    await api.put(`/categories/${id}`, input)
    await get().fetchAll()
  },
  deleteCategory: async (id) => {
    await api.delete(`/categories/${id}`)
    await get().fetchAll()
  },
}))
