import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

import { chartColors, chartPalette } from '@/lib/chartTheme'

interface EChartProps {
  option: EChartsOption
  height?: number
  className?: string
  /** 시리즈 요소 클릭 핸들러 — 미지정 시 이벤트 바인딩 없음 */
  onClick?: (params: echarts.ECElementEvent) => void
}

/**
 * 차트 텍스트용 폰트 패밀리. canvas는 CSS를 상속하지 않으므로 echarts에 직접 넘겨야 한다.
 * 값은 index.css의 --font-sans를 그대로 읽어 폰트 정의를 한 곳으로 유지한다.
 * (canvas는 OpenType feature를 적용할 수 없어 tnum/ss17/ss18은 차트에 반영되지 않는다)
 *
 * --font-sans는 런타임에 바뀌지 않으므로 최초 1회만 읽는다 — 차트 옵션이 바뀔 때마다
 * getComputedStyle을 호출하면 강제 스타일 재계산이 반복된다.
 */
let cachedFontFamily: string | null = null
function chartFontFamily(): string {
  if (cachedFontFamily === null) {
    cachedFontFamily =
      getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() ||
      'sans-serif'
  }
  return cachedFontFamily
}

const SEED_THEME_NAME = 'seed'

/**
 * SEED 토큰으로 만든 echarts 테마.
 * 시리즈 색·축·라벨·툴팁을 한곳에서 정하고, 각 차트 옵션은 데이터만 신경 쓰게 한다.
 */
function seedTheme() {
  const text = chartColors.text()
  const muted = chartColors.textMuted()
  const line = chartColors.line()
  const axis = {
    axisLine: { lineStyle: { color: line } },
    axisTick: { lineStyle: { color: line } },
    axisLabel: { color: muted },
    splitLine: { lineStyle: { color: line } },
  }
  return {
    color: chartPalette(),
    backgroundColor: 'transparent',
    textStyle: { color: text, fontFamily: chartFontFamily() },
    title: { textStyle: { color: text }, subtextStyle: { color: muted } },
    legend: { textStyle: { color: muted } },
    tooltip: {
      backgroundColor: chartColors.floating(),
      borderColor: line,
      textStyle: { color: text },
    },
    categoryAxis: axis,
    valueAxis: axis,
    timeAxis: axis,
    logAxis: axis,
  }
}

/**
 * Apache ECharts 직접 래핑 컴포넌트.
 * echarts-for-react 대신 useRef/useEffect로 라이프사이클을 직접 관리한다
 * (research.md 권장 — React 19 호환성과 유지보수 리스크 회피).
 */
export function EChart({ option, height = 300, className, onClick }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  // 핸들러는 ref로 보관해 차트 인스턴스 재생성 없이 항상 최신 콜백을 호출한다
  const onClickRef = useRef(onClick)

  useEffect(() => {
    onClickRef.current = onClick
  }, [onClick])

  useEffect(() => {
    if (!containerRef.current) return
    // echarts 내장 'dark' 테마 대신 SEED 토큰으로 만든 테마를 등록해 쓴다 —
    // 내장 테마는 자체 팔레트/배경색을 들고 있어 앱 색과 따로 논다
    echarts.registerTheme(SEED_THEME_NAME, seedTheme())
    const chart = echarts.init(containerRef.current, SEED_THEME_NAME)
    chartRef.current = chart
    chart.on('click', (params) => onClickRef.current?.(params))
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(containerRef.current)
    // font-display: swap이라 첫 렌더는 폴백 폰트 메트릭으로 그려질 수 있다 —
    // 웹폰트 로드가 끝나면 한 번 다시 그려 SUIT 기준으로 텍스트를 재측정한다
    let disposed = false
    document.fonts?.ready.then(() => {
      if (!disposed) chart.resize()
    })
    return () => {
      disposed = true
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    // 배경·글꼴은 seedTheme이 이미 정하므로 옵션에서 다시 지정하지 않는다
    chartRef.current?.setOption(option, true)
  }, [option])

  // contain: inline-size — echarts가 canvas에 박는 인라인 px 폭이 조상 flex/grid의
  // min-content로 전파되는 것을 차단한다 (전파되면 뷰포트 축소 시 가로 스크롤 데드락)
  return <div ref={containerRef} className={className} style={{ height, contain: 'inline-size' }} />
}
