import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // SPA 라우트 /assets 와 빌드 산출물 디렉터리 이름 충돌 방지
    assetsDir: 'static',
  },
  resolve: {
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
