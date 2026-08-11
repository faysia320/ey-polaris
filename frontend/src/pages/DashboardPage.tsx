import { useEffect, useMemo, useRef, useState } from 'react'
import type { ECElementEvent, EChartsOption } from 'echarts'
import { IconChevronLeftLine, IconChevronRightLine } from '@karrotmarket/react-monochrome-icon'
import { Icon } from '@seed-design/react'
import { ActionButton } from 'seed-design/ui/action-button'
import {
  ResponsiveSidePanelBody,
  ResponsiveSidePanelContent,
  ResponsiveSidePanelRoot,
} from 'seed-design/ui/responsive-side-panel'

import { EChart } from '@/components/charts/EChart'
import { MarkdownView } from '@/components/MarkdownView'
import { MemberFilterSelect } from '@/components/members/MemberFilterSelect'
import { Surface } from '@/components/ui/Surface'
import { api } from '@/lib/api'
import { chartColors, chartPalette, labelColorOn } from '@/lib/chartTheme'
import { addMonths, previousMonth, formatKRW } from '@/lib/format'
import { panelBodyScroll } from '@/lib/utils'
import { useAIReportStore } from '@/stores/aiReport'
import { useAnalyticsStore } from '@/stores/analytics'
import { useMemberFilterStore } from '@/stores/memberFilter'
import type { Transaction } from '@/types'


interface CategoryDetail {
  major: string
  items: Transaction[]
  loading: boolean
  error: string | null
}

export function DashboardPage() {
  const [month, setMonth] = useState(previousMonth())
  const { dashboard, fetchDashboard } = useAnalyticsStore()
  const memberId = useMemberFilterStore((s) => s.memberId)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<CategoryDetail | null>(null)

  // AI 리포트 — 구성원 필터와 무관하게 월 단위로 조회/생성
  const { byMonth, loading: reportLoading, fetch: fetchReport, generate: generateReport } =
    useAIReportStore()
  const report = byMonth[month]
  const [reportError, setReportError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboard(month, memberId)
      .then(() => setError(null))
      .catch((e: Error) => setError(e.message))
  }, [month, memberId, fetchDashboard])

  useEffect(() => {
    fetchReport(month)
      .then(() => setReportError(null))
      .catch((e: Error) => setReportError(e.message))
  }, [month, fetchReport])

  const handleGenerateReport = () => {
    setReportError(null)
    generateReport(month).catch((e: Error) => setReportError(e.message))
  }

  // chartPalette()는 CSS 변수를 1회 읽고 같은 배열을 캐시해 돌려주므로 참조가 안정적이다
  const palette = chartPalette()

  // 트리맵·스택바·범례가 같은 대분류명에 같은 색을 쓰도록 이름 기준으로 배색
  const colorByName = useMemo(() => {
    const names = (dashboard?.expense_by_category ?? []).map((d) => d.category_name)
    for (const b of dashboard?.budgets ?? []) {
      if (!names.includes(b.major)) names.push(b.major)
    }
    return new Map(names.map((n, i) => [n, palette[i % palette.length]]))
  }, [dashboard, palette])

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
          itemStyle: {
            borderRadius: 6,
            borderColor: chartColors.surface(),
            borderWidth: 2,
            gapWidth: 2,
          },
          label: { fontSize: 13, fontWeight: 500 },
          data: data.map((d) => {
            const color = colorByName.get(d.category_name) ?? palette[0]
            return {
              name: d.category_name,
              value: d.amount,
              itemStyle: { color },
              label: {
                color: labelColorOn(color),
                formatter: () => `${d.category_name}\n${formatKRW(d.amount)}`,
              },
            }
          }),
        },
      ],
    }
  }, [dashboard, colorByName, palette])

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
    return <p className="t4-regular text-fg-critical">대시보드를 불러오지 못했습니다: {error}</p>
  }

  const budgetTotal = dashboard?.budget_total ?? 0
  const budgetSpent = dashboard?.budget_spent ?? 0
  const budgets = dashboard?.budgets ?? []
  // 예산 초과 시에도 스택바가 넘치지 않도록 분모를 지출 합계까지 확장
  const stackDenom = Math.max(budgetTotal, budgetSpent)
  const detailTotal = detail?.items.reduce((sum, t) => sum + t.amount, 0) ?? 0

  return (
    <div className="flex flex-col gap-x6">
      <div className="flex flex-wrap items-center justify-between gap-y-x3">
        <h1 className="screen-title">대시보드</h1>
        <div className="flex items-center gap-x2">
          <ActionButton
            variant="neutralOutline"
            size="small"
            layout="iconOnly"
            aria-label="이전 달"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <Icon svg={<IconChevronLeftLine />} />
          </ActionButton>
          <span className="t4-medium w-24 shrink-0 whitespace-nowrap text-center tabular-nums">{month}</span>
          <ActionButton
            variant="neutralOutline"
            size="small"
            layout="iconOnly"
            aria-label="다음 달"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <Icon svg={<IconChevronRightLine />} />
          </ActionButton>
          <MemberFilterSelect />
        </div>
      </div>

      <Surface className="flex flex-col gap-x4">
        <div className="flex flex-wrap items-center justify-between gap-x2">
          <h2 className="t5-bold flex items-center gap-x2">
            <span>🤖</span> AI 리포트
          </h2>
          <ActionButton variant="neutralSolid" size="small" onClick={handleGenerateReport} loading={reportLoading}>
            {report ? '다시 생성' : '리포트 생성'}
          </ActionButton>
        </div>
        {reportError && (
          <p className="t4-regular text-fg-critical">리포트 생성에 실패했습니다: {reportError}</p>
        )}
        {!reportError && report && (
          <div>
            <MarkdownView>{report.content}</MarkdownView>
            <p className="t2-regular mt-x3 text-fg-neutral-muted">
              {month} · {report.model} · {new Date(report.created_at).toLocaleString('ko-KR')}
            </p>
          </div>
        )}
        {!reportError && !report && (
          <p className="t4-regular py-x6 text-center text-fg-neutral-muted">
            {reportLoading
              ? '리포트를 불러오는 중…'
              : '아직 이 달의 AI 리포트가 없어요. 버튼을 눌러 생성해 보세요 ✨'}
          </p>
        )}
      </Surface>

      <div className="grid grid-cols-1 gap-x4 md:grid-cols-3">
        <Surface className="flex flex-col gap-x2">
          <p className="t4-medium text-fg-neutral-muted">이번 달 수입</p>
          <p className="t9-bold text-fg-positive">{formatKRW(dashboard?.income_total ?? 0)}</p>
        </Surface>
        <Surface className="flex flex-col gap-x2">
          <p className="t4-medium text-fg-neutral-muted">이번 달 지출</p>
          <p className="t9-bold text-fg-critical">{formatKRW(dashboard?.expense_total ?? 0)}</p>
        </Surface>
        <Surface className="flex flex-col gap-x2">
          <p className="t4-medium text-fg-neutral-muted">예산 소진율</p>
          <p className="t9-bold">
            {budgetTotal > 0 ? `${Math.round((budgetSpent / budgetTotal) * 100)}%` : '—'}
          </p>
          <div className="flex h-x2 overflow-hidden rounded-full bg-bg-neutral-weak">
            {budgets.map((b) => (
              <div
                key={b.major}
                title={`${b.major} ${formatKRW(b.spent)}`}
                className="h-full"
                style={{
                  width: stackDenom > 0 ? `${(b.spent / stackDenom) * 100}%` : '0%',
                  backgroundColor: colorByName.get(b.major) ?? palette[0],
                }}
              />
            ))}
          </div>
          <p className="t2-regular text-fg-neutral-muted">
            {formatKRW(budgetSpent)} / {formatKRW(budgetTotal)}
          </p>
          {budgets.length > 0 && (
            <ul className="flex flex-col gap-x1">
              {budgets.map((b) => (
                <li key={b.major} className="t2-regular flex items-center justify-between gap-x2">
                  <span className="flex min-w-0 items-center gap-x1_5">
                    <span
                      className="size-x2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: colorByName.get(b.major) ?? palette[0],
                      }}
                    />
                    <span className="truncate">{b.major}</span>
                  </span>
                  <span
                    className={`shrink-0 tabular-nums ${
                      b.spent > b.amount ? 'text-fg-critical' : 'text-fg-neutral-muted'
                    }`}
                  >
                    {formatKRW(b.spent)} / {formatKRW(b.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>

      <Surface className="flex flex-col gap-x4">
        <h2 className="t5-bold">카테고리별 지출</h2>
        {(dashboard?.expense_by_category.length ?? 0) > 0 ? (
          <EChart option={treemapOption} height={400} onClick={handleTreemapClick} />
        ) : (
          <p className="t4-regular py-x12 text-center text-fg-neutral-muted">
            이번 달 지출이 아직 없어요. 맑은 밤하늘이네요 🌌
          </p>
        )}
      </Surface>

      <ResponsiveSidePanelRoot open={detail !== null} onOpenChange={(open) => !open && closeDetail()}>
        <ResponsiveSidePanelContent
          title={`${detail?.major ?? ''} 지출 내역`}
          description={`${month} · ${detail?.items.length ?? 0}건 · 합계 ${formatKRW(detailTotal)}`}
        >
          <ResponsiveSidePanelBody className={panelBodyScroll}>
            {detail?.loading && (
              <p className="t4-regular py-x8 text-center text-fg-neutral-muted">불러오는 중...</p>
            )}
            {detail?.error && (
              <p className="t4-regular py-x8 text-center text-fg-critical">
                세부 내역을 불러오지 못했습니다: {detail.error}
              </p>
            )}
            {detail && !detail.loading && !detail.error && (
              /* 높이를 제한하지 않는다 — SEED SidePanelBody가 이미 스크롤 컨테이너다.
                 안쪽에 max-h를 두면 패널 높이가 남는데도 짧은 스크롤 영역이 하나 더 생긴다
                 (다이얼로그였던 시절의 잔재) */
              <div>
                {detail.items.length === 0 && (
                  <p className="t4-regular py-x8 text-center text-fg-neutral-muted">
                    해당 카테고리의 거래가 없습니다.
                  </p>
                )}
                {detail.items.map((t) => (
                  <div
                    key={t.id}
                    className="t4-regular flex items-center justify-between gap-x3 border-b border-stroke-neutral-weak py-x1_5 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-x2">
                        <span className="t2-regular tabular-nums text-fg-neutral-muted">
                          {t.date}
                        </span>
                        <span className="truncate">{t.category_name}</span>
                      </div>
                      {t.memo && (
                        <p className="t2-regular truncate text-fg-neutral-muted">{t.memo}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">{formatKRW(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </ResponsiveSidePanelBody>
        </ResponsiveSidePanelContent>
      </ResponsiveSidePanelRoot>
    </div>
  )
}
