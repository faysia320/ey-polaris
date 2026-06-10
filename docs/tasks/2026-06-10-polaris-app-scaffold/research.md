# Research: '으니영이의 북극성' 가계부 웹앱 1차 구현 (스캐폴드 + 핵심 화면)

- 날짜: 2026-06-10
- 요청 원문: '으니영이의 북극성' 부부 가계부 웹앱을 만든다. 기술스택은 React, FastAPI, PostgreSQL 각각 최신 버전. 로그인 불필요. Docker 이미지로 빌드해 로컬 Docker에서 띄워 확인. UI 컴포넌트는 shadcn/ui, 상태관리 zustand, 데이터 그리드 TanStack Table, 차트 Apache ECharts. 메뉴 구조: 대시보드(첫 화면) → 자산 상태 / 지출·수입 내역 / 기준정보 관리 / 예산 설정. 우선 여기까지 구현하고 다음 단계로 이어간다. (우주/별 모티브 콘셉트: 목표 행성, 정기 궤도/유성우, 북극성 예산 가이드 메시지)

## 사용자 확정 사항 (AskUserQuestion 답변)

1. **Docker 구성**: docker-compose 3컨테이너 — frontend(nginx 정적 서빙) + backend(FastAPI) + db(PostgreSQL)
2. **데이터 초기화**: 스키마는 **Alembic 마이그레이션 코드로 관리**, 시드는 **기본 기준정보만** (거래 내역 샘플 없음)
3. **기준정보 관리 범위**: 카테고리, 자산 계정, 가족 구성원(사용자) 태그 — 결제 수단 별도 엔티티는 제외

## 요약

저장소는 소스 코드가 전혀 없는 그린필드 상태다(Glob 전체 탐색 결과: `.claude/`, `docs/`, `scripts/`, `CLAUDE.md`, `.gitignore`만 존재 — `CLAUDE.md:5-9`도 "빈 저장소"로 명시). 따라서 이번 작업은 기존 코드 통합 없이 모노레포 구조(`frontend/` + `backend/` + 루트 docker-compose)를 신규 생성하는 작업이다. 2026-06-10 기준 최신 안정 버전을 웹 조사로 확정했으며(아래 버전 표), React 19 ↔ 주요 라이브러리 간 차단급 호환성 충돌은 발견되지 않았다. 1차 범위는 5개 화면(대시보드/자산 상태/지출·수입 내역/기준정보 관리/예산 설정)과 이를 지탱하는 DB 스키마·REST API·Docker 구성까지이고, '목표 행성(저축 목표)' 게이미피케이션은 후속 단계로 미룬다(메뉴/스키마에 확장 여지만 남김).

## 확정 기술 스택 버전 (2026-06-10 웹 조사 결과)

| 영역 | 기술 | 버전 | 비고 |
|---|---|---|---|
| Frontend | React / react-dom | 19.2.x | |
| | Vite | 8.0.x | v8은 Rolldown(Rust) 번들러 — 빌드 후 산출물 검증 필요 |
| | TypeScript | 6.0.x | 6.0은 과도기 릴리스(deprecation 다수) — 문제 시 5.9.x 폴백은 구현 재량 |
| | Tailwind CSS | 4.3.x | shadcn/ui가 v4 기본 지원 |
| | shadcn CLI | 4.11.x | React 19 + Tailwind v4 완전 지원 |
| | Zustand | 5.0.x | |
| | @tanstack/react-table | 8.21.x | v8이 최신 stable |
| | Apache ECharts | 6.1.x | echarts-for-react(3.0.6)는 설치 호환되나 유지보수 저조 — **직접 래핑(useRef/useEffect) 권장**, 최종 선택은 구현 재량 |
| | React Router | 7.17.x | declarative mode(SPA 라이브러리 방식) 사용 |
| Backend | Python | 3.14 (docker `python:3.14-slim`) | 로컬은 3.12.4이나 컨테이너 기준 3.14 |
| | FastAPI | 0.136.x | Python 3.14 공식 지원 |
| | SQLAlchemy | 2.0.x (2.0.50+) | 2.0 스타일(Mapped/mapped_column) |
| | Alembic | 최신 stable (1.x) | 스키마 마이그레이션 관리 (사용자 확정) |
| | uvicorn / pydantic | 0.49.x / 2.13.x | |
| DB | PostgreSQL | 18 (docker `postgres:18`) | |
| 빌드 | Node.js | 24 LTS (docker `node:24`) | 로컬 24.11.1과 일치 |

로컬 실행 환경: Docker 29.5.3 + Docker Compose v5.1.4 확인됨 (Bash 실행으로 확인) — compose 기반 검증 가능.

## 관련 파일 및 근거

- `CLAUDE.md:5-9` — 빈 저장소임을 명시. 프로젝트가 형태를 갖추면 `/init` 재실행 안내 → 이번 구현 후 CLAUDE.md 갱신 필요
- `.claude/skills/README.md:19-24` — 파이프라인 인계 계약(작업 폴더·산출물 파일명 규약). 이 문서 자체가 그 계약을 따름
- `.gitignore:1-2` — 현재 `.claude/settings.local.json`만 무시 → `node_modules/`, `__pycache__/`, `.venv/`, `dist/`, `.env` 등 추가 필요
- `frontend/`, `backend/`, `docker-compose.yml` — 미존재. 전부 신규 생성
- 버전·호환성 근거 — 백그라운드 웹 조사(npm registry, PyPI, endoflife.date, vite.dev, ui.shadcn.com, nodejs.org dist) 결과. 코드베이스 외부 근거임

## 영향도

- 없음 — 기존 소스 코드가 없어(전체 파일 탐색으로 확인) 신규 파일 추가만 수행한다. 단, `.gitignore`는 수정(추가)이 필요하고, 기존 `scripts/task-status.py`·스킬 문서와는 경로가 겹치지 않는다.

## 시스템 설계 (고수준)

### 디렉터리 구조

```
ey-polaris/
├── docker-compose.yml
├── frontend/          # Vite + React 19 + TS, shadcn/ui, Dockerfile(node:24 빌드 → nginx 서빙)
├── backend/           # FastAPI + SQLAlchemy 2.0 + Alembic, Dockerfile(python:3.14-slim)
└── (기존 docs/, scripts/, .claude/ 유지)
```

### DB 스키마 (엔티티와 관계만 — 컬럼 세부는 구현 재량)

- **members** (가족 구성원 태그): 이름, 표시 색상 등. 로그인 없음 — 거래에 "누구의 것" 태그 용도
- **accounts** (자산 계정): 이름, 유형(은행/현금/카드/투자 등), 개설 시점 잔액(opening balance), 활성 여부. 현재 잔액은 `opening_balance + 거래 합산`으로 계산 (잔액 컬럼 비정규화 금지)
- **categories** (카테고리): 이름, 수입/지출 구분, 고정/변동 구분(콘셉트 네이밍 '정기 궤도'/'유성우'는 UI 표시 층에서만 사용)
- **transactions** (거래): 일자, 금액, 수입/지출 구분, 카테고리 FK, 계정 FK, 구성원 FK(nullable), 메모
- **budgets** (예산): 대상 연월(YYYY-MM), 카테고리 FK, 금액 — (연월, 카테고리) 유니크

1차 범위에서 **계좌 간 이체(transfer) 거래 유형은 제외**한다(후속 단계 — 미해결 질문 참조). 통화는 KRW 단일, 금액은 정수(원 단위)로 다룬다.

### 백엔드 API (REST, `/api/v1` prefix)

- members / accounts / categories / budgets: 표준 CRUD
- transactions: CRUD + 목록 필터(기간, 카테고리, 계정, 구성원, 수입/지출)
- 집계 엔드포인트: 대시보드 요약(이번 달 수입/지출 합계, 카테고리별 지출, 예산 대비 진행률), 자산 상태(계정별 현재 잔액, 총자산, 월별 자산 추이)
- FastAPI 자동 OpenAPI 문서(`/docs`) 활성 상태 유지
- 에러 처리: 존재하지 않는 ID → 404, 유효성 위반(음수 금액, 잘못된 연월 형식 등) → 422, FK로 참조 중인 기준정보 삭제 시도 → 409 또는 비활성화 처리(구현 재량이되 명시적 에러 메시지 필수)

### 프론트엔드 화면 (5개 라우트)

공통: 사이드바 내비게이션 레이아웃(shadcn/ui), 우주/별 모티브 다크 테마 톤, 서버 상태는 zustand 스토어 + fetch 기반 API 클라이언트

1. **대시보드 `/`** — 이번 달 수입/지출/잔여 예산 요약 카드, 카테고리별 지출 도넛 차트(ECharts), 예산 소진율 기반 '북극성 가이드' 메시지(예: 소진율>페이스 시 "북극성이 흐려지고 있어요"), 최근 거래 목록
2. **자산 상태 `/assets`** — 계정별 현재 잔액 카드/목록, 총자산, 월별 자산 추이 라인 차트(ECharts)
3. **지출/수입 내역 `/transactions`** — TanStack Table 그리드(정렬·필터·페이지네이션), 거래 추가/수정/삭제 다이얼로그(shadcn Dialog + Form)
4. **기준정보 관리 `/settings`** — 탭 3개(카테고리/자산 계정/구성원) 각각 CRUD
5. **예산 설정 `/budgets`** — 연월 선택, 카테고리별 예산 금액 입력/수정, 예산 대비 실적 표시

### Docker 구성

- `db`: `postgres:18`, named volume으로 데이터 영속화, healthcheck
- `backend`: `python:3.14-slim`, 기동 시 `alembic upgrade head` 실행 후 uvicorn 구동, db healthcheck 의존
- `frontend`: `node:24`로 빌드 → nginx 이미지로 정적 서빙, `/api` 요청을 backend로 reverse proxy (CORS 회피)
- 시드: 기본 기준정보(기본 카테고리 약 10종, 기본 계정 1~2개, 구성원 '으니'/'영이')만 — Alembic data migration 또는 멱등 시드 스크립트(구현 재량, 단 재기동 시 중복 생성 금지)
- 호스트 포트는 구현 재량(관례: frontend 3000, backend 8000, db 5432 — 충돌 시 변경 가능, README/implementation.md에 기재)

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: 클린 상태(`docker compose down -v` 후)에서 `docker compose up --build` 한 번으로 3개 컨테이너가 모두 기동되고, 브라우저로 frontend 포트 접속 시 대시보드가 렌더링된다 — 실제 compose 기동 + 브라우저(또는 curl로 index.html 200) 확인
- [ ] AC-2: 사이드바에서 대시보드/자산 상태/지출·수입 내역/기준정보 관리/예산 설정 5개 메뉴로 이동 시 각 화면이 오류 없이 렌더링된다 — 브라우저에서 5개 라우트 순회로 확인
- [ ] AC-3: 기준정보 관리에서 카테고리·계정·구성원 각각 생성/수정/삭제가 동작하고 새로고침 후에도 유지된다 — UI 조작 + 새로고침으로 확인
- [ ] AC-4: 거래(지출/수입) 등록 시 내역 그리드에 나타나고, 대시보드의 이번 달 합계·카테고리별 차트에 반영된다 — 거래 1건 등록 후 두 화면 비교로 확인
- [ ] AC-5: 예산 설정에서 특정 연월·카테고리에 예산을 입력하면 대시보드에 예산 대비 소진율과 '북극성 가이드' 메시지가 표시된다 — 예산 입력 후 대시보드 확인 (메시지 문구·임계값은 구현 재량)
- [ ] AC-6: 자산 상태 화면의 계정별 잔액이 `개설 잔액 + 거래 합산`과 일치한다 — 알려진 금액의 거래를 등록하고 표시 잔액을 수동 계산과 대조해 확인
- [ ] AC-7: 내역 그리드에서 정렬과 필터(최소: 기간 또는 카테고리)가 동작한다 — UI 조작으로 확인
- [ ] AC-8: 스키마가 Alembic 마이그레이션으로만 생성되고(`create_all` 미사용), 클린 DB 기동 시 기본 기준정보가 시드되며, 재기동 시 중복 시드되지 않는다 — `down -v` → `up` 2회 반복 후 기준정보 건수 확인
- [ ] AC-9: 컨테이너 재시작(`docker compose restart`, 볼륨 유지) 후 입력했던 데이터가 보존된다 — 재시작 전후 데이터 비교로 확인
- [ ] AC-10: backend의 `/docs`(OpenAPI)가 접근 가능하고 CRUD·집계 엔드포인트가 노출된다 — 브라우저/curl로 확인
- [ ] AC-11: 지정 스택 사용이 코드로 확인된다 — frontend `package.json`에 zustand·@tanstack/react-table·echarts·react 19·tailwind 4 존재, UI 컴포넌트가 shadcn/ui(`components/ui/`) 기반, backend `pyproject.toml`(또는 requirements)에 fastapi·sqlalchemy 2·alembic 존재 — 파일 육안 확인
- [ ] AC-12: 잘못된 입력(음수/0 금액, 없는 ID 참조)에 대해 API가 4xx와 명시적 오류 메시지를 반환한다 — curl로 대표 케이스 2~3건 확인

## Action Items

- [ ] `.gitignore` 확장: node_modules, dist, __pycache__, .venv, .env 등
- [ ] `backend/` 생성: FastAPI 앱 골격(설정·DB 세션·라우터 구조), SQLAlchemy 2.0 모델 5종(members/accounts/categories/transactions/budgets), Alembic 초기 마이그레이션 + 기본 기준정보 시드(멱등), CRUD·집계 라우터, pydantic 스키마
- [ ] `frontend/` 생성: Vite 8 + React 19 + TS 스캐폴드, Tailwind v4 + shadcn/ui init, React Router 7 라우트 5개, 사이드바 레이아웃, zustand 스토어 + API 클라이언트, 화면 5종 구현(ECharts 차트 2종, TanStack Table 그리드 1종 포함)
- [ ] Docker: backend/frontend Dockerfile, nginx 설정(`/api` 프록시), 루트 `docker-compose.yml`(db 볼륨·healthcheck·기동 순서)
- [ ] 전체 AC를 compose 기동 상태에서 수동 검증 (테스트 프레임워크 도입 여부는 구현 재량 — 최소한 AC-12는 curl 검증)
- [ ] 구현 완료 후 CLAUDE.md의 "빈 저장소" 문구가 무효화됨을 implementation.md에 기록 (CLAUDE.md 재생성은 별도 작업)

## 미해결 질문

- **계좌 간 이체 거래**: 1차 범위에서 제외했다. 이체가 없으면 카드대금 정산·저축 이동을 표현할 수 없으므로 다음 단계에서 transaction type 확장으로 다루는 것을 제안 (스키마는 type 컬럼 확장만으로 수용 가능하게 설계)
- **'목표 행성'(저축 목표) 게이미피케이션**: 사용자가 "우선 여기까지"라고 명시해 1차 제외. 후속 단계 후보
- **echarts-for-react vs 직접 래핑**: 직접 래핑을 권장하나 구현 재량으로 남김 (어느 쪽이든 AC-11의 echarts 의존성 충족)
- **TypeScript 6.0의 deprecation으로 Vite 8/shadcn 템플릿과 마찰 발생 시**: 5.9.x 폴백 허용 (구현 재량, implementation.md에 사유 기록)
- 시드 카테고리의 구체 목록(식비/교통/주거 등), 포트 번호, 다크 테마 색상 값: 구현 재량
