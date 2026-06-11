# Research: 주식·부동산 자산 관리 + 목표금액 달성 현황 + 거래 캘린더 뷰

- 날짜: 2026-06-11
- 요청 원문:
  1. 주식과 부동산을 자산으로 관리하고 싶어.
  2. 목표금액을 설정하고 달성상황을 볼수 있으면 좋겠어
  3. 지출/수입 내역에서 캘린더뷰도 있으면 좋겠어

## 요약

현재 자산은 `Account`(bank/cash/card/investment/other) 단위로 관리되며, 잔액은 항상 "개설 잔액 + 거래 합산"으로 계산된다(`backend/app/models.py:21-32`, `backend/app/routers/analytics.py:99-118`). 주식·부동산은 거래 입력이 아니라 **시세(평가액) 변동**으로 가치가 바뀌므로 이 모델에 맞지 않는다. 해결 방향은 (1) 계정 유형에 `stock`(주식)·`real_estate`(부동산)를 추가하고, 날짜별 **평가액 스냅샷** 테이블을 신설하여 평가액이 있는 계정은 최신 평가액을 잔액으로 사용, (2) 목표금액은 신규 `Goal` 테이블 + CRUD API를 만들고 총자산(`AssetsOut.total`) 대비 진행률을 자산 페이지에 표시, (3) 캘린더 뷰는 이미 월 단위 거래 조회 API가 있으므로(`backend/app/routers/transactions.py:40-73`) 백엔드 변경 없이 `TransactionsPage`에 테이블/캘린더 토글을 추가하는 프론트엔드 작업으로 해결한다. DB는 PostgreSQL(`to_char` 사용, `backend/app/routers/analytics.py:121`)이고 마이그레이션은 Alembic 리비전 체인(0001→0002)을 따른다.

## 관련 파일 및 근거

### 요청 1 — 주식·부동산 자산
- `backend/app/models.py:21-32` — `Account` 모델. `type`은 String(20) 자유 문자열이라 DB 스키마 변경 없이 새 유형 수용 가능. 잔액은 컬럼이 아니라 계산값.
- `backend/app/schemas.py:25` — `AccountType = Literal["bank", "cash", "card", "investment", "other"]`. 여기에 `stock`, `real_estate` 추가 필요.
- `backend/app/routers/analytics.py:99-149` — `/analytics/assets`. 계정별 잔액(`opening_balance + 거래 순증감`)과 12개월 자산 추이를 계산. 평가액 기반 계정 반영 로직이 들어갈 핵심 지점.
- `backend/app/routers/accounts.py:12-38` — 계정 CRUD. 평가액 기록 API의 참조 패턴.
- `frontend/src/types.ts:1` — `AccountType` 프론트 타입. 동일하게 확장 필요.
- `frontend/src/pages/SettingsPage.tsx:35-41` — `ACCOUNT_TYPES` 라벨 매핑(계정 추가/수정 셀렉트에 사용). 새 유형 라벨 추가 필요.
- `frontend/src/pages/AssetsPage.tsx:11-17` — `ACCOUNT_TYPE_LABEL` 매핑. 새 유형 라벨 추가 및 평가액 입력 UI가 들어갈 페이지.
- `backend/alembic/versions/0001_initial_schema.py`, `0002_seed_master_data.py` — 마이그레이션 작성 패턴(리비전 체인, 시드 방식).

### 요청 2 — 목표금액
- `backend/app/models.py:70-83` — `Budget` 모델. 신규 `Goal` 모델·라우터의 구조 참조 패턴(단순 테이블 + CRUD).
- `backend/app/routers/budgets.py` — CRUD 라우터 패턴(`_to_out`, `get_or_404`, `commit_or_conflict`).
- `backend/app/main.py:20-26` — 라우터 등록 지점. 신규 `goals` 라우터 등록 필요.
- `frontend/src/stores/budgets.ts` — zustand 스토어 패턴. 목표 스토어의 참조.
- `frontend/src/pages/DashboardPage.tsx:102-120` — 예산 소진율 진행바 UI. 목표 달성률 표시에 재사용할 수 있는 패턴.
- `frontend/src/stores/analytics.ts:22-25` — `fetchAssets()`로 총자산을 이미 받아옴. 달성률 계산의 분자(현재 총자산) 소스.

### 요청 3 — 캘린더 뷰
- `backend/app/routers/transactions.py:40-73` — 월 필터 거래 조회 API. 캘린더 한 달 치 데이터는 이미 제공됨 → 백엔드 변경 불필요.
- `frontend/src/pages/TransactionsPage.tsx:225-355` — 거래 목록 화면(필터 + 테이블 + 페이지네이션). 캘린더/테이블 전환 토글이 들어갈 위치. 조회 월 필터(`filters.month`)는 비울 수 있음(238-250행) — 캘린더 뷰는 월 필수라는 엣지 케이스 발생.
- `frontend/src/stores/transactions.ts:7-11` — `TransactionFilters.month: string | null`. 캘린더 뷰의 데이터 소스.
- `frontend/src/lib/format.ts:17-24` — `addMonths` 등 월 연산 유틸 기존재. 캘린더 월 이동에 재사용.
- `frontend/package.json:12-27` — 날짜/캘린더 라이브러리 없음(date-fns, react-day-picker 부재). 신규 의존성 없이 네이티브 Date로 월 그리드 계산 가능(기존 코드도 네이티브 Date만 사용).

## 영향도

- `backend/app/schemas.py` — `AccountType` Literal 확장은 기존 계정 데이터에 영향 없음(기존 값은 모두 유지). 신규 스키마(Goal, 평가액) 추가.
- `backend/app/routers/analytics.py` — `/analytics/assets` 응답의 `balance`·`total`·`trend` 계산 로직 변경. 이 응답을 소비하는 곳은 `frontend/src/pages/AssetsPage.tsx`뿐(`frontend/src/stores/analytics.ts:22-25` 경유)이므로 응답 스키마(`AssetsOut`)의 기존 필드를 유지하면 파급 없음.
- `backend/app/models.py` + Alembic — 신규 테이블 2개(목표, 자산 평가액) 추가. 기존 테이블 변경 없음 → 기존 마이그레이션·데이터에 비파괴적.
- `frontend/src/types.ts`의 `AccountType` 확장 — 이 타입을 분기하는 곳은 `SettingsPage.tsx:35-41`과 `AssetsPage.tsx:11-17`의 라벨 매핑 2곳. `Record<AccountType, string>`(AssetsPage)은 키 누락 시 **타입 에러로 빌드가 깨지므로** 두 매핑 모두 갱신 필수.
- `frontend/src/pages/TransactionsPage.tsx` — 캘린더 뷰 추가는 기존 테이블 뷰 동작(필터·정렬·페이지네이션·CRUD 다이얼로그)을 보존해야 함.
- 계정 삭제 시 평가액 처리 — 평가액 테이블이 계정을 FK로 참조하므로 삭제 정책(CASCADE 권장: 평가액은 계정의 종속 데이터) 결정 필요. 기존 거래 FK는 RESTRICT(`backend/app/models.py:59`)와 구분됨.

## 성공 기준 (Acceptance Criteria)

### A. 주식·부동산 자산
- [ ] AC-1: 기준정보 관리 > 자산 계정에서 유형 "주식", "부동산"을 선택해 계정을 생성할 수 있다 — UI에서 생성 후 `GET /api/v1/accounts` 응답에 해당 type이 포함됨을 확인.
- [ ] AC-2: 주식/부동산 계정에 날짜별 평가액을 기록·수정·삭제할 수 있는 API와 UI가 있다 — UI에서 평가액 기록 후 조회 API 응답에 반영됨을 확인.
- [ ] AC-3: 평가액이 1건 이상 있는 계정의 잔액은 `/api/v1/analytics/assets`에서 **최신 평가액**으로 표시되고 총자산(`total`)에 합산된다 — 평가액 기록 전후의 응답 비교로 확인.
- [ ] AC-4: 평가액이 없는 계정(기존 bank/cash 등 포함)의 잔액 계산은 기존과 동일하다(개설 잔액 + 거래 합산) — 기존 계정의 `balance`가 변경 전후 동일함을 확인.
- [ ] AC-5: 월별 자산 추이(`trend`)에 평가액 기반 계정의 가치가 반영된다(각 월은 해당 월 말 이전의 최신 평가액 기준) — 과거 월에 평가액을 넣고 trend 응답이 달라짐을 확인.
- [ ] AC-6: 동일 계정·동일 날짜에 평가액을 중복 기록하면 409 또는 갱신(upsert) 중 하나로 일관되게 처리된다 — 같은 날짜로 2회 기록 시 응답 확인.

### B. 목표금액
- [ ] AC-7: 목표(이름, 목표금액[양수], 선택적 목표일)를 생성·수정·삭제할 수 있는 CRUD API가 있다 — `POST/PUT/DELETE /api/v1/goals` 호출로 확인. 목표금액 0 이하 입력 시 422 응답 확인.
- [ ] AC-8: 자산 상태 페이지에서 각 목표의 달성률(현재 총자산 ÷ 목표금액)이 진행바와 함께 표시된다 — 총자산과 목표금액을 알고 있는 상태에서 표시된 % 값이 일치함을 확인.
- [ ] AC-9: 달성률이 100%를 넘어도 UI가 깨지지 않는다(진행바는 100%에서 캡, 수치는 실제 % 표시) — 목표금액을 총자산보다 작게 설정해 확인.
- [ ] AC-10: 목표가 없을 때 자산 페이지는 기존처럼 정상 렌더링되고, 목표 추가를 유도하는 빈 상태 문구가 보인다 — 목표 0건 상태에서 화면 확인.

### C. 캘린더 뷰
- [ ] AC-11: 지출/수입 내역 페이지에 테이블 뷰 ↔ 캘린더 뷰 전환 수단이 있고, 캘린더 뷰는 선택한 월의 일자별 그리드에 그날의 수입·지출 합계를 표시한다 — 거래가 있는 월에서 캘린더로 전환해 일자별 합계가 거래 데이터와 일치함을 확인.
- [ ] AC-12: 캘린더의 날짜를 선택하면 그날의 거래 목록을 볼 수 있다 — 날짜 클릭 후 해당 일자의 거래만 표시됨을 확인.
- [ ] AC-13: 캘린더 뷰에서 월 이동이 가능하고, 12월→1월/1월→12월 연도 경계가 올바르다 — 월 이동 버튼으로 경계 월 이동 확인 (`addMonths` 재사용, `frontend/src/lib/format.ts:17-24`).
- [ ] AC-14: 조회 월 필터가 비어 있는 상태("전체 기간")에서 캘린더 뷰로 전환하면 오류 없이 동작한다(현재 월로 자동 설정 등) — 월 필터를 비운 뒤 전환해 확인.
- [ ] AC-15: 테이블 뷰의 기존 기능(필터, 정렬, 페이지네이션, 거래 추가/수정/삭제)이 변경 후에도 동일하게 동작한다 — 회귀 확인.

### 공통
- [ ] AC-16: `frontend`에서 `npm run build`(tsc 포함)와 `npm run lint`가 통과한다.
- [ ] AC-17: 신규 Alembic 리비전이 0002 이후 체인으로 추가되고 `upgrade`/`downgrade`가 모두 정의된다 — 기존 데이터가 있는 DB에서 upgrade가 비파괴적으로 적용됨을 확인.

## Action Items

### 백엔드
- [ ] `models.py`에 평가액 스냅샷 모델 추가: 계정 FK(ondelete=CASCADE 권장), 날짜, 평가액(BigInteger), (계정, 날짜) 유니크.
- [ ] `models.py`에 목표 모델 추가: 이름, 목표금액(BigInteger, 양수), 목표일(nullable Date).
- [ ] Alembic 리비전 0003 작성(두 테이블 생성, downgrade 포함).
- [ ] `schemas.py`: `AccountType`에 `stock`, `real_estate` 추가. 평가액·목표의 Create/Update/Out 스키마 추가(`Budget` 스키마 패턴 참조). 필요 시 `AccountBalance`에 평가액 기반 여부 등 보조 필드 추가는 구현 재량.
- [ ] 평가액 CRUD 라우터 추가(경로 설계는 구현 재량: `/accounts/{id}/valuations` 또는 `/valuations`). `commit_or_conflict`/`get_or_404` 패턴 준수.
- [ ] 목표 CRUD 라우터 `/goals` 추가, `main.py`에 두 라우터 등록.
- [ ] `analytics.py`의 `assets()` 수정: 평가액이 있는 계정은 최신 평가액을 잔액으로, `trend`는 월별로 "해당 월 말 기준 최신 평가액 + 비평가 계정의 기존 누적 계산"을 합산하는 논리로 변경.

### 프론트엔드
- [ ] `types.ts`: `AccountType` 확장, 평가액·목표 타입 추가.
- [ ] `SettingsPage.tsx` `ACCOUNT_TYPES`·`AssetsPage.tsx` `ACCOUNT_TYPE_LABEL`에 주식/부동산 라벨 추가.
- [ ] 평가액 기록 UI: 자산 상태 페이지에서 주식/부동산(또는 평가액 관리 대상) 계정 카드에 "평가액 갱신" 진입점 + 다이얼로그(기존 Dialog 패턴 재사용). 평가 이력 표시 범위는 구현 재량.
- [ ] 목표 스토어(zustand, `budgets.ts` 패턴) + 자산 상태 페이지에 목표 진행 카드(진행바는 `DashboardPage.tsx:110-115` 패턴 재사용)와 목표 추가/수정/삭제 UI.
- [ ] `TransactionsPage.tsx`에 뷰 전환 토글 + 월 캘린더 컴포넌트 신규 작성(신규 라이브러리 없이 네이티브 Date 계산 권장). 일자별 수입/지출 합계 표시, 날짜 선택 시 해당 일 거래 목록 표시, 거래 추가 다이얼로그 재사용 가능하면 날짜 프리필.

## 미해결 질문

- **평가액 계정의 거래 혼용**: 주식/부동산 계정에도 기존 거래(입출금) 기록은 막지 않는다. 다만 평가액이 존재하는 계정의 잔액은 평가액이 우선하며, 최신 평가일 이후의 거래를 잔액에 가산할지는 v1에서 "가산하지 않음(평가액 단독)"으로 단순화할 것을 권고 — 구현 재량이되 동작을 코드 주석/문서에 명시할 것.
- **목표의 기준**: v1은 "총자산 대비 목표금액"으로 설계했다(요청 문구 "목표금액 달성상황"에 부합하는 최소 형태). 특정 계정 묶음(예: 주택자금용 통장만) 기준 목표가 필요하면 후속 작업으로 분리.
- **평가액 중복 기록 처리**: AC-6에서 409와 upsert 중 택일을 허용했다. UX상 upsert(같은 날짜 재기록 시 갱신)가 자연스러우나 구현 재량.
- **음수 평가액**: 부동산 담보대출 등 부채 표현은 v1 범위 밖으로 두고 평가액은 0 이상으로 제한할 것을 권고.

---
다음 단계: `/implement docs/tasks/2026-06-11-assets-goals-calendar`
