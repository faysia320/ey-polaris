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

당근 [SEED Design](https://seed-design.io)을 도입했다. 기존 shadcn/ui와 **병존**한다 — SEED 파운데이션만 얹었고 shadcn CSS 변수(`--primary`, `--background` 등)는 SEED로 재매핑하지 않았다.

- **신규 UI는 SEED 컴포넌트 우선**. 대응 컴포넌트가 없으면 기존 `src/components/ui/`(shadcn)를 쓴다
- **한 컴포넌트 안에서 두 체계를 섞지 말 것** — SEED 스니펫에는 SEED 토큰(`bg-bg-*`, `text-fg-*`, `border-stroke-*`), shadcn 컴포넌트에는 shadcn 토큰(`bg-primary`, `text-muted-foreground`)
- SEED 토큰 유틸리티: 색상 `bg-bg-brand-solid`/`text-fg-neutral`/`bg-palette-blue-500`, 타이포 `t4-bold`/`screen-title`, 간격 `p-x3`/`gap-x4`/`size-x6`, 반경 `rounded-r2`
- 컴포넌트 추가: `cd frontend && npx @seed-design/cli@latest add ui:<name>` → `src/seed-design/ui/`에 스니펫 설치, `import { X } from 'seed-design/ui/<name>'`로 사용
- 문서 조회: `npx @seed-design/cli@latest docs <name>` / 상세 가이드는 `seed-design` 스킬 로드
- 색상 모드는 **`dark-only` 고정** (`frontend/vite.config.ts`의 `seedDesignPlugin`) — 앱 전체가 다크 전용이다
- CSS cascade layer 순서(`theme, base, seed-base, components, seed-components, utilities`)를 `frontend/index.html`과 `frontend/src/index.css` 양쪽에 선언해 Tailwind 유틸리티가 SEED 컴포넌트 스타일을 덮어쓸 수 있게 했다. **이 순서를 바꾸지 말 것**

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
