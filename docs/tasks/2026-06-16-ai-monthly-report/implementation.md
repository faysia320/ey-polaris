# Implementation: 대시보드 월간 AI 리포트 기능

- 날짜: 2026-06-16
- 기반 명세: `docs/tasks/2026-06-16-ai-monthly-report/research.md`

## 변경 파일

### 백엔드
- `backend/requirements.txt` — `openai>=1.60` 추가 (python-dotenv는 DB 설정 방식으로 불필요)
- `backend/app/models.py` — `AppSetting`(key-value), `AIReport`(year_month non-unique + content/model/created_at) 모델 추가, 관련 import(DateTime/Text/func/datetime) 추가
- `backend/alembic/versions/0009_ai_reports_and_app_settings.py` (신규) — `app_settings`, `ai_reports` 테이블 생성 (0008→0009 체인, year_month 인덱스, downgrade drop)
- `backend/app/schemas.py` — `AIReportOut`, `AISettingsOut`(키 마스킹/힌트), `AISettingsUpdate`, `DEFAULT_OPENAI_MODEL="gpt-4.1-mini"` 추가
- `backend/app/settings_store.py` (신규) — app_settings 읽기/쓰기 헬퍼 + `get_openai_config`(모델 기본값 폴백)
- `backend/app/routers/settings.py` (신규) — `GET /settings/ai`(원문 키 미반환), `PUT /settings/ai`(upsert, 빈 키는 기존 유지)
- `backend/app/main.py` — settings 라우터 등록
- `backend/app/routers/analytics.py` — `POST /analytics/ai-report`(생성·누적 저장), `GET /analytics/ai-report`(최신 1건/없으면 null), 월 집계 컨텍스트 빌더(`_month_stats`/전월 비교) + OpenAI 호출(`_generate_report_content`, 실패 시 502, 키 미설정 시 400)

### 프론트엔드
- `frontend/package.json` — `react-markdown`, `remark-gfm` 추가 (npm install 완료)
- `frontend/src/types.ts` — `AIReport`, `AISettings`, `AISettingsUpdate` 타입 추가
- `frontend/src/stores/aiReport.ts` (신규) — 월별 리포트 조회/생성 zustand 스토어
- `frontend/src/stores/aiSettings.ts` (신규) — AI 설정 조회/저장 zustand 스토어
- `frontend/src/components/MarkdownView.tsx` (신규) — react-markdown + remark-gfm, raw HTML 비허용, 모바일 대응 요소 스타일링
- `frontend/src/pages/DashboardPage.tsx` — 안내 카드 아래 "AI 리포트" 카드(생성 버튼/로딩/마크다운 렌더/빈 상태/에러), 월 전환 시 최신 리포트 자동 조회
- `frontend/src/pages/SettingsPage.tsx` — "AI 설정" 탭 추가(API 키 password 입력, 모델 입력 기본 gpt-4.1-mini, 저장, 등록 상태/힌트 표시)

## 주요 결정
- **키/모델 DB 저장(3차 요청)**: `.env`·`python-dotenv`·`docker-compose env_file`를 도입하지 않고 `app_settings` KV 테이블로 관리. `config.py`/`docker-compose.yml`/`.gitignore`는 변경하지 않음.
- **보안**: API 키는 평문 저장하되 조회 응답에는 원문을 절대 포함하지 않음 — `api_key_set`(bool)과 끝 4자리 `api_key_hint`만 노출. (암호화 저장은 명세상 범위 밖.)
- **저장 정책**: `ai_reports`에 year_month 유니크 제약 없이 매 생성마다 새 행 누적, 조회는 `created_at DESC, id DESC` 최신 1건.
- **리포트 범위**: 명세 기본값대로 구성원 필터 미반영(가구 전체 월 단위). `_month_stats`는 member_id를 받지 않음.
- **모델 기본값**: `DEFAULT_OPENAI_MODEL="gpt-4.1-mini"`, DB 미설정 시 폴백. 설정 탭에서 교체 가능.
- **마크다운 렌더링**: `@tailwindcss/typography` 대신 react-markdown 컴포넌트 매핑으로 수동 스타일링(플러그인 추가 없이 모바일 대응). 표/체크리스트 위해 remark-gfm 포함.
- **OpenAI 호출**: Chat Completions API(`client.chat.completions.create`) 사용, openai SDK는 함수 내 지연 import.
- **lint 대응**: React Compiler 규칙(`set-state-in-effect`)에 맞춰 effect 내 동기 setState 제거 — 대시보드는 `.then()`에서 에러 클리어, 설정 탭은 모델 값을 effect 미러링 대신 `modelEdit ?? settings.model` 파생으로 처리.

## 자체 검증 결과
- `cd frontend && npm run build` (tsc -b && vite build) → **통과** (BUILD_OK, 기존 청크 크기 경고만)
- `cd frontend && npm run lint` → **통과** (0 errors; 잔여 2 warnings는 기존 `TransactionsPage.tsx`, 본 변경과 무관)
- `python -m py_compile` (변경 백엔드 파일 7종) → **통과** (PY_COMPILE_OK)
- `docker compose build backend` → **통과** (openai 의존성 해석·이미지 빌드 성공)
- `docker run ... python -c "import app.main; from app import settings_store; from app.routers import settings, analytics"` → **통과** (IMPORT_OK)
- `docker run ... alembic history` → **통과** (`0008 -> 0009 (head)` 체인 확인)
- 로컬 Python에 백엔드 deps가 없어(컨테이너 실행 전제) 런타임 검증은 Docker 이미지로 수행. **실제 OpenAI 호출·DB 마이그레이션 적용·브라우저 E2E는 /qa에 위임.**

## 성공 기준 자가 체크
- [x] AC-1: `POST /analytics/ai-report`가 월 집계 컨텍스트를 OpenAI에 보내 마크다운 리포트를 응답·저장 (`analytics.py` create_ai_report). 실제 LLM 응답 확인은 키 등록 후 /qa.
- [x] AC-2: 생성마다 새 행 저장(유니크 없음), GET은 `created_at DESC, id DESC` 최신 1건 반환. 2회 생성→최신 반환·2행 잔존은 /qa에서 DB로 확인.
- [x] AC-3: 대시보드 "AI 리포트" 카드 + 생성 버튼(로딩 중 비활성), `MarkdownView`로 서식 렌더(raw HTML 비허용). 브라우저 확인은 /qa 위임.
- [x] AC-4: 월 전환 시 `fetchReport(month)`로 최신 리포트 자동 조회, 없으면 빈 상태 + 생성 버튼 안내. 브라우저 확인은 /qa 위임.
- [x] AC-5: 키 미등록 시 400(`detail`), OpenAI 실패 시 502(부분 저장 없음 — 저장은 호출 성공 후), 데이터 없는 월도 _month_stats가 0으로 정상 처리. 프론트는 `reportError` 표시. 키 미등록 실제 에러 표시는 /qa.
- [x] AC-6 (모바일): MarkdownView가 `break-words`·코드/표 `overflow-x-auto`, 설정 탭 `max-w-md` 스택 레이아웃. 375px 실제 확인은 /qa 위임.
- [x] AC-7 (DB 설정): 설정 탭에서 키/모델 저장→`app_settings` 저장, 리포트 생성은 `settings_store.get_openai_config`로 DB 값 사용(env 미사용). GET 응답에 원문 키 미포함(마스킹). 새로고침 유지·네트워크 응답 확인은 /qa.
- [x] AC-8 (모델): DB 모델값 우선, 미설정 시 `gpt-4.1-mini` 폴백, 저장 리포트에 `model` 기록. /qa에서 model 필드로 확인.

## 보류/미완 항목
- 실제 OpenAI API 호출 결과(리포트 품질·마크다운 형식), 브라우저 E2E(버튼/렌더/모바일 375px), DB 마이그레이션 적용 후 누적·최신 조회 동작 — /qa 단계에서 검증 예정. (유효한 OpenAI API 키를 설정 탭에 등록해야 AC-1~2 확인 가능)

## QA 피드백 보완 (2차, 2026-06-16)
1차 QA(CONDITIONAL PASS, Medium 1 + Low 6) 반영:
- **[Medium 연관] Settings TabsList 모바일 오버플로**: `SettingsPage.tsx` TabsList에 `max-w-full justify-start overflow-x-auto` 적용 — 375px에서 4탭이 페이지 가로 스크롤 대신 탭 목록 내부에서만 스크롤되도록.
- **[Low] MarkdownView 블록 코드 이중 배경**: `pre`에 `[&>code]:bg-transparent [&>code]:p-0` 추가 — 인라인 코드만 배경 유지, 블록 코드 단일 배경.
- **[Low] 외부 링크 안전 속성**: `a`에 `target="_blank" rel="noopener noreferrer"` 부여.
- **[Low] 모델 입력 422 노출**: 모델 `Input`에 `maxLength={50}` 적용(백엔드 `max_length=50`과 일치, 51자+ 입력 사전 차단).
- **미반영(사유)**: OpenAI 오류 원문 노출 — 자가 호스팅 개인 앱에서 잘못된 키/모델명 등 디버깅에 유용해 의도적 유지(QA도 "허용 가능" 평가). aiReport `loading` 공용 불리언 — 콘텐츠는 `byMonth` 키잉으로 격리되어 표시 정합성 유지, 변경 시 회귀 위험 대비 효익 낮아 보류.
- 재검증: `npm run lint`(0 errors, 잔여 2 warning은 기존 TransactionsPage), `npm run build`(통과), `docker compose up -d --build frontend`(최신 번들 재배포 — QA가 지적한 구버전 번들 서빙 해소).

## QA 피드백 보완 (3차, 2026-06-16)
2차 QA가 발견한 신규 회귀 수정:
- **[Low 회귀] TabsList 세로 스크롤바 아티팩트**: `overflow-x-auto`가 CSS 규칙상 `overflow-y`를 auto로 승격시켜 데스크톱 포함 전 뷰포트에서 세로 스크롤바(▲▼)가 생겼다. `overflow-y-hidden`을 함께 지정해 가로 스크롤만 남기고 세로 승격을 차단. `npm run build` 통과 후 frontend 재배포.
