import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

interface EChartProps {
  option: EChartsOption
  height?: number
  className?: string
}

/**
 * Apache ECharts 직접 래핑 컴포넌트.
 * echarts-for-react 대신 useRef/useEffect로 라이프사이클을 직접 관리한다
 * (research.md 권장 — React 19 호환성과 유지보수 리스크 회피).
 */
export function EChart({ option, height = 300, className }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current, 'dark')
    chartRef.current = chart
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

  return <div ref={containerRef} className={className} style={{ height }} />
}
