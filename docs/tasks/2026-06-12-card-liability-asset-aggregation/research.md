# Research: 카드 마이너스 잔액의 자산 집계 방식과 카드대금 상환 처리

- 날짜: 2026-06-12
- 요청 원문: 자산상태를 보면 카드 사용금액에 따라 마이너스 금액이 찍혀 있는데 이건 부채도 자산의 개념으로 보고 집계하는건가? 그럼 카드값을 갚은것에 대해선 어떻게 처리가 돼?

## 요약

자산상태의 총자산은 **순자산(net asset) 개념**이다. 모든 계정의 잔액은 `개설잔액 + Σ(수입 − 지출)`로 계산되며(`backend/app/routers/analytics.py:21-26`, `analytics.py:164`), 카드 계정에는 지출 거래만 쌓이므로 잔액이 음수가 되고, 이 음수가 총자산 합계에 그대로 포함된다(`analytics.py:173,234`). 즉 카드 미결제 금액은 부채로서 총자산을 깎는 방식으로 집계된다.

카드값 상환(카드대금 출금)은 **현재 시스템에 표현 수단이 없다**. 거래 종류는 `income | expense` 둘뿐이고(`backend/app/models.py:74`), 이체(transfer) 타입은 1차 범위에서 의도적으로 제외되었다(`docs/tasks/2026-06-10-polaris-app-scaffold/research.md:125`). 뱅크샐러드 엑셀 업로드 시에도 "이체" 타입 행(카드대금 출금 포함)은 이중 계산 방지를 위해 전부 스킵한다(`backend/app/excel_import.py:4-5,112-113`).

이 설계의 수학적 결과: 카드값을 갚아도 은행 잔액은 줄지 않고 카드 잔액도 0으로 돌아오지 않지만, 두 왜곡이 정확히 상쇄되어 **전체 총자산(순자산)은 항상 올바르다**. 반면 **계정별 잔액은 시간이 갈수록 왜곡**된다 — 은행 계정은 누적 카드대금만큼 과대, 카드 계정은 같은 금액만큼 과소(음수 무한 증가). 이 왜곡은 유형별 소계(`frontend/src/pages/AssetsPage.tsx:286`)와 구성원 필터(`analytics.py:124` — 은행 소유자와 카드 소유자가 다르면 구성원별 총자산도 틀어짐)에 그대로 드러난다.

## 관련 파일 및 근거

- `backend/app/routers/analytics.py:21-26` — `_signed_amount()`: 수입 +, 지출 − 부호 부여. 카드 지출이 음수로 누적되는 출발점.
- `backend/app/routers/analytics.py:158-173` — 계정 잔액 = `opening_balance + 순증감`(164행), 음수 잔액도 `grand_total`(173행)에 그대로 합산.
- `backend/app/routers/analytics.py:232-237` — `total = sum(b.balance)`: 구성원 필터 적용 후에도 음수 포함 합산.
- `backend/app/routers/analytics.py:217-230` — 월별 자산 추이도 동일하게 카드 음수 잔액을 포함해 계산.
- `backend/app/models.py:74` — `kind: income | expense` 두 종류만 존재. 이체/상환 타입 없음.
- `backend/app/excel_import.py:4-5, 112-113` — 엑셀 업로드 시 "이체" 타입(카드대금 출금 포함) 스킵. 사유: 카드 지출과 카드대금 출금이 모두 기록돼 있어 둘 다 반영하면 이중 계산.
- `frontend/src/pages/AssetsPage.tsx:286` — 유형별 소계에 음수 잔액 포함.
- `frontend/src/pages/AssetsPage.tsx:308-311` — 음수 잔액은 빨간색(`text-rose-400`)으로 표시 — 음수를 정상 상태로 전제한 UI.
- `docs/tasks/2026-06-10-polaris-app-scaffold/research.md:125` — 이체 타입을 1차 범위에서 제외하고 추후 `kind` 확장으로 수용하기로 한 설계 결정 기록.
- `docs/tasks/2026-06-11-monthly-excel-import/research.md:29` — 실제 엑셀 데이터에서 이체 행 분포(카드대금 18건 등) 확인 및 스킵 결정 근거.

## 영향도

이번 단계는 질문에 대한 조사이며 코드 변경 요청이 아니므로 직접 영향 없음. 다만 후속으로 "이체(transfer) 거래" 를 도입할 경우 영향 범위는 다음과 같다:

- `backend/app/models.py` / `schemas.py` — `Transaction.kind` 확장 또는 별도 transfer 모델, 상대 계정(counter account) 필드 필요.
- `backend/app/routers/analytics.py` — `_signed_amount()` 및 대시보드 수입/지출 합계에서 이체를 제외하는 로직 필요 (이체가 수입/지출 통계를 오염시키면 안 됨).
- `backend/app/excel_import.py` — "이체" 스킵 규칙 중 카드대금 행을 이체 거래로 변환하는 분기.
- `frontend` 거래 입력 폼·거래 목록·자산 페이지 — 이체 입력 UI 및 표시.

## 성공 기준 (Acceptance Criteria)

이번 요청은 동작 변경이 아니라 동작 설명 요청이므로, AC는 "조사 결과가 코드 근거로 검증 가능한가"로 정의한다.

- [ ] AC-1: 카드 계정의 음수 잔액이 총자산에 합산됨(순자산 개념)을 코드로 확인할 수 있다 — `analytics.py:164,173,234`를 읽어 음수 제외 분기가 없음을 확인.
- [ ] AC-2: 카드값 상환을 기록할 거래 타입이 존재하지 않음을 확인할 수 있다 — `models.py:74`와 `schemas.py:46`에서 kind가 `income | expense` 뿐임을 확인.
- [ ] AC-3: 엑셀 업로드 시 카드대금 출금(이체 타입)이 스킵됨을 확인할 수 있다 — `excel_import.py:112-113` 및 업로드 결과의 스킵 사유("이체 거래는 지원하지 않습니다")로 확인.

## Action Items

이번 단계 산출물은 조사 보고이며 구현 작업은 없음. 사용자가 계정별 잔액 왜곡(은행 과대·카드 음수 누적)을 해소하길 원할 경우의 후속 방향만 기록한다:

- [ ] (선택, 사용자 결정 필요) `transfer` 거래 종류 도입 — 출금 계정·입금 계정을 갖고, 수입/지출 통계에는 포함되지 않으며 계정 잔액에만 반영. 스캐폴드 설계(`polaris-app-scaffold/research.md:125`)에서 이미 예고된 확장 경로.
- [ ] (선택) 엑셀 임포트의 "이체" 스킵 규칙을 transfer 변환으로 대체 — 카드대금/내계좌이체 행을 이체 거래로 적재.

## 미해결 질문

- 사용자가 현 동작(순자산은 정확, 계정별 잔액은 왜곡 누적)을 그대로 둘지, transfer 도입으로 계정별 잔액까지 정확하게 만들지는 사용자 결정 필요.
- transfer 도입 시 과거 데이터 소급 방법(이미 스킵된 카드대금 출금 행의 재업로드 여부)은 미확정.
