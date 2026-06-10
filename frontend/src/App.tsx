import { Navigate, Route, Routes } from 'react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { AssetsPage } from '@/pages/AssetsPage'
import { BudgetsPage } from '@/pages/BudgetsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TransactionsPage } from '@/pages/TransactionsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
