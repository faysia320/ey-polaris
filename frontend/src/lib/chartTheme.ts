/*
 * ECharts용 SEED 테마.
 *
 * canvas는 CSS를 상속하지 않으므로 색·글꼴을 echarts에 값으로 넘겨야 한다.
 * 값은 SEED CSS 변수에서 런타임에 읽어 하드코딩을 없앤다 — 테마(dark-only)나
 * SEED 버전이 바뀌어도 차트가 따라간다.
 *
 * 변수는 런타임에 바뀌지 않으므로(색상 모드가 dark-only로 고정) 최초 1회만 읽는다.
 * 차트 옵션이 바뀔 때마다 getComputedStyle을 부르면 강제 스타일 재계산이 반복된다.
 */

const cache = new Map<string, string>()

/** `--seed-*` CSS 변수를 읽는다. 없으면 fallback. */
function token(name: string, fallback = '#888'): string {
  const hit = cache.get(name)
  if (hit !== undefined) return hit
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  cache.set(name, value)
  return value
}

/**
 * 카테고리 배색 순서.
 *
 * 색상군을 먼저 한 바퀴 돌고 명도 단계를 내린다 — 인접 계열끼리 붙지 않아
 * 항목이 많아져도 구분이 유지된다. 브랜드색(carrot)은 UI의 CTA와 겹치지 않도록
 * 첫 자리를 피해 세 번째에 둔다.
 */
const PALETTE_HUES = ['blue', 'green', 'carrot', 'purple', 'red', 'yellow'] as const
const PALETTE_STEPS = [500, 700, 300] as const

let palette: string[] | null = null

/** 차트 시리즈 배색 (18색). 같은 인덱스는 항상 같은 색이다. */
export function chartPalette(): string[] {
  if (palette) return palette
  palette = PALETTE_STEPS.flatMap((step) =>
    PALETTE_HUES.map((hue) => token(`--seed-color-palette-${hue}-${step}`)),
  )
  return palette
}

export const chartColors = {
  /** 본문 텍스트 (축 라벨, 범례) */
  text: () => token('--seed-color-fg-neutral', '#eee'),
  /** 보조 텍스트 */
  textMuted: () => token('--seed-color-fg-neutral-muted', '#aaa'),
  /** 밝은 배경 위에 얹는 글자색 — 트리맵 블록 라벨 등 */
  textInverted: () => token('--seed-color-fg-neutral-inverted', '#111'),
  /** 축·그리드 선 */
  line: () => token('--seed-color-stroke-neutral-weak', '#333'),
  /** 차트가 놓이는 표면 — 트리맵 블록 사이 간격을 표면색으로 채워 카드와 이어 보이게 한다 */
  surface: () => token('--seed-color-bg-layer-default', '#16171b'),
  /** 툴팁 배경 */
  floating: () => token('--seed-color-bg-layer-floating', '#1f2024'),
}

/**
 * 블록 배경색의 휘도에 따라 어두운/밝은 라벨색을 골라 대비를 확보한다.
 * SEED 팔레트는 명도 단계가 넓어 한 가지 라벨색으로는 WCAG AA를 못 맞춘다.
 */
export function labelColorOn(color: string): string {
  const hex = normalizeHex(color)
  if (!hex) return chartColors.text()
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  // 임계 0.5 — 0.6이면 중간 톤에 밝은 라벨이 배정돼 대비가 모자란다
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? chartColors.textInverted() : chartColors.text()
}

/** '#f60' / '#ff6600' → 'ff6600'. 그 외 표기는 null. */
function normalizeHex(color: string): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return null
  const v = m[1]
  return v.length === 3 ? v[0] + v[0] + v[1] + v[1] + v[2] + v[2] : v
}
