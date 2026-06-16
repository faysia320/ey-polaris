# Research: 대시보드 월간 AI 리포트 기능

- 날짜: 2026-06-16
- 요청 원문(1차): 대시보드 최상단에 "정상 궤도를 유지하고 있어요 🛰️" 같은 문구가 있는데 여기에 AI 리포트 기능을 추가하고 싶어. openai api key를 .env 로 넣어 둘테니 이를 활용해서 해당 월의 AI 리포트를 작성해줘. 리포트 작성에 필요한 데이터와 컨택스트는 네가 적절하게 작성하고 전달해줘. 모델은 sonnet4정도면 충분할거같아. 작성된 AI 리포트는 DB에 저장되어야 해. AI 리포트 생성 버튼이 필요할거같아
- 요청 원문(2차): 모델은 open ai의 가장 가성비 좋은 모델로 추천해줘. 저장 정책은 월당 제한은 없고, 이력을 누적시키면서 가장 마지막 건으로 보여지게 해줘. 마크다운 렌더링도 되면 좋겠어
- 요청 원문(3차): api key와 모델을 .env 환경변수로 다루지 않고, DB에 저장하고 불러오도록 하고 싶어. 이것까지 설계에 추가해줘

## 요약

대시보드(`DashboardPage.tsx`)의 안내 문구 카드(`DashboardPage.tsx:182-187`) 아래에 "AI 리포트" 기능을 추가한다: 해당 월의 가계부 집계 데이터를 컨텍스트로 OpenAI LLM에 전달해 마크다운 월간 리포트를 생성하고, DB에 **이력으로 누적 저장**한 뒤 대시보드에 **가장 마지막 건을 마크다운으로 렌더링**한다. "리포트 생성" 버튼으로 트리거한다.

**3차 요청 핵심 변경**: OpenAI API 키와 모델명을 `.env` 환경변수가 아니라 **DB에 저장하고 불러온다.** 따라서 (a) 키-값 설정을 담는 DB 모델(`AppSetting`)과 마이그레이션, (b) 설정 조회·저장 엔드포인트(신규 `settings` 라우터), (c) Settings 페이지(`SettingsPage.tsx`, Tabs 구조 `:630-645`)에 "AI 설정" 탭(API 키·모델 입력/저장 UI)을 추가한다. 리포트 생성 시 키/모델은 환경변수가 아니라 **DB에서 읽는다.** 이로써 1차 명세의 `.env`·`python-dotenv`·`docker-compose env_file` 항목은 **불필요**해진다(`config.py:1-6`은 `DATABASE_URL`만 유지).

확정된 결정: 모델 기본값 `gpt-4.1-mini`(가성비, DB 미설정 시 폴백 기본값) / 저장 정책은 이력 누적·최신 1건 표시 / 마크다운 렌더링 도입(`react-markdown`).

백엔드는 LLM 클라이언트(`openai`)가 **아직 없고**(`backend/requirements.txt`), 프론트도 마크다운 렌더러가 **없다**(`frontend/package.json:12-28`, `@tailwindcss/typography` 없음, Tailwind v4). 둘 다 의존성 추가가 필요하다.

## 관련 파일 및 근거

### 백엔드 — 리포트
- `backend/app/routers/analytics.py:32-90` — `/analytics/dashboard`. 집계 로직(`_month_range`, `_signed_amount`, `month_total`, `expense_rows`, `spent_by_major`, `budget_rows`)을 리포트 컨텍스트 빌더로 재사용. 리포트 생성/조회 엔드포인트를 이 라우터에 추가(prefix `/analytics` 공유).
- `backend/app/routers/analytics.py:13-17` — `_month_range(month)`. 전월 대비 비교 시 재사용.
- `backend/app/models.py:141-157` — `Budget` 모델의 `year_month(String[7], indexed)` 패턴. `AIReport`의 월 키도 이 패턴(String[7] + index)을 따르되 **non-unique(이력 누적)**. 기존 모델에 타임스탬프 컬럼이 없으므로 `AIReport`에 `created_at`(server_default) 신설 — "가장 마지막 건" 정렬 기준.
- `backend/app/models.py:7-8` — `class Base(DeclarativeBase)`. 신규 모델은 `Base` 상속.

### 백엔드 — 설정(DB 저장 키/모델, 3차 요청)
- `backend/app/models.py` — **신규 `AppSetting` 모델**(키-값 저장: `key` PK/String, `value` Text/nullable). 키 예: `openai_api_key`, `openai_model`. (전용 단일행 모델 대신 범용 KV가 단순·확장 용이 — 구현 재량.)
- `backend/app/routers/goals.py:1-39` — 단순 CRUD 라우터 표준 패턴(`APIRouter(prefix=...)`, `Depends(get_db)`, `commit_or_conflict`). **신규 `settings` 라우터**가 따를 모범.
- `backend/app/routers/utils.py:6-19` — `get_or_404`, `commit_or_conflict` 헬퍼. 설정 upsert에 활용.
- `backend/app/main.py:30-37` — `api.include_router(module.router)` 목록. **신규 `settings` 라우터는 여기에 등록 필요**(리포트 엔드포인트는 analytics에 추가하므로 추가 등록 불필요).
- `backend/app/config.py:1-6` — `os.getenv`로 `DATABASE_URL`만. **OpenAI 키/모델 env는 추가하지 않는다**(3차 요청). `python-dotenv`/`docker-compose env_file`도 불필요.
- `backend/app/database.py` — `get_db` 의존성. 신규 엔드포인트 동일 패턴.
- `backend/app/schemas.py:4-6,19-21` — `ConfigDict(from_attributes=True)`, `YEAR_MONTH_PATTERN`. 리포트/설정 스키마가 따를 패턴.
- `backend/requirements.txt` — `openai` 없음 → 추가 필요(`python-dotenv`는 3차 요청으로 **불필요**).
- `backend/Dockerfile:16` — `alembic upgrade head && uvicorn`. 신규 마이그레이션 자동 적용.
- `backend/alembic/versions/0008_easy_pay_linked_account.py` — 최신 리비전 **0008**. 신규 마이그레이션은 `revision="0009"`(필요 시 0009/0010 분리), `down_revision="0008"`. 패턴: `op.create_table` + `op.create_index`.
- `docker-compose.yml:17-25` — backend에 `env_file` **추가 불필요**(키/모델을 DB로 다루므로). 변경 없음.

### 프론트엔드
- `frontend/src/pages/DashboardPage.tsx:182-187` — 안내 카드. AI 리포트 카드(생성 버튼 + 마크다운 본문)를 그 아래 배치.
- `frontend/src/pages/DashboardPage.tsx:69-79` — `month` 상태 + `useEffect` fetch 패턴. 월 변경 시 최신 리포트 자동 조회를 동일 패턴으로.
- `frontend/src/pages/SettingsPage.tsx:630-645` — `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` 구조. **"AI 설정" 탭 추가**(`SettingsPage.tsx:30`에서 Tabs import 확인). 입력은 `Input`(`:13`)/`Label`(`:14`)/`Select`(`:15-21`) 컴포넌트 재사용.
- `frontend/src/pages/SettingsPage.tsx:615-621` — 페이지 진입 시 `fetchAll()` 패턴. AI 설정 탭도 진입 시 현재 설정 조회.
- `frontend/src/lib/api.ts` — `api.get<T>`, `api.post<T>`, `api.put<T>`. POST/PUT은 JSON 직렬화 + `Content-Type` 자동, 에러 시 `body.detail` throw.
- `frontend/src/stores/analytics.ts:13-22` — zustand 패턴. 리포트 스토어와 설정 스토어가 따를 모범.
- `frontend/src/types.ts:92-100` — 타입 정의 위치. `AIReport`, AI 설정 타입 추가.
- `frontend/package.json:12-28` — `react-markdown`/`remark-gfm` 없음, `@tailwindcss/typography` 없음, Tailwind v4(`:41`). 마크다운 렌더링 위해 `react-markdown`(+선택 `remark-gfm`) 추가.
- `frontend/src/components/ui/` — `Button`/`Card`/`Dialog`/`Input`/`Label`/`Select`/`Tabs` 존재. 토스트 없음 → 에러는 로컬 `useState`.

## 영향도

- `backend/app/models.py` — `AIReport`, `AppSetting` 모델 추가(기존 모델 변경 없음).
- `backend/app/schemas.py` — 리포트 응답 스키마 + AI 설정 조회/저장 스키마 추가.
- `backend/app/routers/analytics.py` — 리포트 생성/조회 엔드포인트 추가. 생성 시 키/모델을 DB(`AppSetting`)에서 읽음.
- `backend/app/routers/settings.py` (신규) + `backend/app/main.py` — 설정 라우터 추가·등록. **main.py 변경 발생**.
- `backend/requirements.txt` — `openai` 추가 → Docker 재빌드 필요.
- `backend/alembic/versions/0009_*.py`(+필요 시 0010) — `ai_reports`, `app_settings` 테이블 생성. 기동 시 자동 적용.
- `backend/app/config.py`, `docker-compose.yml`, `.gitignore` — **변경 없음**(키/모델을 DB로 다루므로 env/`.env` 도입 안 함).
- `frontend/package.json` — `react-markdown`(+`remark-gfm`) 추가 → `npm install` 필요. 보안상 raw HTML 비허용(`rehype-raw` 미사용).
- `frontend/src/types.ts`, `frontend/src/stores/*`, `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/SettingsPage.tsx` — 타입/스토어/UI 추가.
- **보안 주의**: API 키를 DB에 평문 저장한다(자가 호스팅 개인 앱 전제). 조회 엔드포인트는 **원문 키를 프론트로 반환하지 않는다**(설정 여부 boolean 또는 마스킹). 외부 의존(OpenAI 호출: 비용/지연/실패) graceful 처리.

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: `POST /api/v1/analytics/ai-report`(월 파라미터)를 호출하면, 해당 월 집계를 컨텍스트로 OpenAI 모델이 생성한 한국어 마크다운 리포트가 응답에 포함된다 — 데이터가 있는 월에 `/docs`/`curl`로 호출해 비어 있지 않은 리포트를 받는 것으로 확인(사전에 AC-7로 키 등록 필요).
- [ ] AC-2: 생성 호출은 매번 새 행으로 `ai_reports`에 **누적 저장**되고(월당 제한 없음), `GET /api/v1/analytics/ai-report?month=YYYY-MM`는 해당 월 **최신(created_at) 1건**을 반환한다 — 같은 월 2회 생성 후 GET이 두 번째 내용을 반환하고 DB에 2행 잔존함을 확인.
- [ ] AC-3: 대시보드에 "AI 리포트 생성" 버튼이 있고, 클릭 시 로딩 상태를 거쳐 리포트가 **마크다운으로 렌더링**된다(제목/목록/굵게가 서식으로 보이고 raw `#`·`**`가 노출되지 않음) — 브라우저에서 클릭→서식 렌더 확인(/qa 단계에서 브라우저 도구로).
- [ ] AC-4: 월 전환 시 그 월의 최신 리포트가 자동 표시되고, 없으면 "아직 생성된 리포트가 없습니다" 류 빈 상태 + 생성 버튼이 보인다 — 리포트 있는/없는 월을 오가며 확인(/qa 단계에서 브라우저 도구로).
- [ ] AC-5: API 키 미등록 또는 LLM 호출 실패 시, 서버는 부분 저장 없이 명확한 에러(4xx/5xx + `detail`)를 반환하고 프론트는 에러 메시지를 표시한다(크래시 없음). 데이터가 전혀 없는 월도 500으로 깨지지 않고 정상 응답/"활동 없음" 리포트를 낸다 — 키 미등록 상태 생성 호출 시 에러 응답·프론트 에러 표시 확인.
- [ ] AC-6 (모바일): 375px 뷰포트에서 (a) 대시보드 AI 리포트 카드(버튼 + 마크다운 본문)와 (b) Settings "AI 설정" 탭(입력/저장 UI)이 가로 스크롤·요소 겹침·텍스트 잘림 없이 표시되고, 긴 본문·목록·코드블록이 카드 폭 안에서 줄바꿈/오버플로 처리된다 — /qa 단계에서 브라우저 도구(375px)로 확인.
- [ ] AC-7 (DB 설정): Settings "AI 설정" 탭에서 OpenAI API 키와 모델을 입력·저장하면 `app_settings`(DB)에 저장되고, 리포트 생성은 **이 DB 값**을 사용한다(환경변수 미사용). 저장 후 페이지를 새로고침해도 모델 값과 "키 등록됨" 상태가 유지된다 — 탭에서 키/모델 저장 → 새로고침 후 상태 유지 → 리포트 생성 성공으로 확인. **조회 시 원문 API 키 전체가 프론트로 반환되지 않음**(마스킹 또는 boolean)을 네트워크 응답으로 확인.
- [ ] AC-8 (모델): 모델이 DB에 설정돼 있으면 그 값으로, 미설정이면 기본값 `gpt-4.1-mini`로 호출된다 — 저장된 리포트의 `model` 필드 또는 호출 결과로 사용 모델 확인.

## Action Items

- [ ] 백엔드 의존성: `backend/requirements.txt`에 `openai` 추가(`python-dotenv`는 불필요).
- [ ] `backend/app/models.py`에 `AppSetting`(key PK/String, value Text/nullable) 모델 추가.
- [ ] `backend/app/models.py`에 `AIReport` 모델 추가: `year_month`(String[7], indexed, non-unique), `content`(Text), `model`(String), `created_at`(DateTime, server_default). 조회 정렬 기준 created_at(보조 id).
- [ ] `backend/alembic/versions/0009_*.py`(+필요 시 0010): `op.create_table("ai_reports", ...)` + year_month 인덱스(unique 없음), `op.create_table("app_settings", ...)`. `revision`/`down_revision="0008"` 체인. downgrade `drop_table`.
- [ ] `backend/app/schemas.py`: `AIReportOut`(id, month/year_month, content, model, created_at, `from_attributes=True`), AI 설정 조회 스키마(model + 키 설정여부/마스킹), 저장 요청 스키마(api_key optional, model optional).
- [ ] `backend/app/routers/settings.py`(신규): `GET /settings/ai`(model + 키 등록여부, **원문 키 미반환**), `PUT /settings/ai`(api_key/model upsert — api_key 빈값/미포함 시 기존 키 유지). `commit_or_conflict` 활용.
- [ ] `backend/app/main.py`: settings 라우터 `include_router` 등록.
- [ ] DB 설정 조회 헬퍼: `app_settings`에서 `openai_api_key`/`openai_model`을 읽어 키 없으면 명확한 에러, 모델 없으면 기본값 `gpt-4.1-mini` 폴백.
- [ ] `backend/app/routers/analytics.py`: 컨텍스트 빌더(dashboard 집계 + 전월 대비) → DB에서 키/모델 로드 → OpenAI 호출(한국어 시스템 프롬프트, 앱의 "북극성/궤도" 톤 가계부 코치, **마크다운 출력** 지시) → 새 행 저장. 생성/조회 엔드포인트 추가. 키 미등록·API 실패·빈 데이터 엣지 처리(부분 저장 금지).
- [ ] 프론트 의존성: `react-markdown`(+필요 시 `remark-gfm`) 추가. raw HTML 비허용.
- [ ] `frontend/src/types.ts`: `AIReport` 타입 + AI 설정 타입 추가.
- [ ] 프론트 스토어: 리포트 조회·생성 스토어, AI 설정 조회·저장 스토어(신규 `aiReport.ts`/`settings.ts` 또는 기존 확장) + 로딩/에러 상태.
- [ ] `DashboardPage.tsx`: AI 리포트 카드(생성 버튼 로딩 중 비활성, `react-markdown` 본문 렌더(모바일 폭 내 처리·요소 스타일링), 빈 상태, 에러, 월 전환 시 최신 조회).
- [ ] `SettingsPage.tsx`: "AI 설정" 탭 추가(API 키 입력 — password 형태, 모델 입력/선택 기본값 `gpt-4.1-mini`, 저장 버튼, 현재 설정/등록 상태 표시, 에러 표시). 진입 시 현재 설정 조회.
- [ ] 빌드 검증: `npm run build`(tsc+vite), 백엔드 import 무결성/`alembic upgrade head`.

## 미해결 질문

- **API 키 평문 저장(권장 확인)**: 자가 호스팅 개인 앱 전제로 `app_settings`에 평문 저장하고, 조회 시 원문 키는 프론트로 반환하지 않도록(마스킹/boolean) 한다. 암호화 저장은 범위 밖으로 가정(필요 시 별도 요청). 
- **모델 기본값**: 가성비 기본값 `gpt-4.1-mini`(DB 미설정 폴백). 대안 `gpt-4.1-nano`/`gpt-4o-mini`(더 저렴), `gpt-5-mini`(더 똑똑). 사용 계정 접근 권한 없으면 호출 실패 가능 → 설정 탭에서 교체.
- **설정 모델 형태(구현 재량)**: 범용 KV(`AppSetting`) vs 전용 단일행 모델. KV 권장.
- **마크다운 스타일링(구현 재량)**: `@tailwindcss/typography`(`prose`) vs react-markdown 컴포넌트 수동 매핑. 모바일 무결성(AC-6)만 계약.
- **리포트 범위(구성원 필터)**: 대시보드는 `member_id` 필터 지원(`analytics.py:35`). 리포트는 기본 **전체(월 단위)** 로 가정.
- **OpenAI 호출 방식(구현 재량)**: Chat Completions vs Responses API 등 SDK 표준 호출.

---

작업 폴더: `docs/tasks/2026-06-16-ai-monthly-report/`
