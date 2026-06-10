# Implementation: '으니영이의 북극성' 가계부 웹앱 1차 구현

- 날짜: 2026-06-10
- 기반 명세: docs/tasks/2026-06-10-polaris-app-scaffold/research.md

## 변경 파일

### 루트
- `.gitignore` — node_modules, dist, __pycache__, .venv, .env 등 추가
- `docker-compose.yml` — db(postgres:18) + backend + frontend 3컨테이너, named volume, healthcheck, 기동 순서

### backend/ (신규)
- `requirements.txt` — fastapi 0.136 / uvicorn 0.49 / sqlalchemy 2.0 / alembic / psycopg3 / pydantic 2.13
- `app/config.py`, `app/database.py` — DATABASE_URL 환경변수 기반 엔진/세션
- `app/models.py` — SQLAlchemy 2.0 모델 5종 (members/accounts/categories/transactions/budgets, FK RESTRICT)
- `app/schemas.py` — pydantic v2 스키마 (amount gt=0, year_month 패턴 검증 포함)
- `app/routers/{members,accounts,categories,transactions,budgets}.py` — CRUD (404/409/422 에러 처리)
- `app/routers/analytics.py` — 대시보드 집계, 자산 상태(계정별 잔액 + 12개월 추이)
- `app/routers/utils.py` — get_or_404, IntegrityError→409 공통 헬퍼
- `app/main.py` — FastAPI 앱, /api/v1 prefix, /health, CORS(로컬 dev용)
- `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako` — Alembic 구성
- `alembic/versions/0001_initial_schema.py` — 스키마 생성 (create_all 미사용)
- `alembic/versions/0002_seed_master_data.py` — 기본 기준정보 시드 (구성원 2, 계정 2, 카테고리 16)
- `Dockerfile`, `.dockerignore` — python:3.14-slim, 기동 시 `alembic upgrade head` 후 uvicorn

### frontend/ (신규, create-vite react-ts 기반)
- `package.json` — React 19.2 / Vite 8.0 / TS 6.0 / Tailwind 4.3 / shadcn 4.11 / zustand 5.0 / @tanstack/react-table 8.21 / echarts 6.1 / react-router 7.17
- `vite.config.ts` — @ alias, tailwind 플러그인, dev 프록시, assetsDir=static
- `tsconfig.json`, `tsconfig.app.json` — paths 별칭 (TS 6.0 deprecation으로 baseUrl 미사용)
- `src/index.css` — shadcn init이 생성한 Tailwind v4 테마 (다크 모드 고정 사용)
- `src/components/ui/*` — shadcn CLI로 추가한 10종 (button/card/dialog/input/label/select/table/tabs/badge/separator)
- `src/components/charts/EChart.tsx` — echarts 직접 래핑 (useRef/useEffect + ResizeObserver)
- `src/components/layout/AppLayout.tsx` — 사이드바 내비게이션 (북극성 브랜딩)
- `src/lib/api.ts`, `src/lib/format.ts`, `src/types.ts` — fetch 클라이언트, KRW/월 헬퍼, API 타입
- `src/stores/{masterData,transactions,budgets,analytics}.ts` — zustand 스토어 4종
- `src/pages/DashboardPage.tsx` — 요약 카드, 북극성 가이드 메시지, ECharts 도넛, 예산 진행 바, 최근 거래
- `src/pages/AssetsPage.tsx` — 총자산/계정별 잔액 카드, ECharts 12개월 추이 라인
- `src/pages/TransactionsPage.tsx` — TanStack Table (정렬/페이지네이션) + 월/구분/카테고리 필터 + 추가/수정/삭제 다이얼로그
- `src/pages/SettingsPage.tsx` — 탭 3종 (카테고리/자산 계정/구성원) CRUD
- `src/pages/BudgetsPage.tsx` — 월 선택 + 카테고리별 예산 입력/수정/삭제
- `src/App.tsx`, `src/main.tsx`, `index.html` — React Router 7 라우트 5개, 다크 테마, 한국어 타이틀
- `eslint.config.js` — shadcn 생성 파일(components/ui)에 react-refresh 규칙 예외
- `Dockerfile`, `nginx.conf`, `.dockerignore` — node:24 빌드 → nginx 서빙, /api 프록시, SPA 폴백

## 주요 결정
- **echarts 직접 래핑** (research.md 권장안 채택) — echarts-for-react 미사용
- **시드를 Alembic data migration(0002)으로 구현** — alembic 버전 관리로 1회만 실행되므로 멱등성이 구조적으로 보장됨
- **nginx try_files에서 `$uri/` 제거 + Vite assetsDir=static** — SPA 라우트 `/assets`가 빌드 산출물 디렉터리 `dist/assets/`와 충돌해 301이 발생했던 문제 수정
- **frontend Dockerfile에서 `npm ci` 대신 `npm install`** — Windows에서 생성한 lockfile에 linux용 optional 의존성(@emnapi/*)이 누락되는 npm 크로스 플랫폼 버그 회피 (코드 내 주석으로 사유 기록)
- **TS 6.0의 baseUrl deprecation** — baseUrl 제거하고 paths만 사용 (5.9 폴백 불필요했음)
- **postgres:18 볼륨을 `/var/lib/postgresql`에 마운트** — PG18 공식 이미지의 변경된 마운트 지점 반영
- **db 포트는 호스트에 미공개** — 충돌 방지. backend 8000, frontend 3000 공개
- 구성원 삭제는 SET NULL(태그 성격), 카테고리/계정 삭제는 RESTRICT→409
- 거래 kind와 카테고리 kind 불일치 시 422 (명세 외 추가 검증)

## 자체 검증 결과
- `python -m compileall backend/app backend/alembic` → 통과
- `npm run build` (tsc -b + vite build) → 통과 (echarts 포함으로 번들 500kB 초과 경고만 존재)
- `npm run lint` → 통과 (오류 0; TanStack Table + React Compiler 정보성 경고 1건은 라이브러리 특성)
- `docker compose up --build -d` → 3컨테이너 정상 기동 (db healthy)
- API 검증 (nginx 프록시 :3000 경유):
  - 시드: 카테고리 16, 구성원 2(으니/영이), 계정 2 확인
  - 거래 2건 생성(지출 15,000 / 수입 3,000,000) → 201, 조인 필드(category_name 등) 정상
  - 예산 생성(2026-06 식비 400,000) → 201
  - 대시보드: income_total=3,000,000 / expense_total=15,000 / budget_total=400,000 / budget_spent=15,000 ✓
  - 자산: 우리집 통장 잔액 2,985,000 (= 0 + 수입 − 지출), 추이 2026-06=2,985,000 ✓
  - 필터: month+kind 조합 정상 ✓
  - 에러: 음수 금액 422 / 없는 카테고리 404 / 참조 중 카테고리 삭제 409 / 중복 예산 409 / kind 불일치 422 ✓
- AC-9: `docker compose restart` 후 거래 2건 유지 ✓
- AC-8: `down -v` → `up` 클린 기동 시 카테고리 16·거래 0, backend 재시작(alembic 재실행) 후에도 16 (중복 시드 없음) ✓
- SPA 라우트 5종 모두 200 (수정 전 /assets 301 → 수정 후 200) ✓
- `/docs`(OpenAPI) 200 ✓

## 성공 기준 자가 체크
- [x] AC-1: 클린 상태에서 `docker compose up --build` 1회로 3컨테이너 기동, frontend :3000 200 — 실제 수행으로 확인
- [x] AC-2: 5개 라우트 모두 200 — curl로 확인 (브라우저 렌더·내비게이션 클릭은 /qa에서 확인 필요)
- [x] AC-3: 기준정보 3종 CRUD API 동작 + DB 영속 확인 — UI 조작 검증은 /qa 몫
- [x] AC-4: 거래 등록 → 내역 조회·대시보드 합계/카테고리 차트 데이터 반영 확인 (API 레벨)
- [x] AC-5: 예산 입력 → 대시보드 budget_total/spent 반영 확인. 가이드 메시지는 프론트 로직(소진율 vs 월 경과율) 구현됨 — UI 표시는 /qa에서 확인
- [x] AC-6: 계정 잔액 2,985,000 = 개설 0 + 3,000,000 − 15,000 수동 대조 일치
- [x] AC-7: 그리드 정렬/필터 — 필터는 API 검증 완료, 정렬·페이지네이션은 TanStack 클라이언트 구현 (UI 확인은 /qa)
- [x] AC-8: Alembic으로만 스키마 생성(create_all 미사용), 클린 기동 시드 16건, 재기동 중복 없음 — down -v 반복으로 확인
- [x] AC-9: restart 후 데이터 유지 — 실제 수행으로 확인
- [x] AC-10: /docs 200, CRUD·집계 엔드포인트 노출 — 확인
- [x] AC-11: package.json(zustand/@tanstack/react-table/echarts/react19/tailwind4), components/ui(shadcn), requirements.txt(fastapi/sqlalchemy2/alembic) — 파일 확인
- [x] AC-12: 음수 금액 422, 없는 ID 404, 참조 삭제 409 + 명시적 한국어 오류 메시지 — curl 5케이스 확인

## 보류/미완 항목
- UI 클릭 수준의 검증(AC-2~7의 브라우저 조작)은 독립 평가자(/qa)에서 수행 필요 — API 레벨은 전부 검증 완료
- CLAUDE.md의 "빈 저장소" 문구(CLAUDE.md:5-9)는 이번 구현으로 무효화됨 — `/init` 재실행으로 갱신 권장 (별도 작업)
- 검증 후 DB는 클린 상태(시드만)로 남김. 컨테이너는 기동 중 (http://localhost:3000)
- 후속 단계 후보 (research.md 미해결 질문): 계좌 간 이체 거래, '목표 행성' 저축 목표 게이미피케이션
