# Research: 자산 상태 카드 유형별 그룹핑 + 대시보드/자산/거래내역 구성원 필터

- 날짜: 2026-06-11
- 요청 원문 (1차): 자산 상태를 카드를 카테고리별로 묶어서 정렬해줘. 카테고리별 카드 안에 카드 구조로 말이야. 그리고 대시보드, 자산상태, 지출/수입 내역은 구성원별로 볼수있게 최 상단 우측에 select를 넣어줘. 전체/으니/영이 이런식으로
- 요청 원문 (2차 — 정책 확정): 모든 계정 데이터는 소유자가 필수야. 없으면 안돼. 목표 달성 현황은 부부의 공동 목표야. 구성원 필터와 무관하게 항상 보여주면 돼

## 확정된 정책 (2차 요청 반영)

1. **계정 소유자 필수**: `Account.member_id`는 NOT NULL. "공동/미지정 계정" 개념 없음. 계정 생성·수정 시 소유자 선택이 필수이며, 엑셀 가져오기로 자동 생성되는 계정에도 반드시 소유자가 지정되어야 한다.
2. **목표 달성 현황은 부부 공동 목표**: 구성원 필터와 무관하게 항상 표시하고, 달성률은 항상 **가구 전체 총자산** 기준으로 계산한다. (1차 명세의 "구성원 선택 시 목표 카드 숨김" 권고는 폐기)

## 요약

자산 상태 페이지는 현재 계정 카드를 단일 평면 그리드로 나열한다(`frontend/src/pages/AssetsPage.tsx:267-301`). 계정에는 유형(`type`: bank/cash/card/investment/stock/real_estate/other)이 있고 한글 라벨 매핑도 이미 존재하므로(`AssetsPage.tsx:25-33`), 유형을 "카테고리"로 삼아 **유형별 바깥 카드 안에 계정 카드를 중첩**하는 구조로 바꾸는 것은 프론트 전용 변경이다.

구성원 필터는 페이지마다 사정이 다르다. (1) **지출/수입 내역**: 백엔드 목록 API가 이미 `member_id` 쿼리 파라미터를 지원하므로(`backend/app/routers/transactions.py:56,80-81`) 프론트 필터 상태에 `member_id`만 추가하면 된다. (2) **대시보드**: `/analytics/dashboard`에 member 파라미터가 없어(`backend/app/routers/analytics.py:29-33`) 백엔드 집계 쿼리에 필터 조건을 추가해야 한다. (3) **자산 상태**: 계정(`Account`)에 구성원 연결이 전혀 없어(`backend/app/models.py:21-32`) **`Account.member_id`(NOT NULL FK) 컬럼 신설 + Alembic 마이그레이션(기존 계정 백필 포함) + 기준정보 관리 화면에 소유자 필수 지정 UI**가 필요하다.

소유자 필수 정책으로 인해 두 가지 데이터 경로가 추가로 영향받는다. 첫째, 시드 계정 2건("우리집 통장", "현금 지갑")은 소유자 없이 생성되어 있어(`backend/alembic/versions/0002_seed_master_data.py:50-56`) 마이그레이션에서 기존 계정 전부를 특정 구성원으로 백필해야 한다. 둘째, 엑셀 가져오기가 미존재 계정을 자동 생성하는데(`backend/app/routers/transactions.py:163-174`) 뱅크샐러드 엑셀에는 소유자 정보가 없으므로, 업로드 다이얼로그에 "새 계정 기본 소유자" select를 추가해 가져오기 API에 전달하는 방식으로 해결한다.

목표 달성 현황은 `assets.total`(필터된 값)을 사용 중이므로(`AssetsPage.tsx:222,234`), 구성원 필터 시에도 전체 기준 달성률을 보여주려면 assets 응답에 필터와 무관한 **전체 총자산**을 별도 필드로 항상 포함시킨다.

구성원 "으니/영이"는 시드 데이터로 존재하며(`0002_seed_master_data.py:46-47`), 프론트는 `GET /members`로 목록을 받아 쓰고 있으므로(`frontend/src/stores/masterData.ts:48-55`) select 옵션은 하드코딩하지 않고 동적으로 구성한다. 세 페이지에서 선택값이 공유·유지되도록 전역 상태(zustand 스토어)로 관리한다.

## 관련 파일 및 근거

### A. 자산 카드 그룹핑 (프론트 전용)
- `frontend/src/pages/AssetsPage.tsx:267-301` — 현재 계정 카드를 평면 그리드(`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`)로 렌더. 이 블록을 유형별 그룹 구조로 교체할 대상.
- `frontend/src/pages/AssetsPage.tsx:25-33` — `ACCOUNT_TYPE_LABEL` (은행/현금/카드/투자/주식/부동산/기타). 그룹 제목과 정렬 순서의 기준.
- `frontend/src/types.ts:92-100` — `AccountBalance`에 `type: AccountType`이 이미 포함되어 있어 그룹핑 자체는 추가 API 변경 불필요.

### B. 구성원 필터 — 공통
- `backend/alembic/versions/0002_seed_master_data.py:46-47` — 구성원 시드 "으니", "영이".
- `frontend/src/stores/masterData.ts:48-55` — `GET /members`로 구성원 목록을 이미 로드함. select 옵션 소스.
- `frontend/src/components/layout/AppLayout.tsx:14-52` — 공통 레이아웃. 상단 헤더 바가 없고 각 페이지가 자체 h1 헤더를 가짐(예: `DashboardPage.tsx:70-81`, `TransactionsPage.tsx:319-345`, `AssetsPage.tsx:190`). "최상단 우측" select는 각 페이지 헤더 우측에 배치하되 선택 상태는 전역 공유.
- `frontend/src/components/ui/select.tsx` — 사용할 Select 컴포넌트 (TransactionsPage에서 사용 패턴 확인됨).

### C. 지출/수입 내역 필터
- `backend/app/routers/transactions.py:50-82` — 목록 API가 `member_id` 파라미터를 **이미 지원** (`:56`, `:80-81`). 백엔드 변경 불필요.
- `frontend/src/stores/transactions.ts:7-23` — `TransactionFilters`에 `member_id` 없음. 필터 타입과 `toQuery`에 추가 필요.
- `frontend/src/pages/TransactionsPage.tsx:105-111,529-534` — 캘린더 뷰·일자별 상세는 같은 `items`를 사용하므로 필터 추가 시 자동 반영됨.

### D. 대시보드 필터 (백엔드 + 프론트)
- `backend/app/routers/analytics.py:29-106` — `dashboard()`: `month_total`(:37-42), `expense_rows`(:45-54), `spent_by_category`(:56-65), `recent`(:83-92) 네 곳의 거래 집계에 member 필터 조건 추가 필요. 예산 행(`budget_rows`, :67-72)은 구성원 무관(가구 공통)이므로 금액은 그대로 두고 `spent`만 필터됨.
- `backend/app/schemas.py:155-163` — `DashboardOut`. 응답 스키마 변경 불필요.
- `frontend/src/stores/analytics.ts:17-20` — `fetchDashboard(month)`에 memberId 전달 확장 필요.
- `frontend/src/pages/DashboardPage.tsx:24-31` — month 변경 시 재조회하는 effect. member 선택도 의존성에 포함 필요. **주의: 이 파일은 작업 트리에 미커밋 변경(treemap)이 있음 — 현재 작업 트리 버전 위에서 작업.**

### E. 계정 소유자 필수화 (스키마 변경 + 마이그레이션 + UI)
- `backend/app/models.py:21-32` — `Account`에 `member_id` 없음. **NOT NULL** FK 추가 대상. ondelete는 SET NULL 불가(NOT NULL이므로) — RESTRICT로 두고 구성원 삭제 시 차단.
- `backend/app/models.py:72-74` — 거래의 member FK는 nullable + SET NULL. 계정과 정책이 다름(계정은 필수)을 유의.
- `backend/alembic/versions/0004_category_hierarchy_and_import.py` — 최신 리비전. 새 마이그레이션은 0005. 기존 계정(시드 "우리집 통장"/"현금 지갑" 포함, `0002:50-56`)을 **id가 가장 작은 구성원으로 백필** 후 NOT NULL 제약 적용. 구성원이 0명인 DB에서 계정이 존재하면 마이그레이션 실패 — 시드상 발생하지 않으나 가드 필요.
- `backend/app/schemas.py:28-41` — `AccountCreate/Update/Out`에 `member_id: int` (필수) 추가.
- `backend/app/routers/accounts.py:17-31` — create/update가 `model_dump()`를 그대로 사용하므로 스키마 추가로 반영되나, 존재하지 않는 member_id에 대한 404 검증 추가 필요(`transactions.py:37-46`의 `_validate_refs` 패턴 참고).
- `backend/app/routers/members.py:34-38` — 구성원 삭제. 계정 FK가 RESTRICT가 되므로 차단 메시지에 "계정에서 참조 중" 케이스 반영 필요.
- `backend/app/routers/transactions.py:115-197` — 엑셀 가져오기. 새 계정 자동 생성(:163-174) 시 소유자 필수 → **가져오기 API에 기본 소유자 파라미터(Form) 추가**, 업로드 다이얼로그(`TransactionsPage.tsx:726-805`)에 소유자 select 추가. 새 계정이 생성되지 않는 업로드에서는 해당 값이 사용되지 않는다.
- `frontend/src/types.ts:18-24` — `Account` 타입에 `member_id: number` 추가.
- `frontend/src/stores/masterData.ts:11-16` — `AccountInput`에 `member_id: number` 추가.
- `frontend/src/pages/SettingsPage.tsx:219-365` — `AccountsTab` 폼(:304-362)에 소유자 select(필수, 미선택 시 검증 에러), 테이블(:274-301)에 소유자 컬럼 추가.

### F. 자산 상태 필터 + 공동 목표
- `backend/app/routers/analytics.py:109-223` — `assets()`: `member_id` 쿼리 파라미터 추가. member 지정 시 해당 소유 계정만으로 `balances`/`total`/`trend` 계산. 평가액·거래 합산 로직은 계정 단위라 계정 집합만 줄이면 일관됨. 단, **필터와 무관한 전체 총자산을 응답에 항상 포함**(예: 별도 필드)해 목표 달성률 계산에 사용.
- `backend/app/schemas.py:181-184` — `AssetsOut`에 전체 총자산 필드 추가 필요 (필드명은 구현 재량).
- `frontend/src/types.ts:132-136` — `Assets` 타입에 동일 필드 추가.
- `frontend/src/pages/AssetsPage.tsx:201-265` — 목표 달성 현황 카드. 현재 `assets.total` 기준(:222,234) → **전체 총자산 필드** 기준으로 변경, 구성원 필터와 무관하게 항상 표시.
- `frontend/src/stores/analytics.ts:22-25` — `fetchAssets()`에 memberId 전달 확장 필요.

## 영향도

- `frontend/src/pages/TransactionsPage.tsx:81-103` — 필터 스토어 확장 시 기존 필터(월/구분/대분류/소분류)와의 조합 동작. member 필터는 다른 필터와 독립이므로 초기화 연쇄 불필요.
- `frontend/src/pages/AssetsPage.tsx:186-199` — 총자산 카드는 구성원 필터 시 **필터된 총자산**(선택 구성원 소유 계정 합)을 표시 — 목표 카드(전체 기준)와 기준이 달라지므로 화면에서 혼동 없게 라벨로 구분(예: 목표 카드에 "부부 공동 기준" 명시 — 문구는 구현 재량).
- `backend/app/routers/members.py:34-38` — 계정 FK RESTRICT 추가로 구성원 삭제가 새로운 사유로 실패할 수 있음. 에러 메시지 갱신 필요.
- 엑셀 가져오기 — 기존에 계정이 모두 존재하는 재업로드는 동작 불변. 새 계정이 생기는 업로드만 기본 소유자 지정의 영향을 받음(`transactions.py:163-174`).
- 마이그레이션 백필 — 기존 계정 전부가 첫 구성원(으니) 소유가 되므로, 사용자는 적용 후 기준정보 관리에서 실제 소유자로 재지정해야 함(명세상 허용된 일회성 수동 작업).
- 대시보드 "최근 거래" 5건(`analytics.py:83-92`) — member 필터 적용 시 표시 건수가 달라질 수 있으나 의미상 올바름.
- `_validate_refs`(`transactions.py:37-46`) — 거래의 member_id는 여전히 nullable(거래 주체 미표기 허용). 이번 정책은 **계정 소유자**에만 적용되며 거래 스키마는 변경하지 않는다.

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: 자산 상태 페이지에서 계정 카드가 계정 유형별 그룹 카드(그룹 제목 = 한글 유형 라벨) 안에 중첩 카드로 렌더링된다 — 브라우저에서 자산 상태 페이지를 열어 은행/카드 등 유형별 묶음과 그 내부의 계정 카드를 확인.
- [ ] AC-2: 유형 그룹은 고정 순서(은행→현금→카드→투자→주식→부동산→기타)로 정렬되고, 계정이 없는 유형 그룹은 표시되지 않으며, 각 그룹 헤더에 해당 유형 소계 금액이 표시된다 — 브라우저에서 그룹 순서·소계·빈 유형 미표시를 확인.
- [ ] AC-3: 기존 계정 카드 기능(잔액 색상, 평가 기준일 표시, 주식/부동산의 "평가액 갱신" 버튼, 비활성 배지)이 그룹핑 후에도 동일하게 동작한다 — 브라우저에서 주식형 계정의 평가액 갱신 다이얼로그 열림을 확인.
- [ ] AC-4: 대시보드·자산 상태·지출/수입 내역 세 페이지의 최상단 우측에 구성원 select가 표시되고, 옵션은 "전체" + `GET /members` 결과(시드 기준 으니/영이)로 동적 구성된다 — 브라우저에서 세 페이지 모두 확인하고, 기준정보 관리에서 구성원 추가 시 옵션에 반영되는지 확인.
- [ ] AC-5: 구성원 선택은 페이지를 이동해도 유지된다(전역 상태) — 대시보드에서 "으니" 선택 후 지출/수입 내역으로 이동해 select가 "으니"로 유지되고 목록이 필터된 상태인지 확인.
- [ ] AC-6: 지출/수입 내역에서 구성원 선택 시 해당 구성원 거래만 테이블·캘린더에 표시된다 — 구성원이 다른 거래 2건을 만들고 select 전환으로 확인 (`GET /transactions?member_id=N` 응답과 일치).
- [ ] AC-7: 대시보드에서 구성원 선택 시 수입/지출 합계, 카테고리별 지출(트리맵), 예산 진행의 spent, 최근 거래가 모두 해당 구성원 거래만 집계된다 — `curl "/analytics/dashboard?month=YYYY-MM&member_id=N"` 응답이 해당 구성원 거래 합과 일치하는지 확인. 예산 금액(amount) 자체는 변하지 않는다.
- [ ] AC-8: 계정 생성·수정 시 소유자가 필수다 — (a) 기준정보 관리의 계정 다이얼로그에 소유자 select가 있고 미선택 시 저장이 막히며(검증 에러 표시), (b) `POST /accounts`에 `member_id` 누락 시 422, 존재하지 않는 `member_id`는 404를 반환하는지 API 호출로 확인.
- [ ] AC-9: 마이그레이션 적용 후 모든 기존 계정에 소유자가 백필되어 있다 — `alembic upgrade head` 성공 후 `GET /accounts` 응답의 모든 항목에 `member_id`가 존재(NULL 없음)하는지 확인. 기준정보 관리 계정 테이블에 소유자 컬럼이 표시된다.
- [ ] AC-10: 계정을 소유한 구성원은 삭제할 수 없고 사유가 안내된다 — 계정 소유자인 구성원 삭제 시도 시 API가 409(또는 동급 에러)와 계정 참조를 알리는 메시지를 반환하는지 확인.
- [ ] AC-11: 엑셀 업로드 다이얼로그에 새 계정의 기본 소유자 select가 있고, 가져오기로 자동 생성된 계정에 해당 소유자가 지정된다 — 미존재 계정명이 포함된 엑셀 업로드 후 `GET /accounts`에서 신규 계정의 `member_id` 확인.
- [ ] AC-12: 자산 상태에서 구성원 선택 시 해당 구성원 소유 계정만 카드에 나타나고, 상단 총자산과 월별 추이도 그 계정들만으로 계산된다 — 계정 2개에 서로 다른 소유자를 지정하고 `curl "/analytics/assets?member_id=N"` 및 브라우저로 확인.
- [ ] AC-13: 목표 달성 현황 카드는 구성원 필터와 무관하게 항상 표시되고, 달성률은 항상 가구 전체 총자산 기준으로 동일하다 — 구성원 "으니" 선택 전후로 목표 카드의 달성률 수치가 변하지 않음을 브라우저에서 확인하고, `/analytics/assets?member_id=N` 응답에 전체 총자산 필드가 포함되는지 확인.
- [ ] AC-14: '전체' 선택 시(또는 파라미터 미전달 시) 세 페이지 모두 기존과 동일한 결과를 반환한다(회귀 없음) — member_id 없는 API 호출 응답이 변경 전과 동일 구조·값인지(assets의 신규 전체 총자산 필드 추가 제외) 확인.

## Action Items

- [ ] (BE) `Account` 모델에 `member_id` NOT NULL FK(RESTRICT) 추가 (`models.py`).
- [ ] (BE) Alembic 마이그레이션 0005: 컬럼을 nullable로 추가 → 기존 계정을 id가 가장 작은 구성원으로 백필 → NOT NULL 제약 적용. 구성원 0명 + 계정 존재 시 명확한 에러로 중단 (`alembic/versions/`).
- [ ] (BE) `AccountCreate/Out` 스키마에 `member_id: int` 필수 추가, accounts 라우터 create/update에 member 존재 검증(404) 추가 (`schemas.py`, `routers/accounts.py`).
- [ ] (BE) 구성원 삭제 차단 메시지에 계정 참조 사유 반영 (`routers/members.py:34-38`).
- [ ] (BE) 엑셀 가져오기 API에 새 계정 기본 소유자 Form 파라미터 추가, 자동 생성 계정에 적용 (`routers/transactions.py:115-197`).
- [ ] (BE) `/analytics/dashboard`에 `member_id` 선택 쿼리 파라미터 추가 — 거래 기반 집계 4곳(월합계, 대분류별 지출, 카테고리별 spent, 최근 거래)에 필터 적용 (`routers/analytics.py:29-106`).
- [ ] (BE) `/analytics/assets`에 `member_id` 선택 쿼리 파라미터 추가 — 소유 계정만으로 balances/total/trend 계산하고, 필터와 무관한 전체 총자산 필드를 응답에 항상 포함 (`routers/analytics.py:109-223`, `schemas.py:181-184`).
- [ ] (FE) 전역 구성원 필터 스토어(선택값: null=전체 | member id) 신설 + 재사용 select 컴포넌트 작성, 세 페이지 헤더 우측에 배치.
- [ ] (FE) `TransactionFilters`/`toQuery`에 `member_id` 추가하고 전역 필터와 연동 (`stores/transactions.ts`).
- [ ] (FE) `fetchDashboard`/`fetchAssets`에 memberId 전달 확장, 페이지 effect 의존성에 선택값 추가 (`stores/analytics.ts`, `DashboardPage.tsx`, `AssetsPage.tsx`).
- [ ] (FE) AssetsPage 계정 카드 영역을 유형별 그룹 카드(헤더: 라벨+소계) 안 중첩 카드 구조로 교체 (`AssetsPage.tsx:267-301`).
- [ ] (FE) 목표 달성 현황 카드를 전체 총자산 필드 기준으로 변경하고 항상 표시, "부부 공동 기준"임을 안내 (`AssetsPage.tsx:201-265`, `types.ts:132-136`).
- [ ] (FE) `Account` 타입·`AccountInput`에 `member_id: number` 추가, SettingsPage AccountsTab에 소유자 select(필수 검증)와 테이블 컬럼 추가 (`types.ts`, `stores/masterData.ts`, `SettingsPage.tsx:219-365`).
- [ ] (FE) 엑셀 업로드 다이얼로그에 새 계정 기본 소유자 select 추가 (`TransactionsPage.tsx:726-805`).

## 미해결 질문

- 마이그레이션 백필 대상 구성원: 기존 계정(시드 2건 포함)을 **id가 가장 작은 구성원(시드 기준 으니)** 소유로 일괄 지정하는 것으로 명세함. 적용 후 기준정보 관리에서 실제 소유자로 재지정하는 일회성 수동 작업이 필요 — 다른 백필 기준을 원하면 implement 전에 지정 필요.
- `AssetsOut`의 전체 총자산 필드명, 전역 스토어 키 이름, select의 정확한 시각적 배치(너비·아이콘), 목표 카드의 안내 문구 등은 구현 재량.
