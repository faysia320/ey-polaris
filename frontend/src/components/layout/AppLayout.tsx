import {
  IconBarchartBoardFill,
  IconCompassFill,
  IconGearFill,
  IconReceiptFill,
  IconStarFill,
  IconWonCircleFill,
} from '@karrotmarket/react-monochrome-icon'
import { Icon, Layout } from '@seed-design/react'
import { useSideNavigationContext } from '@seed-design/react/primitive'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import {
  SideNavigationContent,
  SideNavigationFooter,
  SideNavigationGroup,
  SideNavigationHeader,
  SideNavigationInset,
  SideNavigationProvider,
  SideNavigationRoot,
  SideNavigationTrigger,
} from 'seed-design/ui/side-navigation'

import { cn } from '@/lib/utils'

// short: 모바일 하단 내비 라벨 — 좁은 폭에서 한 줄 유지용
const menu = [
  { to: '/', label: '대시보드', short: '대시보드', icon: IconBarchartBoardFill, end: true },
  { to: '/assets', label: '자산 상태', short: '자산', icon: IconWonCircleFill, end: false },
  { to: '/transactions', label: '지출/수입 내역', short: '내역', icon: IconReceiptFill, end: false },
  { to: '/budgets', label: '예산 설정', short: '예산', icon: IconCompassFill, end: false },
  { to: '/settings', label: '기준정보 관리', short: '설정', icon: IconGearFill, end: false },
]

/** 현재 경로가 메뉴 항목에 해당하는지 — NavLink의 `end` 의미를 그대로 옮긴 것 */
function isCurrent(pathname: string, item: (typeof menu)[number]) {
  return item.end ? pathname === item.to : pathname.startsWith(item.to)
}

/**
 * 사이드바 상단 브랜딩 + 접기 버튼.
 *
 * 접힘(56px) 상태에서는 접기 버튼만 남긴다 — 브랜드를 함께 두면 폭이 모자라
 * 버튼이 overflow-x: hidden에 밀려 사라져 다시 펼 방법이 없어진다.
 * 접힘 여부는 SideNavigation 컨텍스트에만 있으므로 Root 안쪽의 별도 컴포넌트로 분리했다.
 */
function SidebarHeader() {
  const { collapsed } = useSideNavigationContext()

  if (collapsed) {
    return (
      <div className="flex h-full items-center justify-center">
        <SideNavigationTrigger />
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-between gap-x2">
      <div className="flex min-w-0 items-center gap-x2">
        <Icon svg={<IconStarFill />} size="x6" color="fg.brand" />
        <div className="min-w-0">
          <p className="t4-bold truncate">으니영이의 북극성</p>
          <p className="t1-regular truncate text-fg-neutral-muted">우리 둘만의 재정 나침반</p>
        </div>
      </div>
      <SideNavigationTrigger />
    </div>
  )
}

/** 접힘 상태에서는 숨긴다 — 56px 폭에서 글자가 세로로 쪼개져 읽히지 않는다 */
function SidebarFooterNote() {
  const { collapsed } = useSideNavigationContext()
  if (collapsed) return null

  return <p className="t1-regular truncate px-x2 text-fg-neutral-subtle">🌌 v0.1 — 함께 별을 향해</p>
}

/**
 * 모바일 상단 내비게이션.
 *
 * SEED의 AppBar는 `@seed-design/stackflow`(액티비티 기반 네이티브 내비게이션)에 묶여 있어
 * react-router를 쓰는 이 앱에는 도입할 수 없다. 대신 SEED 토큰·타이포·Icon으로 직접 구성한다.
 */
function MobileNav() {
  return (
    <nav className="sticky top-0 z-40 flex border-b border-stroke-neutral-weak bg-bg-layer-default md:hidden">
      {menu.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              't1-regular flex flex-1 flex-col items-center gap-x1 py-x2 transition-colors',
              isActive ? 't1-bold text-fg-brand' : 'text-fg-neutral-muted',
            )
          }
        >
          <item.icon width={20} height={20} />
          {item.short}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // density=high: 콘텐츠 최대 폭 제한 없음. 거래 내역 표가 넓어 medium(1040px)으로 묶으면
  // 데스크톱에서 가로 스크롤이 상시화된다
  return (
    <Layout.Root density="high">
      <SideNavigationProvider>
        {/* 모바일에서는 상단 내비로 대체 — SideNavigation은 Inset의 flex 형제라 숨기면 폭이 그대로 넘어간다 */}
        <SideNavigationRoot className="hidden md:flex">
          <SideNavigationHeader>
            <SidebarHeader />
          </SideNavigationHeader>

          <SideNavigationContent>
            {/* SideNavigationGroup의 items API는 onClick만 받는다 (SEED 블록 예제와 동일) —
                링크가 아니라 버튼이므로 새 탭 열기는 지원되지 않는다 */}
            <SideNavigationGroup
              items={menu.map((item) => ({
                key: item.to,
                label: item.label,
                prefixIcon: <item.icon />,
                current: isCurrent(pathname, item),
                onClick: () => navigate(item.to),
              }))}
            />
          </SideNavigationContent>

          <SideNavigationFooter>
            <SidebarFooterNote />
          </SideNavigationFooter>
        </SideNavigationRoot>

        <SideNavigationInset>
          <MobileNav />
          <Layout.Content>
            <div className="p-x4 md:p-x8">
              <Outlet />
            </div>
          </Layout.Content>
        </SideNavigationInset>
      </SideNavigationProvider>
    </Layout.Root>
  )
}
