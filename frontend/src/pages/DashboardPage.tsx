import { useEffect, useMemo, useRef, useState } from 'react'
import type { ECElementEvent, EChartsOption } from 'echarts'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { EChart } from '@/components/charts/EChart'
import { MemberFilterSelect } from '@/components/members/MemberFilterSelect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { addMonths, currentMonth, formatKRW, monthPace } from '@/lib/format'
import { useAnalyticsStore } from '@/stores/analytics'
import { useMemberFilterStore } from '@/stores/memberFilter'
import type { Transaction } from '@/types'

// ECharts 테마 빌더의 dark 테마 팔레트 — 다크 배경에서 채도를 낮춘 중간 톤이라
// 기본 dark 테마의 고채도 팔레트보다 라벨 대비가 안정적이다
const CHART_PALETTE = [
  '#dd6b66',
  '#759aa0',
  '#e69d87',
  '#8dc1a9',
  '#ea7e53',
  '#eedd78',
  '#73a373',
  '#73b9bc',
  '#7289ab',
  '#91ca8c',
  '#f49f42',
]

/** 블록 배경색의 휘도에 따라 어두운/밝은 라벨색을 골라 대비를 확보한다. */
function labelColorFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  // 임계 0.5 — 0.6이면 중간 톤(#73a373 등)에 밝은 라벨이 배정돼 WCAG AA 미달
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#1f2329' : '#eeeeee'
}

function guideMessage(budgetTotal: number, budgetSpent: number, month: string): string {
  if (budgetTotal <= 0) {
    return '이번 달 예산이 아직 없어요. 예산을 설정하면 북극성이 길을 안내해 드려요 🧭'
  }
  const rate = budgetSpent / budgetTotal
  const pace = monthPace(month)
  if (rate > 1) return '예산 궤도를 이탈했어요! 이번 달 예산을 초과했습니다 🚨'
  if (rate >= pace * 1.1) return '북극성이 흐려지고 있어요! 지출 속도를 줄여주세요 🌫️'
  if (rate < pace * 0.8) return '북극성이 밝게 빛나고 있어요. 순항 중! ✨'
  return '정상 궤도를 유지하고 있어요 🛰️'
}

interface CategoryDetail {
  major: string
  items: Transaction[]
  loading: boolean
  error: string | null
}

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth())
  const { dashboard, fetchDashboard } = useAnalyticsStore()
  const memberId = useMemberFilterStore((s) => s.memberId)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<CategoryDetail | null>(null)

  useEffect(() => {
    fetchDashboard(month, memberId)
      .then(() => setError(null))
      .catch((e: Error) => setError(e.message))
  }, [month, memberId, fetchDashboard])

  // 트리맵·스택바·범례가 같은 대분류명에 같은 색을 쓰도록 이름 기준으로 배색
  const colorByName = useMemo(() => {
    const names = (dashboard?.expense_by_category ?? []).map((d) => d.category_name)
    for (const b of dashboard?.budgets ?? []) {
      if (!names.includes(b.major)) names.push(b.major)
    }
    return new Map(names.map((n, i) => [n, CHART_PALETTE[i % CHART_PALETTE.length]]))
  }, [dashboard])

  const treemapOption = useMemo<EChartsOption>(() => {
    const data = dashboard?.expense_by_category ?? []
    return {
      tooltip: { trigger: 'item', valueFormatter: (v) => formatKRW(Number(v)) },
      series: [
        {
          name: '카테고리별 지출',
          type: 'treemap',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          // 단일 레벨 데이터 — 줌/드릴다운·브레드크럼은 비활성화하고 클릭은
          // EChart onClick으로 받아 세부 내역 다이얼로그를 띄운다
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          itemStyle: { borderRadius: 6, borderColor: '#171717', borderWidth: 2, gapWidth: 2 },
          label: { fontSize: 13, fontWeight: 500 },
          data: data.map((d) => {
            const color = colorByName.get(d.category_name) ?? CHART_PALETTE[0]
            return {
              name: d.category_name,
              value: d.amount,
              itemStyle: { color },
              label: {
                color: labelColorFor(color),
                formatter: () => `${d.category_name}\n${formatKRW(d.amount)}`,
              },
            }
          }),
        },
      ],
    }
  }, [dashboard, colorByName])

  // 세부 내역 요청 시퀀스 — 연속 클릭·로딩 중 닫기에서 stale 응답이
  // 최신 상태를 덮어쓰거나 닫힌 Dialog를 다시 열지 않도록 가드한다
  const detailSeq = useRef(0)

  const openDetail = async (major: string) => {
    const seq = ++detailSeq.current
    setDetail({ major, items: [], loading: true, error: null })
    const params = new URLSearchParams({ month, kind: 'expense', major })
    if (memberId != null) params.set('member_id', String(memberId))
    try {
      const items = await api.get<Transaction[]>(`/transactions?${params.toString()}`)
      if (seq !== detailSeq.current) return
      setDetail({ major, items, loading: false, error: null })
    } catch (e) {
      if (seq !== detailSeq.current) return
      setDetail({ major, items: [], loading: false, error: (e as Error).message })
    }
  }

  const closeDetail = () => {
    detailSeq.current += 1
    setDetail(null)
  }

  const handleTreemapClick = (params: ECElementEvent) => {
    if (params.seriesType !== 'treemap' || !params.name) return
    void openDetail(params.name)
  }

  if (error) {
    return <p className="text-destructive">대시보드를 불러오지 못했습니다: {error}</p>
  }

  const budgetTotal = dashboard?.budget_total ?? 0
  const budgetSpent = dashboard?.budget_spent ?? 0
  const budgets = dashboard?.budgets ?? []
  // 예산 초과 시에도 스택바가 넘치지 않도록 분모를 지출 합계까지 확장
  const stackDenom = Math.max(budgetTotal, budgetSpent)
  const detailTotal = detail?.items.reduce((sum, t) => sum + t.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <h1 className="text-2xl font-semibold">대시보드</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft />
          </Button>
          <span className="w-24 text-center font-medium tabular-nums">{month}</span>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight />
          </Button>
          <MemberFilterSelect />
        </div>
      </div>

      <Card className="border-yellow-300/30 bg-gradient-to-r from-indigo-950/60 to-slate-900/60">
        <CardContent className="flex items-center gap-3 py-4">
          <span className="text-2xl">🌟</span>
          <p className="text-sm">{guideMessage(budgetTotal, budgetSpent, month)}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">이번 달 수입</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-400">
              {formatKRW(dashboard?.income_total ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">이번 달 지출</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-rose-400">
              {formatKRW(dashboard?.expense_total ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">예산 소진율</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {budgetTotal > 0 ? `${Math.round((budgetSpent / budgetTotal) * 100)}%` : '—'}
            </p>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
              {budgets.map((b) => (
                <div
                  key={b.major}
                  title={`${b.major} ${formatKRW(b.spent)}`}
                  className="h-full"
                  style={{
                    width: stackDenom > 0 ? `${(b.spent / stackDenom) * 100}%` : '0%',
                    backgroundColor: colorByName.get(b.major) ?? CHART_PALETTE[0],
                  }}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatKRW(budgetSpent)} / {formatKRW(budgetTotal)}
            </p>
            {budgets.length > 0 && (
              <ul className="mt-2 space-y-1">
                {budgets.map((b) => (
                  <li
                    key={b.major}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: colorByName.get(b.major) ?? CHART_PALETTE[0],
                        }}
                      />
                      <span className="truncate">{b.major}</span>
                    </span>
                    <span
                      className={`shrink-0 tabular-nums ${
                        b.spent > b.amount ? 'text-rose-400' : 'text-muted-foreground'
                      }`}
                    >
                      {formatKRW(b.spent)} / {formatKRW(b.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>카테고리별 지출</CardTitle>
        </CardHeader>
        <CardContent>
          {(dashboard?.expense_by_category.length ?? 0) > 0 ? (
            <EChart option={treemapOption} height={400} onClick={handleTreemapClick} />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              이번 달 지출이 아직 없어요. 맑은 밤하늘이네요 🌌
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.major} 지출 내역</DialogTitle>
            <DialogDescription>
              {month} · {detail?.items.length ?? 0}건 · 합계 {formatKRW(detailTotal)}
            </DialogDescription>
          </DialogHeader>
          {detail?.loading && (
            <p className="py-8 text-center text-sm text-muted-foreground">불러오는 중...</p>
          )}
          {detail?.error && (
            <p className="py-8 text-center text-sm text-destructive">
              세부 내역을 불러오지 못했습니다: {detail.error}
            </p>
          )}
          {detail && !detail.loading && !detail.error && (
            <div className="max-h-80 overflow-y-auto">
              {detail.items.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  해당 카테고리의 거래가 없습니다.
                </p>
              )}
              {detail.items.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">{t.date}</span>
                      <span className="truncate">{t.category_name}</span>
                    </div>
                    {t.memo && (
                      <p className="truncate text-xs text-muted-foreground">{t.memo}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{formatKRW(t.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
