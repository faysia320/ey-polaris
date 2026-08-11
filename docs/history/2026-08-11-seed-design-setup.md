# 작업 이력: SEED Design 디자인 시스템 도입 준비

- **날짜**: 2026-08-11
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

당근 [SEED Design](https://seed-design.io)을 프론트엔드에 도입할 수 있는 토대를 깔았다. 패키지·빌드 설정·CSS cascade layer·CLI·AI 통합 도구까지가 이번 범위이고, **기존 화면을 SEED 컴포넌트로 교체하는 마이그레이션은 하지 않았다.**

기존 shadcn/ui와 **병존**하는 구성이다. shadcn CSS 변수(`--primary`, `--background` 등)를 SEED 토큰으로 재매핑하지 않았으므로 현재 5개 페이지의 외관은 픽셀 단위로 그대로다. 앞으로 만드는 UI부터 SEED 컴포넌트와 토큰을 쓸 수 있다.

참조 프로젝트인 `rocket-expense`와는 스택이 달라 설정을 그대로 복사할 수 없었다.

| | rocket-expense | ey-polaris (이번 작업) |
| --- | --- | --- |
| Tailwind | v3 + `@seed-design/tailwind3-plugin` | **v4 + `@seed-design/tailwind4-theme`** |
| SEED CSS | `base.css` (unlayered) | **`base.layered.css` + cascade layers** |
| Vite | 7 (`vite-tsconfig-paths` 필요) | **8** (`resolve.tsconfigPaths` 내장) |
| 색상 모드 | `light-only` | **`dark-only`** |
| shadcn 토큰 | SEED로 전면 재매핑 | **재매핑 안 함** (병존) |

rocket-expense는 Tailwind 3의 preflight가 unlayered라 SEED 레시피를 눌러버리는 문제로 layered 방식을 포기했지만(해당 저장소 `frontend/src/main.tsx` 주석), Tailwind 4는 preflight까지 레이어에 들어가므로 여기서는 공식 권장 경로인 layered 방식을 그대로 쓸 수 있었다.

## 변경 파일 목록

- `frontend/package.json`, `frontend/package-lock.json` - `@seed-design/react` `@seed-design/css` `@seed-design/tailwind4-theme` 추가, `@seed-design/vite-plugin`(dev) 추가
- `frontend/seed-design.json` (신규) - CLI 설정. 스니펫 설치 경로 `./src/seed-design`
- `frontend/vite.config.ts` - `seedDesignPlugin({ colorMode: 'dark-only' })`, `resolve.conditions`에 `seed-layered` 추가, `resolve.tsconfigPaths: true`
- `frontend/src/index.css` - `@layer` 순서 선언, `base.layered.css` / `@seed-design/tailwind4-theme` import 추가
- `frontend/index.html` - `<head>` 최상단에 `@layer` 순서 인라인 선언
- `frontend/tsconfig.json`, `frontend/tsconfig.app.json` - `seed-design/*` 경로 별칭
- `frontend/eslint.config.js` - `src/seed-design/**`(CLI 생성 스니펫) 규칙 예외
- `frontend/src/seed-design/ui/` (신규) - CLI로 받은 첫 스니펫 3종 (`action-button`, 의존 컴포넌트 `loading-indicator` / `progress-circle`)
- `.claude/skills/seed-design/` (신규), `skills-lock.json` (신규) - SEED Design Claude Code 스킬
- `.gitignore` - `.agents/` 무시
- `CLAUDE.md` - "디자인 시스템 (SEED Design)" 섹션 추가

## 상세 변경 내용

### CSS cascade layer — 이번 셋업의 핵심

SEED CSS는 기본적으로 `@layer` 없이 제공되는데, unlayered 스타일은 layered 스타일보다 **항상** 우선순위가 높다. 그대로 두면 `<ActionButton className="bg-red-500">`처럼 Tailwind 유틸리티로 SEED 컴포넌트를 조정하는 것이 불가능하다.

이를 세 곳에서 맞물리게 설정했다.

1. `src/index.css`의 `@layer theme, base, seed-base, components, seed-components, utilities;` — `utilities`가 `seed-components`보다 뒤에 와야 Tailwind가 이긴다
2. `vite.config.ts`의 `resolve.conditions: ['seed-layered', ...defaultClientConditions]` — SEED React 컴포넌트가 내부적으로 CSS를 import할 때 `recipes/*.layered.css`를 쓰게 한다. Vite 기본 condition을 지우지 않도록 `defaultClientConditions`를 이어 붙였다
3. `index.html`의 인라인 `<style>` — 빌드에서 CSS가 여러 청크로 쪼개지면 `@layer seed-components` 블록이 먼저 로드돼 순서가 뒤집힐 수 있다. 모든 `<link rel="stylesheet">`보다 앞선 정적 선언이 순서를 확정한다. `vite.config.ts`의 `transformIndexHtml` 훅을 쓰지 않은 이유는 기존 `preloadSuitFont` 플러그인도 `head-prepend`를 쓰고 있어 두 훅의 상대 순서가 보장되지 않기 때문

**이 순서를 바꾸면 SEED 컴포넌트를 Tailwind로 조정할 수 없게 된다.**

### 색상 모드

앱이 `index.html`의 `class="dark"`와 `main.tsx`에서 다크로 못박혀 있으므로 SEED도 `dark-only`로 고정했다. 플러그인은 `<html>`에 `data-seed-color-mode="dark-only"`를 런타임에 설정하는 스크립트와 `<meta name="color-scheme" content="dark">`를 index.html에 주입한다.

### 알아둘 점

- **`@seed-design/tailwind4-theme`가 `--radius-full: 9999px`를 정의해 Tailwind 기본 `rounded-full`(`calc(infinity * 1px)`)을 덮는다.** 실사용 크기에서는 결과가 같지만 알아둘 것
- `--font-weight-medium`/`--font-weight-bold`도 덮지만 값이 Tailwind 기본과 동일(500/700)하다
- 팔레트 토큰은 `--color-palette-red-500`처럼 접두사가 붙어 Tailwind 기본 `--color-red-500`과 충돌하지 않는다. 그 외 366개 토큰 키 전부를 앱의 `@theme inline` 키와 대조해 충돌이 없음을 확인했다
- `base.layered.css`에는 전역 `font-family` 선언이 없어, `seed-base`가 `base`보다 우선순위가 높음에도 SUIT 폰트 설정이 그대로 유지된다
- **`.agents/`를 gitignore한 이유**: `npx skills add`는 스킬을 `.agents/skills/`에 두고 `.claude/skills/`에 심볼릭 링크를 건다. 이 환경은 `core.symlinks=false`라 git이 링크를 실제 파일로 풀어 담아 같은 내용이 두 벌 커밋된다. 커밋 대상은 `.claude/skills/` 한 곳으로 두고 재설치는 `skills-lock.json`으로 복원한다
- Docs MCP(`claude mcp add seed-docs -- npx -y @seed-design/docs-mcp`)는 사용자 로컬 설정(`~/.claude.json`)에 등록했다 — 저장소에 커밋되지 않는다

## 테스트 방법

1. `cd frontend && npm install && npm run build && npm run lint` (lint는 기존 TanStack 경고 2건만 남아야 한다)
2. `npm run dev` 후 브라우저에서:
   - `document.documentElement.dataset.seedColorMode`가 `"dark-only"`인지
   - `getComputedStyle(document.documentElement).getPropertyValue('--seed-color-bg-layer-default')`가 다크 값(`#16171b`)인지
   - Dashboard / 자산 상태 / 지출·수입 내역 / 예산 설정 / 기준정보 관리 5개 페이지가 이전과 동일하게 보이는지 (**회귀 없음이 이번 작업의 성공 기준**)
3. **레이어 순서 검증** — 아무 페이지에 아래를 임시로 넣고 세 요소가 각각 주황 / 빨강 / 브랜드 약배경으로 보이는지 확인한 뒤 제거한다. 가운데가 주황이면 레이어 순서가 깨진 것이다

   ```tsx
   import { ActionButton } from 'seed-design/ui/action-button'
   // ...
   <ActionButton>SEED 기본</ActionButton>
   <ActionButton className="bg-red-500">Tailwind 오버라이드</ActionButton>
   <span className="t4-bold text-fg-brand bg-bg-brand-weak rounded-r2 p-x3">SEED 토큰 유틸</span>
   ```

4. 375px 뷰포트에서 전 페이지 가로 스크롤·잘림이 없는지 확인
5. 배포 반영에는 프론트엔드 컨테이너 재빌드가 필요하다

## 다음 단계 (이번 범위 아님)

- shadcn 변수 → SEED 토큰 재매핑 (rocket-expense `frontend/src/index.css` 방식). 적용하면 앱 전체가 SEED 다크 팔레트로 바뀐다
- echarts 차트 색상을 SEED 팔레트 토큰으로 통일
- 기존 `src/components/ui/` 15개 중 SEED에 대응이 있는 것부터 교체
