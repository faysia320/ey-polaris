import { Coins, Compass, LayoutDashboard, Settings2, Sparkles, Star } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

import { cn } from '@/lib/utils'

const menu = [
  { to: '/', label: '대시보드', icon: LayoutDashboard, end: true },
  { to: '/assets', label: '자산 상태', icon: Sparkles, end: false },
  { to: '/transactions', label: '지출/수입 내역', icon: Coins, end: false },
  { to: '/budgets', label: '예산 설정', icon: Compass, end: false },
  { to: '/settings', label: '기준정보 관리', icon: Settings2, end: false },
]

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-5 py-6">
          <Star className="size-6 text-yellow-300" fill="currentColor" />
          <div>
            <p className="text-base font-semibold leading-tight">으니영이의 북극성</p>
            <p className="text-xs text-muted-foreground">우리 둘만의 재정 나침반</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="px-5 py-4 text-xs text-muted-foreground">🌌 v0.1 — 함께 별을 향해</p>
      </aside>
      <main className="ml-60 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
