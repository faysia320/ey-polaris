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
