# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

`ey-polaris` — 가계부/자산 관리 웹 앱. 거래 내역(엑셀 업로드 포함), 카테고리·구성원 관리, 예산, 자산 평가, 분석 대시보드를 제공한다.

- `backend/` — FastAPI + SQLAlchemy 2 + Alembic, PostgreSQL (psycopg3). 라우터: accounts, analytics, budgets, categories, goals, members, transactions, valuations
- `frontend/` — Vite + React 19 + TypeScript + Tailwind CSS 4 + shadcn/radix, 상태는 zustand, 차트는 echarts. 페이지: Dashboard, Transactions, Budgets, Assets, Settings
- `docker-compose.yml` — db(Postgres 18) + backend(8000) + frontend(3000) 전체 스택 기동
- `docs/tasks/`, `docs/history/` — 개발 파이프라인 산출물과 작업 이력

## 명령어

- 전체 스택: `docker compose up --build` (backend OpenAPI 문서: http://localhost:8000/docs, frontend: http://localhost:3000)
- frontend 개발: `cd frontend && npm run dev` / 빌드 검증: `npm run build` (tsc + vite) / 린트: `npm run lint`
- backend 로컬 실행: `cd backend && uvicorn app.main:app --reload` (DB 필요 — `DATABASE_URL` 환경변수 참조: `backend/app/config.py`)
- DB 마이그레이션: `cd backend && alembic upgrade head` / 생성: `alembic revision --autogenerate -m "..."`

## 디자인 시스템 (SEED Design)

UI는 **전부** 당근 [SEED Design](https://seed-design.io)이다. shadcn/ui는 컴포넌트도 토큰도 남아 있지 않다.

### 규칙

- **색·간격·곡률·타이포는 SEED 스케일만 쓴다.** Tailwind 기본 팔레트(`text-rose-400`)와 shadcn 토큰(`bg-primary`)은 금지 — 이 저장소에 0건이다
  - 색: `bg-bg-layer-default` `text-fg-neutral` `text-fg-neutral-muted` `text-fg-critical` `text-fg-positive` `border-stroke-neutral-weak` `bg-bg-brand-solid`
  - 간격: `p-x4` `gap-x3` `mt-x2` (SEED `dimension.x*` = Tailwind와 같은 4px 기반이라 숫자가 그대로 대응한다)
  - 반경: `rounded-r2`(8px) `rounded-r1_5`(6px) `rounded-full`
  - 타이포: `screen-title` `t5-bold` `t4-regular` `t2-regular` `article-body` (크기+굵기가 한 클래스에 묶여 있다 — `text-sm font-medium`처럼 쪼개 쓰지 않는다)
- **세로 간격은 `space-y-*`가 아니라 `flex flex-col gap-x*`로 잡는다.** SEED는 `p-*`/`gap-*`/`m-*`/`w-*`는 `@utility`로 재정의하지만 `space-y-*`는 손대지 않아 `space-y-x6`가 동작하지 않는다. 목록처럼 flex를 못 쓰는 자리에서는 `space-y-(--dimension-x1)`로 토큰을 직접 참조한다
  - (Tailwind 기본 스케일 `p-4`도 여전히 동작한다 — 커스텀 `@utility`가 값을 못 찾으면 내장으로 폴백한다. 금지하는 이유는 기능이 아니라 일관성이다)
- **컨테이너 폭·높이는 예외.** SEED dimension 스케일은 64px(`x16`)에서 끝나므로 `w-40` 같은 레이아웃 치수는 Tailwind 스케일을 쓴다
- **입력 컴포넌트(`TextField`/`SelectRoot`/`FieldButton`)에는 항상 `size="responsive"`를 준다.** 기본값 `large`(52px, 터치 기준)는 데스크톱 표에서 지나치게 두툼하고, 일부만 responsive면 `lg`(1280px) 경계에서 필드 높이가 갈린다. responsive = 1280px 미만 `large` / 이상 `medium`(40px)
- 아이콘은 `@karrotmarket/react-monochrome-icon`. 버튼 안에서는 `Icon`(iconOnly) / `PrefixIcon` / `SuffixIcon` 슬롯을 쓴다
- 색상 모드는 **`dark-only` 고정** (`frontend/vite.config.ts`의 `seedDesignPlugin`)
- CSS cascade layer 순서(`theme, base, seed-base, components, seed-components, utilities`)를 `frontend/index.html`과 `frontend/src/index.css` 양쪽에 선언해 Tailwind 유틸리티가 SEED 컴포넌트 스타일을 덮어쓸 수 있게 했다. **이 순서를 바꾸지 말 것**

### 오버레이 규칙

- **입력·내용 패널은 `ResponsiveSidePanel`** (데스크톱=사이드 드로어, 모바일=바텀시트). 거래 추가/수정, 카테고리·계정·구성원 편집, 엑셀 업로드, 세부 내역 등 화면 단위 오버레이가 전부 여기 해당한다
- **되돌릴 수 없는 확인만 `AlertDialog`** (월 전체 삭제, 계정 삭제, 전월 예산 덮어쓰기). 파괴적 확인은 흐름을 끊어야 하므로 모달을 유지한다
- **`DateField`/`MonthField`의 피커는 `Dialog`** — 패널 위에 겹쳐 뜨는 피커다. 패널로 바꾸면 패널 안의 패널이 된다
- **SEED Tabs 안에서 오버레이를 열면 `Portal`로 감싼다.** `seed-tabs__content`에 transform이 걸려 `position: fixed`의 containing block이 되어, 감싸지 않으면 패널이 뷰포트가 아니라 탭 패널 안에 갇힌다 (`SettingsPage.tsx` 참고)

### SEED에 대응이 없어 직접 유지하는 것 (`src/components/ui/`)

SEED는 모바일 앱 디자인 시스템이라 웹 대시보드 관용구가 없다. 아래 4개가 전부이고, 내부는 SEED 토큰·컴포넌트로만 짠다.

| 파일 | 이유 |
| --- | --- |
| `table.tsx` | SEED에 표 컴포넌트가 없다. 정렬·페이지네이션은 `@tanstack/react-table`이 담당 |
| `Surface.tsx` | 카드 표면. `rounded-r2 + bg-bg-layer-default + border-stroke-neutral-weak` 조합을 한곳에 모은 것 |
| `DateField.tsx` | SEED DatePicker는 트리거 없는 인라인 달력 — FieldButton + Dialog로 감쌌다 |
| `MonthField.tsx` | SEED에 월 단위 선택이 없다. DateField와 같은 뼈대에 12개월 그리드 |

날짜 값은 앱 전역에서 `'YYYY-MM-DD'` 문자열이고, SEED가 쓰는 `{year, month, day}` 변환은 `lib/format.ts`의 `toCalendarDate`/`fromCalendarDate`가 경계에서만 처리한다.

차트(echarts)는 canvas라 CSS를 상속하지 않는다 — `lib/chartTheme.ts`가 SEED CSS 변수를 런타임에 읽어 팔레트·축·툴팁 색을 만든다. **차트에 색을 하드코딩하지 말 것.**

### 작업 방법

- 컴포넌트 추가: `cd frontend && npx @seed-design/cli@latest add ui:<name>` → `src/seed-design/ui/`에 스니펫 설치, `import { X } from 'seed-design/ui/<name>'`로 사용
- 문서 조회: `npx @seed-design/cli@latest docs <name>` / 상세 가이드는 `seed-design` 스킬 로드 / `seed-docs` MCP 서버도 등록돼 있다
- `src/seed-design/`은 CLI가 덮어쓰는 생성 코드다. 손대지 말고 필요하면 감싸는 컴포넌트를 따로 만든다

## 모바일 대응 (UI 필수 제약)

**모든 UI 변경은 모바일 뷰포트에서도 깨지지 않아야 한다.** 이 앱은 모바일 사용을 전제로 한다.

- 기준 뷰포트: **375px** (이 너비에서 가로 스크롤·요소 겹침·잘림이 없어야 함)
- Tailwind는 모바일 퍼스트 — 기본 스타일을 모바일 기준으로 작성하고 `sm:`(640px+)/`md:`/`lg:`로 데스크톱을 확장한다. 고정 px 너비 지양
- 테이블·차트처럼 본질적으로 넓은 콘텐츠는 `overflow-x-auto` 등 명시적 오버플로 처리 또는 모바일 전용 레이아웃을 제공한다
- 터치 대상(버튼·셀 액션)은 모바일에서 조작 가능한 크기를 유지한다
- 개발 파이프라인(/research, /qa)은 UI 작업에 대해 모바일 AC를 계약에 강제한다 — `.claude/skills/README.md` 참조

## 개발 파이프라인

구조화된 작업은 `/research → /implement → /qa → /git-commit` 스킬 파이프라인을 사용한다. 설계 원칙·하네스 가정 테이블은 `.claude/skills/README.md` 참조.

- 커밋 규칙은 `/git-commit` 스킬이 소유 (AI 공동 저자 트레일러 금지, 템플릿: `gitmessage.txt`)
- 단계 산출물은 `docs/tasks/<YYYY-MM-DD>-<slug>/`에 파일로 인계된다
