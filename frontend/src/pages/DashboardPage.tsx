import { useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { EChart } from '@/components/charts/EChart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { addMonths, currentMonth, formatKRW, monthPace } from '@/lib/format'
import { useAnalyticsStore } from '@/stores/analytics'

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

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth())
  const { dashboard, fetchDashboard } = useAnalyticsStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboard(month).catch((e: Error) => setError(e.message))
  }, [month, fetchDashboard])

  const donutOption = useMemo<EChartsOption>(() => {
    const data = dashboard?.expense_by_category ?? []
    return {
      tooltip: { trigger: 'item', valueFormatter: (v) => formatKRW(Number(v)) },
      legend: { bottom: 0, textStyle: { color: '#a1a1aa' } },
      series: [
        {
          name: '카테고리별 지출',
          type: 'pie',
          radius: ['45%', '70%'],
          itemStyle: { borderRadius: 6, borderColor: '#18181b', borderWidth: 2 },
          label: { color: '#e4e4e7', formatter: '{b}' },
          data: data.map((d) => ({ name: d.category_name, value: d.amount })),
        },
      ],
    }
  }, [dashboard])

  if (error) {
    return <p className="text-destructive">대시보드를 불러오지 못했습니다: {error}</p>
  }

  const budgetTotal = dashboard?.budget_total ?? 0
  const budgetSpent = dashboard?.budget_spent ?? 0
  const spentRate = budgetTotal > 0 ? Math.min(budgetSpent / budgetTotal, 1) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">대시보드</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft />
          </Button>
          <span className="w-24 text-center font-medium tabular-nums">{month}</span>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight />
          </Button>
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
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-yellow-300 transition-all"
                style={{ width: `${spentRate * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatKRW(budgetSpent)} / {formatKRW(budgetTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>카테고리별 지출</CardTitle>
          </CardHeader>
          <CardContent>
            {(dashboard?.expense_by_category.length ?? 0) > 0 ? (
              <EChart option={donutOption} height={320} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                이번 달 지출이 아직 없어요. 맑은 밤하늘이네요 🌌
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>카테고리별 예산 진행</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dashboard?.budgets.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">설정된 예산이 없습니다.</p>
              )}
              {dashboard?.budgets.map((b) => {
                const rate = b.amount > 0 ? b.spent / b.amount : 0
                return (
                  <div key={b.category_id}>
                    <div className="flex justify-between text-sm">
                      <span>{b.category_name}</span>
                      <span className="text-muted-foreground">
                        {formatKRW(b.spent)} / {formatKRW(b.amount)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${rate > 1 ? 'bg-rose-400' : 'bg-sky-400'}`}
                        style={{ width: `${Math.min(rate, 1) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>최근 거래</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(dashboard?.recent_transactions.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">아직 기록된 거래가 없습니다.</p>
              )}
              {dashboard?.recent_transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={t.kind === 'income' ? 'secondary' : 'outline'}>
                      {t.kind === 'income' ? '수입' : '지출'}
                    </Badge>
                    <span>{t.category_name}</span>
                    <span className="text-xs text-muted-foreground">{t.date}</span>
                  </div>
                  <span className={t.kind === 'income' ? 'text-emerald-400' : 'text-rose-400'}>
                    {t.kind === 'income' ? '+' : '-'}
                    {formatKRW(t.amount)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
