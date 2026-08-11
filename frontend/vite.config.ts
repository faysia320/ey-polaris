import path from 'node:path'
import { seedDesignPlugin } from '@seed-design/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig, type Plugin } from 'vite'

/** dev 서버에서 SUIT woff2가 서빙되는 경로 — Vite가 CSS의 bare 지정자를 이 형태로 재작성한다 */
const SUIT_DEV_PATH = 'node_modules/@sun-typeface/suit/fonts/variable/woff2/SUIT-Variable.woff2'

/**
 * SUIT woff2(624KB)에 preload를 건다. 걸지 않으면 CSS를 파싱한 뒤에야 폰트를 받기 시작해
 * 폴백(Malgun Gothic 등) → SUIT 전환이 늦어지고 글자가 한 번 바뀌어 보인다(FOUT).
 *
 * href를 index.html에 직접 적지 않는 이유: 빌드 산출물 파일명에 콘텐츠 해시가 붙어
 * (`SUIT-Variable-<hash>.woff2`) 폰트를 갱신하면 하드코딩한 경로가 조용히 깨진다.
 * 번들에서 실제 파일명을 찾아 주입하고, 번들이 없는 dev에서는 node_modules 경로를 쓴다.
 *
 * preload href는 CSS의 `url()`과 완전히 같은 URL이어야 한다 — 어긋나면 624KB를 두 번 받는다.
 * 그래서 base도 Vite가 CSS에 적용하는 것과 동일하게 resolved base를 붙인다.
 */
function preloadSuitFont(): Plugin {
  let base = '/'
  return {
    name: 'preload-suit-font',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const emitted = ctx.bundle && Object.keys(ctx.bundle).find((f) => /SUIT-Variable.*\.woff2$/.test(f))
        const href = `${base.endsWith('/') ? base : `${base}/`}${emitted ?? SUIT_DEV_PATH}`
        return [
          {
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href },
            injectTo: 'head-prepend',
          },
        ]
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // 앱이 다크 고정(index.html의 class="dark")이므로 SEED도 다크로 못박는다.
    // 플러그인은 index.html에 color-scheme 메타와 테마 스크립트를 주입해
    // <html>의 data-seed-color-mode를 런타임에 설정한다.
    seedDesignPlugin({ colorMode: 'dark-only' }),
    preloadSuitFont(),
  ],
  build: {
    // SPA 라우트 /assets 와 빌드 산출물 디렉터리 이름 충돌 방지
    assetsDir: 'static',
  },
  resolve: {
    // SEED React 컴포넌트가 내부 CSS를 import할 때 @layer로 감싼 판(recipes/*.layered.css)을
    // 쓰게 한다. index.css의 @layer 순서 선언과 짝을 이뤄야 Tailwind 유틸리티로
    // SEED 컴포넌트 스타일을 덮어쓸 수 있다.
    // Vite 기본 condition을 지우지 않도록 defaultClientConditions를 이어 붙인다.
    conditions: ['seed-layered', ...defaultClientConditions],
    // seed-design/* 별칭은 tsconfig의 paths를 그대로 따른다 (Vite 8 내장)
    tsconfigPaths: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // 로컬 개발용 — docker 구성에서는 nginx가 /api를 backend로 프록시한다
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
