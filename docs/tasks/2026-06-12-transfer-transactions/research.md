# Research: 계좌 간 이체(transfer) 거래 종류 도입

- 날짜: 2026-06-12
- 요청 원문: transfer 도입을 원해
- 선행 조사: `docs/tasks/2026-06-12-card-liability-asset-aggregation/research.md` (카드 음수 잔액·카드대금 상환 미표현 문제)

## 요약

현재 거래는 `income | expense` 두 종류뿐이라(`backend/app/models.py:74`, `backend/app/schemas.py:46`) 카드대금 상환·내계좌이체·저축/투자 이동을 표현할 수 없고, 그 결과 은행 잔액은 과대·카드 잔액은 음수로 무한 누적된다(`backend/app/routers/analytics.py:164,173`). 본 작업은 `kind="transfer"`를 추가하고 거래에 **입금 상대 계정(counter account)** 컬럼을 더해, 한 건의 이체 거래가 출금 계정에서 −, 입금 계정에서 +로 잔액에 반영되게 한다. 이체는 수입/지출 통계(대시보드 합계·카테고리 집계·예산)에 포함되지 않아야 한다 — 기존 집계가 모두 `kind == "income"/"expense"` 필터를 쓰므로 대부분 자동 충족되며, 계정 잔액 집계에만 입금 다리(+) 가산이 추가로 필요하다.

엑셀 업로드의 "이체" 행 자동 변환은 **범위에서 제외**한다. 실제 데이터(저장소 루트 `2025-06-11~2026-06-11.xlsx`, 이체 157행)를 직접 분석한 결과: ① 행마다 한쪽 다리(결제수단 계정)만 기록되고 부호로 입출금을 구분하며, ② 상대 계정은 자유 텍스트 `내용`("우리카드선결제", "NH이진영" 등)뿐이라 구조적으로 식별 불가, ③ 외부인 송금(경조사비, 개인 간 이체)이 같은 "이체" 타입에 혼재한다. 따라서 자동 변환은 오귀속·총자산 왜곡을 만들므로 기존 스킵 정책(`backend/app/excel_import.py:112-113`)을 유지하고, transfer는 수동 입력으로 등록한다.

카테고리는 NOT NULL FK이므로(`models.py:75`) 이체용 카테고리를 시드한다(`kind="transfer"`, 대분류 "이체" + 소분류 카드대금/내계좌이체/저축/투자 등). 이렇게 하면 기존 `category.kind == transaction.kind` 검증(`backend/app/routers/transactions.py:42-46`)이 구조 변경 없이 그대로 동작한다.

## 관련 파일 및 근거

### 백엔드
- `backend/app/models.py:66-85` — `Transaction` 모델. `kind` 주석 확장, 입금 상대 계정 FK 컬럼(nullable) 추가 지점. `category_id`가 NOT NULL(75행)이므로 이체 카테고리 시드 필요.
- `backend/app/models.py:40-63` — `Category.kind`에 transfer 추가 영향(시드 카테고리의 kind).
- `backend/app/schemas.py:46` — `CategoryKind = Literal["income", "expense"]` 확장 지점. `TransactionCreate.kind`(70행)와 거래 목록 필터(`transactions.py:52`)가 이 타입을 공유.
- `backend/app/schemas.py:67-87` — `TransactionCreate/Out`에 상대 계정 필드 추가 지점.
- `backend/app/routers/transactions.py:37-46` — `_validate_refs`: 이체 전용 검증(상대 계정 필수, 출금≠입금, income/expense는 상대 계정 금지) 추가 지점. `category.kind == kind` 검증은 시드 카테고리로 자연 충족.
- `backend/app/routers/transactions.py:21-34` — `_to_out`: 상대 계정 id/이름 직렬화 추가 지점.
- `backend/app/routers/analytics.py:21-26` — `_signed_amount()`: income +, 그 외 −. transfer 행은 출금 계정(−)으로는 이미 올바르게 집계되나, **입금 계정(+) 다리가 누락**됨.
- `backend/app/routers/analytics.py:125-131` — `net_by_account`(현재 잔액): kind 필터 없는 합산. transfer 입금 다리를 가산하는 보조 집계 필요.
- `backend/app/routers/analytics.py:179-187` — `account_month_net`(월별 추이): 동일하게 입금 다리 가산 필요.
- `backend/app/routers/analytics.py:41-46,49-69` — 대시보드 `month_total`/`expense_by_category`/`spent_by_category`: 모두 `kind == "income"/"expense"` 필터 — transfer 자동 제외, **변경 불필요** (회귀 확인만).
- `backend/app/routers/analytics.py:87-99` — 최근 거래 5건: kind 필터 없음 → transfer 포함됨. 단 `DashboardOut`(schemas.py:156-163)에 `recent_transactions` 필드가 없어 pydantic이 응답에서 버리는 기존 데드코드 — 이번 작업에서 동작 변경 없음.
- `backend/app/routers/budgets.py:38-39` — 예산은 expense 카테고리 전용 → transfer 카테고리 예산 설정 자동 차단, **변경 불필요**.
- `backend/app/excel_import.py:112-113` — "이체" 스킵 유지. 스킵 사유 문구에 수동 이체 입력 안내 추가는 선택.
- `backend/alembic/versions/0005_account_owner_required.py` — 최신 리비전(0005). 신규 0006 마이그레이션의 패턴 참조(컬럼 추가 → 데이터 갱신 → 제약 전환).
- `backend/alembic/versions/0004_category_hierarchy_and_import.py` — 카테고리 시드 패턴 참조(transfer 카테고리 시드도 마이그레이션으로).

### 프론트엔드
- `frontend/src/types.ts` — `TransactionKind`에 `'transfer'`, `Transaction`/`TransactionInput`에 상대 계정 필드 추가 (Explore 요약 기준; 타입 파일 위치 확인됨).
- `frontend/src/pages/TransactionsPage.tsx:61-82` — `FormState`/`emptyForm`: 상대 계정 필드 추가 지점.
- `frontend/src/pages/TransactionsPage.tsx:162-188` — `submit`: transfer 시 상대 계정 필수·출금≠입금 검증, payload 확장.
- `frontend/src/pages/TransactionsPage.tsx:146-160` — `openEdit`: 상대 계정 복원.
- `frontend/src/pages/TransactionsPage.tsx:204-235` — 테이블 구분 배지(income/expense 이분법, 208-209행)와 금액 색·부호(226-232행): transfer 분기 필요.
- `frontend/src/pages/TransactionsPage.tsx:380-398` — 구분 필터 Select: '이체' 옵션 추가.
- `frontend/src/pages/TransactionsPage.tsx:608-625` — 거래 폼 구분 Select: '이체' 옵션 추가, 선택 시 출금/입금 계정 2개 노출.
- `frontend/src/pages/TransactionsPage.tsx:282-297` — 구분별 카테고리 캐스케이드: kind 기반 필터라 transfer 카테고리 자동 노출(시드 후).
- `frontend/src/components/transactions/TransactionCalendar.tsx:29-38` — 일별 합계가 `kind === 'income' ? income : expense` 이분법(33-34행) — **transfer가 지출로 오집계되므로 제외 분기 필수**.
- `frontend/src/pages/AssetsPage.tsx` — 변경 불필요(잔액은 백엔드 계산 결과 표시). 이체 등록 후 카드 음수 잔액이 회복되는지 확인 대상.

### 데이터 근거 (엑셀 분석 — 백엔드 컨테이너에서 직접 파싱)
- 이체 157행 = 내계좌이체 36 / 이체 62 / 카드대금 18 / 투자 17 / 저축 14 / 미분류 7 / 현금 3.
- 카드대금 행은 전부 음수(은행 출금 다리만 존재), 상대 카드 계정 정보 없음. "이체" 대분류에는 외부인 송금 혼재(+35/−27). → 자동 변환 불가 판단의 근거.

## 영향도

- **계정 잔액·총자산·월별 추이** (`analytics.py:116-237`): transfer 등록 시 출금 −/입금 + 반영. 전체 총자산은 불변(내부 이동), 구성원 필터 총자산은 계정 소유자에 따라 이동 — 의도된 동작.
- **대시보드 수입/지출/예산** (`analytics.py:29-113`, `budgets.py`): kind 필터로 transfer 제외 — 수치 불변이어야 함(회귀 대상).
- **거래 목록·캘린더** (`TransactionsPage.tsx`, `TransactionCalendar.tsx`): transfer 표시·필터·일별 합계 제외 처리.
- **카테고리 설정 UI**: `CategoryKind` 확장으로 사용자 정의 transfer 카테고리 생성이 가능해짐 — 카테고리 설정 화면의 kind 선택지 노출 여부는 구현 재량(최소한 깨지지 않아야 함).
- **엑셀 업로드** (`excel_import.py`, `transactions.py:115-208`): 동작 불변. 재업로드 삭제 범위가 `source="import"`로 한정되므로 수동 transfer는 보존됨(`transactions.py:142-152`).
- **기존 데이터**: 마이그레이션은 컬럼 추가(nullable)와 카테고리 시드뿐 — 기존 거래 무영향.

## 성공 기준 (Acceptance Criteria)

검증 환경: `docker compose up` 스택(백엔드 :8000, 프론트 :3000). 백엔드 테스트 하니스는 현재 없음(`backend/tests/` 부재) — API 직접 호출 또는 신규 테스트로 확인.

- [ ] AC-1: `POST /transactions`에 `kind=transfer`, 출금 계정 A(은행), 입금 계정 B(카드), 금액 X로 등록하면 201이고, `GET /analytics/assets`에서 A 잔액 −X, B 잔액 +X, `total`·`grand_total` 불변 — 등록 전후 API 응답 비교로 확인.
- [ ] AC-2: transfer 등록이 `GET /analytics/dashboard`의 `income_total`/`expense_total`/`expense_by_category`/`budget_spent`를 변화시키지 않는다 — 등록 전후 응답 비교로 확인.
- [ ] AC-3: 구성원 필터 자산 조회(`GET /analytics/assets?member_id=`)에서, 출금 계정 소유자의 `total`은 −X, 입금 계정 소유자의 `total`은 +X로 반영된다 — 소유자가 다른 두 계정으로 확인.
- [ ] AC-4: 검증 오류 — ① transfer인데 입금 계정 누락, ② 출금=입금 동일 계정, ③ income/expense인데 입금 계정 지정, ④ transfer에 income/expense 카테고리 지정 — 각각 422와 한국어 사유 메시지를 반환한다 — API 호출로 확인.
- [ ] AC-5: 월별 자산 추이(`trend`)에 이체의 양쪽 다리가 해당 월부터 반영된다(전체 합계는 불변, 구성원 필터 시 이동 확인) — AC-3과 동일한 데이터로 trend 응답 확인.
- [ ] AC-6: 거래 페이지 폼에서 구분 '이체' 선택 시 출금·입금 계정과 이체 카테고리를 선택해 등록·수정·삭제할 수 있다 — 브라우저(:3000)에서 확인.
- [ ] AC-7: 거래 테이블·캘린더에 이체가 수입/지출과 구별되게 표시되고, 캘린더 일별 수입/지출 합계에는 포함되지 않는다 — 브라우저에서 확인.
- [ ] AC-8: 구분 필터에 '이체'가 추가되어 이체만 조회할 수 있다(`GET /transactions?kind=transfer` 동작 포함) — 브라우저·API로 확인.
- [ ] AC-9: `alembic upgrade head`가 성공하고 이체 카테고리(kind=transfer)가 시드되며, 기존 income/expense 거래·집계가 변하지 않는다 — 마이그레이션 후 `GET /categories` 및 기존 화면 회귀 확인.
- [ ] AC-10: 기존 뱅크샐러드 엑셀 업로드 동작 불변 — "이체" 타입 행은 여전히 스킵 목록에 사유와 함께 표시된다 — 루트의 실제 xlsx로 업로드해 확인.

## Action Items

- [ ] 마이그레이션 0006: `transactions`에 입금 상대 계정 FK 컬럼(nullable) 추가 + 이체 카테고리 시드(대분류 "이체", kind=transfer; 소분류 구성은 구현 재량 — 카드대금/내계좌이체/저축/투자/미분류 권고). downgrade 동작 정의 포함.
- [ ] `models.py`/`schemas.py`: `Transaction` 컬럼·관계 추가, kind Literal에 "transfer" 확장(Category/Transaction 타입 분리 여부는 구현 재량), `TransactionCreate/Out`에 상대 계정 필드.
- [ ] `routers/transactions.py`: `_validate_refs`에 이체 검증(상대 계정 필수·존재·출금≠입금, 비이체는 상대 계정 금지), `_to_out`에 상대 계정 이름 포함.
- [ ] `routers/analytics.py`: 현재 잔액(`net_by_account`)과 월별 추이(`account_month_net`)에 transfer 입금 다리(+) 가산. 대시보드 집계는 무변경 확인.
- [ ] `excel_import.py`: (선택) 이체 스킵 사유 문구에 수동 이체 입력 안내 추가.
- [ ] `frontend/src/types.ts` + `stores/transactions.ts`: 타입·페이로드 확장.
- [ ] `TransactionsPage.tsx`: 폼(구분 '이체', 출금/입금 계정 UI, 검증, 편집 복원), 테이블 배지·금액 표시, 구분 필터.
- [ ] `TransactionCalendar.tsx`: 일별 합계에서 transfer 제외.
- [ ] 회귀 확인: 대시보드·예산·엑셀 업로드·자산 페이지.

## 미해결 질문

- **엑셀 이체 행 자동 변환은 범위 제외**로 확정 제안(데이터 근거 상기). 추후 "스킵된 이체 행을 검토해 수동 이체로 전환하는 UI"를 원하면 별도 작업으로.
- 이체 거래의 표시 형식(금액 색·부호, 출금→입금 계정 표기 방식)은 구현 재량 — 수입(초록 +)/지출(빨강 −)과 구별되는 중립 표현이면 충분.
- 이체 소분류 시드 구성(카드대금/내계좌이체/저축/투자/미분류)과 카테고리 설정 화면에서 transfer kind 생성 허용 여부는 구현 재량.
- transfer 거래가 존재하는 상태의 마이그레이션 downgrade 정책(차단 vs 데이터 삭제)은 구현 시 결정.
