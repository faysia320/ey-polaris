# Research: 예산을 지출 대분류 단위로만 설정·집계

- 날짜: 2026-06-12
- 요청 원문: 예산은 너무 자잘하게 설정하지 않고 지출 카테고리의 대분류로만 설정하고 집계 되도록 해줘

## 요약

현재 예산(`Budget`)은 카테고리 행 단위(`category_id` FK)로 설정된다 (`backend/app/models.py:132-145`). 카테고리는 대분류(major)/소분류(minor) 2단계 구조이고 지출 소분류만 56쌍이 시드되어 있어 (`backend/alembic/versions/0004_category_hierarchy_and_import.py:25-41`), 예산 페이지에 소분류 행이 전부 나열되고 예산이 자잘하게 쪼개진다. 대시보드 집계도 `category_id` 단위로 spent를 매칭한다 (`backend/app/routers/analytics.py:62-88`).

해결 방향: **Budget의 키를 `category_id`에서 대분류 문자열(`major`)로 전환**한다. "대분류당 대표 카테고리 행 1개로 제한" 방식은 불가능한데, 다수 대분류(교통·금융·자동차·패션/뷰티 등)에 '미분류' 소분류 행이 없어 대분류를 대표하는 카테고리 행이 존재하지 않기 때문이다 (`0004_category_hierarchy_and_import.py:25-41`). 따라서 DB 마이그레이션(컬럼 교체 + 기존 예산의 대분류별 합산 병합), 예산 CRUD API, 대시보드 집계, 프론트 예산 페이지·대시보드 위젯·타입을 함께 변경한다.

부수 효과로 대시보드 도넛/트리맵(`expense_by_category`)은 이미 대분류로 집계되고 있어 (`analytics.py:51-61`), 예산 항목 이름이 대분류로 통일되면 색상 매핑(`DashboardPage.tsx:81-87`, 이름 기준 배색)이 자연스럽게 일치하게 된다.

## 관련 파일 및 근거

### Backend
- `backend/app/models.py:132-145` — `Budget` 모델. `category_id` FK + `(year_month, category_id)` 유니크. **변경 핵심**: `major` 문자열 컬럼으로 교체, 유니크 `(year_month, major)`.
- `backend/app/models.py:42-65` — `Category`: major/minor 2단계, `display_name` 프로퍼티. 대분류는 별도 테이블이 아니라 categories 행들의 `major` 문자열 집합.
- `backend/app/schemas.py:130-144` — `BudgetCreate`(category_id 입력), `BudgetOut`(category_name 포함). 대분류 기반 입력/출력으로 교체 대상.
- `backend/app/schemas.py:154-158` — `BudgetProgress.category_id` — 대분류 키로 교체 대상.
- `backend/app/routers/budgets.py:35-44` — 생성 시 `category.kind != "expense"` 검증. 대분류 기반 검증(해당 major의 지출 카테고리 존재 여부)으로 교체 대상.
- `backend/app/routers/analytics.py:62-88` — 예산 진행률 spent를 `category_id` 단위로 집계. `Category.major` 단위 group by로 교체 대상 (도넛용 대분류 집계 `analytics.py:52-61`과 같은 패턴 재사용 가능).
- `backend/app/routers/analytics.py:40-42` — `member_id` 필터가 spent 집계에 적용됨 — 대분류 집계로 바꿔도 동일하게 유지해야 함.
- `backend/app/routers/categories.py:40-44` — 카테고리 삭제 시 FK RESTRICT(거래·예산)를 409로 변환. Budget의 FK가 사라지면 메시지/동작 의미가 바뀜 (예산은 더 이상 삭제를 막지 않음).
- `backend/alembic/versions/0006_transfer_transactions.py` — 최신 리비전 0006. 신규 마이그레이션은 0007.

### Frontend
- `frontend/src/pages/BudgetsPage.tsx:30-37,110-155` — 지출 카테고리(소분류 포함) 전체를 행으로 나열하고 `category_id`로 저장. 지출 **대분류 고유 목록** 행으로 교체 대상. 행별 nature 태그(`:117`)는 대분류 내 소분류들의 nature가 혼재하므로 그대로 유지 불가.
- `frontend/src/stores/budgets.ts:26-35` — `save(categoryId, amount)` — 대분류 키로 교체 대상.
- `frontend/src/types.ts:68-81` — `Budget.category_id`, `BudgetProgress.category_id` 타입 교체 대상.
- `frontend/src/pages/DashboardPage.tsx:218-258` — 예산 스택바·범례가 `category_id`를 React key로, `category_name`을 색상 키로 사용. 대분류 키로 교체 대상.
- `frontend/src/lib/format.ts:13-15` — `categoryLabel` — 예산 페이지에서는 더 이상 불필요(대분류 이름 그대로 표시).

## 영향도

- **DB 데이터**: 기존 budgets 행이 소분류 카테고리를 가리킬 수 있음 → 마이그레이션에서 `(year_month, major)`별 **금액 합산 병합** 필요 (단순 컬럼 교체만 하면 유니크 위반 가능).
- **카테고리 관리(Settings)**: 카테고리의 major 이름 변경/삭제가 더 이상 예산과 FK로 연결되지 않음 — major 이름을 바꾸면 기존 예산은 옛 이름 문자열로 남는다(고아 가능). 카테고리 삭제는 예산 참조로 막히지 않게 됨 (`categories.py:44` 메시지 수정 필요).
- **대시보드**: `BudgetProgress` 스키마 변경으로 프론트 타입·렌더링 키 동반 수정. `budget_total`/`budget_spent`/안내 메시지(`DashboardPage.tsx:48-57`) 로직은 합계 기반이라 영향 없음.
- **엑셀 가져오기**(`backend/app/excel_import.py`): budgets를 참조하지 않음 — 영향 없음 (Grep으로 Budget 참조는 models/schemas/budgets/analytics 4개 파일뿐임을 확인).
- **테스트**: backend/tests 폴더 없음 — 깨질 기존 테스트 없음. 검증은 API 수동 호출 + 브라우저로 수행.

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: 예산 생성 API(`POST /budgets`)가 **지출 대분류 단위** 입력을 받는다. 존재하지 않는 대분류, 또는 지출(kind=expense) 카테고리가 하나도 없는 대분류(예: 수입 전용 '급여')로 생성 시 422를 반환한다 — OpenAPI 문서(http://localhost:8000/docs) 또는 curl로 확인.
- [ ] AC-2: 같은 (연월, 대분류) 조합으로 중복 생성 시 409를 반환한다 — curl로 동일 요청 2회 호출해 확인.
- [ ] AC-3: `GET /analytics/dashboard`의 `budgets[].spent`가 해당 대분류 아래 **모든 소분류 지출 거래의 합계**와 일치한다 — 같은 대분류의 서로 다른 소분류 2개에 지출 거래를 만들고 spent가 합산되는지 API 응답으로 확인. `member_id` 필터 적용 시에도 해당 구성원 거래만 합산된다.
- [ ] AC-4: 마이그레이션(`alembic upgrade head`)이 기존 예산을 유실 없이 보존한다 — 같은 달에 같은 대분류의 소분류 예산이 여러 건이면 금액이 **합산되어 1행**으로 병합된다. 업그레이드 전후 월별 총액(`budget_total`)이 동일함을 확인.
- [ ] AC-5: 예산 페이지가 지출 **대분류 목록만** 행으로 표시하고(소분류 행 없음), 생성·수정·삭제가 정상 동작한다 — 브라우저에서 확인.
- [ ] AC-6: 대시보드 예산 소진율 위젯(스택바·범례)이 대분류 이름으로 표시되고, 카테고리별 지출 차트(대분류)와 같은 이름에 같은 색이 매핑된다 — 브라우저에서 확인.
- [ ] AC-7 (모바일 AC): 375px 뷰포트에서 예산 페이지와 대시보드 예산 위젯에 가로 스크롤·요소 겹침·잘림이 없다 — 브라우저 도구로 375px 뷰포트 확인.
- [ ] AC-8: `cd frontend && npm run build`(tsc + vite)가 통과한다.

## Action Items

- [ ] Alembic 마이그레이션 0007 작성: budgets에 `major` 컬럼 추가 → 기존 행을 카테고리 join으로 백필 → `(year_month, major)` 중복 행 금액 합산 병합 → `category_id` 컬럼·FK·기존 유니크 제거 → `(year_month, major)` 유니크 추가. downgrade도 합리적 수준으로 제공(구현 재량).
- [ ] `models.Budget`을 `major` 문자열 키로 변경 (`category` relationship 제거).
- [ ] `schemas.BudgetCreate/BudgetOut/BudgetProgress`를 대분류 기반으로 변경 (필드 이름·표시명 처리 방식은 구현 재량).
- [ ] `routers/budgets.py`: 생성 시 "해당 major의 expense 카테고리 존재" 검증으로 교체, `_to_out` 단순화.
- [ ] `routers/analytics.py`: 예산 spent 집계를 `Category.major` 단위 group by로 교체 (member 필터 유지).
- [ ] `routers/categories.py:44`: 삭제 409 메시지에서 '예산' 문구 제거 (예산은 더 이상 FK로 삭제를 막지 않음).
- [ ] 프론트: `types.ts`(Budget/BudgetProgress), `stores/budgets.ts`(save 키), `BudgetsPage.tsx`(대분류 고유 목록 행 — nature 태그 처리 방식은 구현 재량), `DashboardPage.tsx`(렌더링 키) 수정.
- [ ] 마이그레이션 후 로컬 스택에서 AC-1~7 검증.

## 미해결 질문

- 카테고리의 major **이름 변경** 시 기존 예산 문자열을 따라 바꿀지: 한 major 아래 소분류 행이 여러 개라 개별 카테고리 행의 major 수정이 곧 "대분류 이름 변경"이라고 단정할 수 없음 (일부 소분류만 다른 대분류로 옮기는 경우와 구분 불가). **권장: 이번 작업에서는 동기화하지 않고 알려진 한계로 둔다** — 옛 이름 예산은 목록에 남아 삭제 가능.
- BudgetOut/BudgetProgress의 필드 네이밍(`major` vs `category_name` 유지): 구현 재량. 프론트 수정 범위를 줄이려면 표시용 이름 필드를 유지하는 선택도 가능.
