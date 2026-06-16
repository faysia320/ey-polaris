# Research: 간편결제(easy_pay) 계정 유형 추가 및 연결 카드/계좌 기반 자산 집계 구분

- 날짜: 2026-06-16
- 요청 원문: 자산에 보이는 네이버페이 간편결제, 카카오페 간편결제, 토스 간편결제 같은 간편결제 서비스들은 실제 자산이 사용된 카드나 계좌를 연결지어야해. 네이버페이로 결제되었지만 실제는 네이버 페이에 연결된 ALL 우리카드 Infinite가 사용된거거든. 자산 계정에 간편결제 유형을 추가해주고 간편결제 유형은 카드나 은행연결을 선택하게 해줘. 그리고 자산 집계에는 카드가 직접 사용된 건과 간편결제로 사용된건을 구분해서 그룹핑해서 볼 수 있게 해줘

## 요약

현재 자산 계정(`accounts`)은 `bank | cash | card | investment | stock | real_estate | other` 7종 유형만 가지며(`backend/app/schemas.py:25`, `backend/app/models.py:31`), 계정 간 연결 관계는 없다(이체용 `Transaction.counter_account_id` 외에는 자기참조 FK 부재 — `backend/app/models.py:84-97`). 자산 집계(`GET /analytics/assets`)는 거래의 `account_id`별 부호합으로 잔액을 계산하며(`backend/app/routers/analytics.py:102-115`), 결제수단 구분(직접/간편결제) 개념이 전혀 없다.

이 작업은 (1) `easy_pay`(간편결제) 유형을 추가하고, (2) 간편결제 계정이 **카드 또는 은행 계정 1개를 연결**(`linked_account_id` 자기참조 FK)하도록 하며, (3) **패스스루 잔액 모델**(사용자 확정) — 간편결제 계정으로 결제한 지출을 연결된 카드/계좌의 잔액·자산 집계에 합산하고 간편결제 계정 자체는 잔액 0으로 둔다, (4) 자산 상태(Assets) 페이지의 카드/계좌 그룹 안에서 **'직접 사용분'과 '간편결제(채널별) 사용분'을 분해해 표시**(사용자 확정)하는 것이 목표다.

핵심 데이터 모델 통찰: 결제수단 구분은 **거래(Transaction)가 아니라 계정(Account)에 귀속**된다 — 거래는 평소처럼 간편결제 계정을 `account_id`로 가리키고, "어느 실물 자산으로 빠졌는가"는 그 계정의 `linked_account_id`로 결정된다. 따라서 Transaction 스키마 변경 없이 Account 자기참조만으로 집계 분해가 가능하다.

## 관련 파일 및 근거

### 백엔드
- `backend/app/models.py:21-39` — `Account` ORM 모델. `type`은 `String(20)`, 자기참조 FK 없음. 여기에 `linked_account_id` 컬럼과 self relationship 추가 대상.
- `backend/app/models.py:84-97` — `Transaction.counter_account_id`가 이미 `accounts.id` 자기참조 FK(`ondelete="RESTRICT"`)로 존재 → 자기참조 FK + relationship 패턴의 기존 선례.
- `backend/app/schemas.py:25` — `AccountType = Literal[...]` 7종. `"easy_pay"` 추가 대상.
- `backend/app/schemas.py:28-42` — `AccountCreate / AccountUpdate / AccountOut`. `linked_account_id` 필드 + 유형↔연결 정합성 검증(model_validator) 추가 대상.
- `backend/app/routers/accounts.py:17-33` — 생성/수정 엔드포인트. 연결 계정 존재·유형(card|bank)·자기참조 금지 등 DB 의존 검증 추가 대상.
- `backend/app/routers/accounts.py:36-41` — 삭제. 간편결제가 참조 중인 카드/계좌 삭제 시 FK 동작 영향(아래 영향도 참조).
- `backend/app/routers/analytics.py:93-231` — `GET /analytics/assets`. `net_by_account`(102-115)와 월별 추이(164-181)에서 간편결제 계정의 net을 연결 계정으로 **리다이렉트**하고, 계정별 '직접/간편결제 채널별' 분해를 산출해 응답에 싣는 핵심 수정 대상.
- `backend/app/routers/analytics.py:20-29` — `_signed_amount()` 부호 표현식(재사용).
- `backend/app/schemas.py:178-198` — `AccountBalance` / `AssetsOut`. 분해 데이터를 담을 필드 추가 대상.
- `backend/alembic/versions/0007_budget_major_only.py` — 현재 최신 마이그레이션(head). 신규 마이그레이션은 `0008_*`로 `down_revision="0007"`.
- `backend/alembic/versions/0006_transfer_transactions.py` — `accounts` 자기참조 FK 추가 마이그레이션 선례(컬럼 추가 → `create_foreign_key`).
- `backend/app/excel_import.py:225-234` — `guess_account_type()`는 easy_pay를 추론하지 않음(영향 없음, 미해결 질문 참조).

### 프론트엔드
- `frontend/src/types.ts:1-8` — `AccountType` 유니온. `'easy_pay'` 추가 대상.
- `frontend/src/types.ts:19-27` — `Account` 인터페이스. `linked_account_id` 추가 대상.
- `frontend/src/types.ts:99-107` — `AccountBalance` 인터페이스. 분해 필드 추가 대상.
- `frontend/src/stores/masterData.ts:11-17` — `AccountInput`. `linked_account_id` 추가 대상.
- `frontend/src/pages/SettingsPage.tsx:35-43` — `ACCOUNT_TYPES` 라벨 목록. `easy_pay` 라벨('간편결제') 추가.
- `frontend/src/pages/SettingsPage.tsx:264-437` — `AccountsTab`. 유형 Select(371-384)에 간편결제 추가, 유형이 간편결제일 때만 **연결 계정 Select**(card|bank 계정으로 필터) 노출, 제출 검증(297-319), 테이블에 연결 계정 표시.
- `frontend/src/pages/AssetsPage.tsx:29-37` — `ACCOUNT_TYPE_LABEL`. easy_pay 처리(아래 AC 참조).
- `frontend/src/pages/AssetsPage.tsx:283-336` — 유형별 그룹 카드 렌더링. 카드/계좌 카드 안에 '직접/간편결제 분해' 표시 추가, easy_pay 계정의 독립 표시 처리.

## 영향도

- **잔액 계산 의미 변경(패스스루)**: `GET /analytics/assets`의 `net_by_account`·`account_month_net`·`grand_total`·`total`·`trend`가 모두 영향. 간편결제 계정의 거래 net을 연결 계정으로 옮기므로, 간편결제 계정 잔액은 `opening_balance`(통상 0)로 수렴하고 연결 카드/계좌 잔액이 증감한다. 기존 테스트/스냅샷이 있으면 재검증 필요.
- **계정 삭제 제약**: `linked_account_id`를 `ondelete="RESTRICT"`로 두면, 간편결제가 참조하는 카드/계좌는 삭제 시 409가 발생(기존 `commit_or_conflict` 패턴과 일관). 사용자는 간편결제 계정의 연결을 먼저 해제/삭제해야 함. → 삭제 에러 메시지 보강 검토.
- **계정명 유니크·소유자 검증**: 기존 로직 유지. 간편결제 계정도 `member_id` 필수(모델 제약 동일).
- **이체(transfer)와 간편결제**: 간편결제 계정이 이체의 `account_id`/`counter_account_id`로 쓰이는 경우는 비정상 사용으로 간주(결제수단이지 송금 대상이 아님). 패스스루 리다이렉트는 expense/income 기준으로 정의하되, transfer가 간편결제 계정을 가리키는 엣지 케이스의 처리 방향은 미해결 질문에 기록.
- **엑셀 가져오기**: `guess_account_type`은 easy_pay를 만들지 않으므로 가져오기 동작 불변(네이버페이류 자동계정은 여전히 `other`로 생성). 사용자가 수동으로 유형/연결을 교정하는 흐름 — 본 작업 범위 밖.
- **DashboardPage 지출 분석**: 이번 결정(자산 페이지에만 표시)에 따라 대시보드는 변경하지 않음 — 단, 패스스루로 인해 대시보드 지출 합계(`expense_total`, 대분류 집계)는 거래의 `kind`/`category` 기준이라 **영향 없음**(결제수단 무관). 확인만 하면 됨.

## 성공 기준 (Acceptance Criteria)

### 데이터 모델 / 마이그레이션
- [ ] AC-1: `accounts` 테이블에 `linked_account_id`(nullable, `accounts.id` 자기참조 FK) 컬럼이 추가된다 — `alembic upgrade head` 성공 후 `\d accounts`(또는 inspector)로 컬럼·FK 존재 확인. downgrade도 오류 없이 컬럼/FK를 제거한다.
- [ ] AC-2: `AccountType`에 `easy_pay`가 추가되어 백엔드(`schemas.py`)·프론트(`types.ts`) 양쪽 유니온에 존재한다 — 타입 정의 grep 및 `cd frontend && npm run build`(tsc) 통과로 확인.

### 백엔드 검증 계약
- [ ] AC-3: `type="easy_pay"`로 계정 생성 시 `linked_account_id`가 없으면 4xx 에러로 거부된다 — `POST /accounts`에 linked 없이 easy_pay 전송 시 에러 응답 확인(API 또는 단위 테스트).
- [ ] AC-4: `linked_account_id`가 가리키는 계정의 유형이 `card` 또는 `bank`가 아니면(또는 자기 자신을 가리키면, 또는 존재하지 않으면) 4xx로 거부된다 — 각 위반 케이스로 `POST /accounts` 호출 시 에러 확인.
- [ ] AC-5: `type`이 `easy_pay`가 아닌 계정에 `linked_account_id`를 넣으면 거부되거나 무시되어 저장되지 않는다(둘 중 어느 동작인지는 구현 재량, 단 일관) — non-easy_pay + linked_account_id 전송 시 결과를 `GET /accounts`로 확인.
- [ ] AC-6: 간편결제 계정에서 발생한 지출 거래의 금액이 **연결된 카드/계좌의 잔액**에 반영되고, 간편결제 계정 자체 잔액에는 반영되지 않는다 — 간편결제 계정 + 연결 카드 + 해당 간편결제 계정에 expense 거래 1건을 만든 뒤 `GET /analytics/assets`에서 연결 카드 잔액이 그 금액만큼 감소하고 간편결제 계정 잔액은 `opening_balance` 그대로임을 확인.
- [ ] AC-7: `grand_total`/`total`/`trend` 총합이 패스스루 전후로 보존된다(간편결제 지출이 이중 계상되거나 누락되지 않는다) — 동일 거래 집합에서 전체 자산 합이 "간편결제 계정을 일반 계정으로 봤을 때의 합"과 동일함을 확인(금액 이동만 발생, 총합 불변).

### 자산 집계 분해 (Assets API + UI)
- [ ] AC-8: `GET /analytics/assets` 응답이 카드/계좌별로 **직접 사용분과 간편결제(채널별) 사용분을 구분**할 수 있는 분해 데이터를 포함한다(필드명·구조는 구현 재량) — 연결 카드 1개 + 그 카드에 직접 거래 + 간편결제 경유 거래가 있을 때, 응답에서 두 출처의 금액이 각각 식별 가능함을 확인.
- [ ] AC-9: 자산 상태(Assets) 페이지에서 연결 카드/계좌 항목 아래에 '직접 사용 / 간편결제(예: 네이버페이) 사용'이 구분되어 표시된다 — 브라우저에서 해당 카드 그룹을 열어 분해 라인이 보이고 금액 합이 카드 잔액 기여분과 정합함을 **/qa 단계에서** 브라우저 도구로 확인.
- [ ] AC-10: 간편결제 계정이 자산 페이지에서 잔액 0짜리 별도 그룹으로 혼란스럽게 노출되지 않는다(연결 계정 하위 분해로 귀속되거나 별도 처리) — /qa 단계에서 자산 페이지 렌더링 확인.

### 설정 UI
- [ ] AC-11: 설정 > 자산 계정 탭에서 유형으로 '간편결제'를 선택하면 연결 계정 선택 UI가 나타나고, 선택 가능한 후보는 card/bank 계정으로 제한된다 — 브라우저에서 유형 전환 시 연결 Select 노출 및 후보 목록 확인(/qa 단계).
- [ ] AC-12: 연결 계정 미선택 상태로 간편결제 계정을 저장하려 하면 폼 검증 에러가 표시되고 제출되지 않는다 — /qa 단계 브라우저 확인.

### 빌드 / 모바일
- [ ] AC-13: `cd frontend && npm run build`와 `npm run lint`가 통과한다. 백엔드는 import/기동 오류가 없다.
- [ ] AC-14 (모바일): 375px 뷰포트에서 설정 자산 계정 다이얼로그(연결 계정 Select 포함)와 자산 상태 페이지 카드 그룹 분해 표시가 가로 스크롤·요소 겹침·잘림 없이 렌더링된다 — **/qa 단계에서** 브라우저 도구로 375px 확인.

## Action Items

### 백엔드
- [ ] `backend/app/models.py`: `Account`에 `linked_account_id: Mapped[int | None]`(자기참조 FK, `ondelete="RESTRICT"`)와 `linked_account` relationship 추가. `type` 주석에 easy_pay 반영.
- [ ] `backend/app/schemas.py`: `AccountType`에 `"easy_pay"` 추가. `AccountCreate`에 `linked_account_id: int | None = None` 추가 + `model_validator`로 "easy_pay면 linked 필수, 아니면 None" 규칙(DB 비의존) 강제. `AccountOut`에 `linked_account_id` 노출.
- [ ] `backend/alembic/versions/0008_easy_pay_linked_account.py` 신규: `linked_account_id` 컬럼 + 자기참조 FK 추가/제거(0006 패턴 참고, `down_revision="0007"`).
- [ ] `backend/app/routers/accounts.py`: create/update에서 DB 의존 검증 추가 — 연결 계정 존재(`get_or_404`), 유형이 card|bank, 자기참조 금지. 삭제 에러 메시지에 간편결제 연결 케이스 안내 보강(선택).
- [ ] `backend/app/routers/analytics.py`: easy_pay 계정의 net을 `linked_account_id`로 리다이렉트하는 매핑을 `net_by_account`·`account_month_net` 계산에 적용(패스스루). 계정별 '직접 vs 간편결제 채널별' 분해를 산출.
- [ ] `backend/app/schemas.py`: `AccountBalance`(또는 `AssetsOut`)에 분해 데이터 필드 추가(구조는 구현 재량 — 예: 계정별 `direct`/`via_easy_pay: [{name, amount}]`).

### 프론트엔드
- [ ] `frontend/src/types.ts`: `AccountType`에 `'easy_pay'`, `Account`에 `linked_account_id: number | null`, `AccountBalance`에 분해 필드 추가(백엔드 구조와 일치).
- [ ] `frontend/src/stores/masterData.ts`: `AccountInput`에 `linked_account_id` 추가.
- [ ] `frontend/src/pages/SettingsPage.tsx`: `ACCOUNT_TYPES`에 간편결제 추가. `AccountsTab`에 연결 계정 상태/Select(유형=easy_pay일 때만 노출, 후보=card|bank), 제출 검증, 테이블 연결 계정 표시. 유형 전환 시 linked 상태 정리.
- [ ] `frontend/src/pages/AssetsPage.tsx`: `ACCOUNT_TYPE_LABEL`에 easy_pay 라벨. 카드/계좌 카드 내부에 분해 라인 렌더링. easy_pay 계정의 독립 그룹 노출 억제(연결 계정 하위로 귀속).

## 미해결 질문

- transfer(이체) 거래가 간편결제 계정을 `account_id` 또는 `counter_account_id`로 가리키는 비정상 케이스의 패스스루 처리 방향(리다이렉트 포함 여부)은 명시 결정이 없다. 기본은 expense/income 중심 리다이렉트로 구현하고, transfer는 현행 동작 유지(또는 동일 리다이렉트)로 두되 /implement에서 단순·일관성을 우선해 결정한다. (간편결제 계정에 이체를 거는 사용은 권장되지 않음.)
- 분해 금액의 표시 단위 — '순증감(net, 부호 포함)' vs '지출 합계(절대값)' 중 무엇을 사용자에게 보여줄지는 구현 재량. 카드 잔액 기여분과의 정합(AC-9)을 만족하는 선에서 /implement가 직관적인 쪽(권장: 지출 합계)을 택한다.
- 엑셀 가져오기에서 네이버페이/토스류 계정을 easy_pay로 자동 분류·연결하는 것은 본 작업 범위 밖(사용자 수동 교정 전제).
