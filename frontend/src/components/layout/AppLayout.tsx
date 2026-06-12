import { Coins, Compass, LayoutDashboard, Settings2, Sparkles, Star } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

import { cn } from '@/lib/utils'

// short: 모바일 하단 내비 라벨 — 좁은 폭에서 한 줄 유지용
const menu = [
  { to: '/', label: '대시보드', short: '대시보드', icon: LayoutDashboard, end: true },
  { to: '/assets', label: '자산 상태', short: '자산', icon: Sparkles, end: false },
  { to: '/transactions', label: '지출/수입 내역', short: '내역', icon: Coins, end: false },
  { to: '/budgets', label: '예산 설정', short: '예산', icon: Compass, end: false },
  { to: '/settings', label: '기준정보 관리', short: '설정', icon: Settings2, end: false },
]

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* 데스크톱(md+) 전용 사이드바 — 모바일은 하단 내비로 대체 */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
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

      {/* 모바일 전용 하단 내비게이션 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors',
                isActive
                  ? 'text-sidebar-accent-foreground font-medium'
                  : 'text-muted-foreground',
              )
            }
          >
            <item.icon className="size-5" />
            {item.short}
          </NavLink>
        ))}
      </nav>

      {/* min-w-0: flex item의 자동 최소 폭(min-width:auto) 해제 — 없으면 ECharts canvas의
          인라인 px 폭이 min-content로 전파되어 뷰포트 축소 시 가로 스크롤 데드락이 생긴다 */}
      <main className="min-w-0 flex-1 p-4 pb-20 md:ml-60 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
