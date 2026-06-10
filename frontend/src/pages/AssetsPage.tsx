import { useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'

import { EChart } from '@/components/charts/EChart'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatKRW } from '@/lib/format'
import { useAnalyticsStore } from '@/stores/analytics'
import type { AccountType } from '@/types'

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  bank: '은행',
  cash: '현금',
  card: '카드',
  investment: '투자',
  other: '기타',
}

export function AssetsPage() {
  const { assets, fetchAssets } = useAnalyticsStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAssets().catch((e: Error) => setError(e.message))
  }, [fetchAssets])

  const trendOption = useMemo<EChartsOption>(() => {
    const trend = assets?.trend ?? []
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v) => formatKRW(Number(v)) },
      grid: { left: 80, right: 24, top: 24, bottom: 32 },
      xAxis: { type: 'category', data: trend.map((p) => p.month) },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${v / 10000}만` } },
      series: [
        {
          name: '총자산',
          type: 'line',
          smooth: true,
          symbolSize: 6,
          areaStyle: { opacity: 0.15 },
          lineStyle: { width: 2, color: '#fde047' },
          itemStyle: { color: '#fde047' },
          data: trend.map((p) => p.total),
        },
      ],
    }
  }, [assets])

  if (error) {
    return <p className="text-destructive">자산 상태를 불러오지 못했습니다: {error}</p>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">자산 상태</h1>

      <Card className="border-yellow-300/30">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">총자산</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{formatKRW(assets?.total ?? 0)}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {assets?.accounts.map((a) => (
          <Card key={a.id} className={a.is_active ? '' : 'opacity-50'}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>{a.name}</span>
                <span className="flex gap-1">
                  <Badge variant="outline">{ACCOUNT_TYPE_LABEL[a.type]}</Badge>
                  {!a.is_active && <Badge variant="secondary">비활성</Badge>}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-xl font-semibold ${a.balance < 0 ? 'text-rose-400' : ''}`}
              >
                {formatKRW(a.balance)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>월별 자산 추이 (최근 12개월)</CardTitle>
        </CardHeader>
        <CardContent>
          <EChart option={trendOption} height={320} />
        </CardContent>
      </Card>
    </div>
  )
}
