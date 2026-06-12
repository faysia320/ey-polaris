import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

interface EChartProps {
  option: EChartsOption
  height?: number
  className?: string
  /** 시리즈 요소 클릭 핸들러 — 미지정 시 이벤트 바인딩 없음 */
  onClick?: (params: echarts.ECElementEvent) => void
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
    const chart = echarts.init(containerRef.current, 'dark')
    chartRef.current = chart
    chart.on('click', (params) => onClickRef.current?.(params))
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption({ backgroundColor: 'transparent', ...option }, true)
  }, [option])

  // contain: inline-size — echarts가 canvas에 박는 인라인 px 폭이 조상 flex/grid의
  // min-content로 전파되는 것을 차단한다 (전파되면 뷰포트 축소 시 가로 스크롤 데드락)
  return <div ref={containerRef} className={className} style={{ height, contain: 'inline-size' }} />
}
