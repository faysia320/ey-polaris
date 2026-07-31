# 작업 이력: 간편결제 연결 계정 — 기준정보 선택화 + 거래별 지정

- **날짜**: 2026-07-31
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

간편결제(easy_pay) 계정의 연결 계정을 필수에서 **선택**으로 바꾸고, 거래 한 건마다 실제 결제된 카드/은행 계정을 지정할 수 있게 했다. 같은 간편결제라도 건마다 결제 수단이 다를 수 있어 계정에 고정할 수 없던 문제를 해결한다. 집계 라우팅 우선순위는 **건별 연결 > 계정 기본 연결 > 없음**이다.

## 변경 파일 목록

### 백엔드

- `backend/alembic/versions/0013_transaction_linked_account.py` - 신규. `transactions.linked_account_id` nullable FK(RESTRICT) 추가. 기존 행은 NULL이라 집계 결과는 종전과 동일
- `backend/app/models.py` - `Transaction.linked_account_id` FK와 `linked_account` relationship 추가
- `backend/app/schemas.py` - easy_pay의 연결 계정 필수 조건 제거, 거래 입출력에 `linked_account_id`/`linked_account_name` 추가
- `backend/app/routers/transactions.py` - 건별 연결 검증(계정이 easy_pay일 것·대상은 card|bank), 귀속 계정명 도출, 짝 다리 eager load 보강
- `backend/app/routers/accounts.py` - easy_pay → 다른 유형 변경 시 건별 연결이 달린 거래가 있으면 422 거부
- `backend/app/routers/analytics.py` - `_route()`로 라우팅 우선순위 구현. 현재 잔액·월별 추이 집계가 같은 규칙 공유

### 프론트엔드

- `frontend/src/types.ts`, `frontend/src/stores/masterData.ts` - 거래·계정 타입에 건별 연결 필드 추가
- `frontend/src/pages/SettingsPage.tsx` - 연결 계정 필수 검증 제거, "선택 안 함 (거래별 지정)" 옵션과 안내 문구 추가
- `frontend/src/pages/TransactionsPage.tsx` - 간편결제 계정 선택 시에만 "연결 계정 (선택)" 노출, 계정 표기를 공통 헬퍼로 통일(데스크톱 표·모바일 카드·캘린더 상세). 이체/환불 묶음 행과 묶음 보기 모달에도 최종 귀속 계정 표시
- `frontend/src/pages/AssetsPage.tsx` - 그룹 무조건 숨김을 "모든 계정 잔액이 0일 때만 숨김"으로 변경

## 상세 변경 내용

상세: [docs/tasks/2026-07-31-easy-pay-per-transaction-link](../tasks/2026-07-31-easy-pay-per-transaction-link/) 참조 (research.md / implementation.md / qa-report.md).

QA 판정 **PASS** (재QA 2회차 — 1회차 Medium 이슈 "묶음 행·이체 행에 최종 귀속 계정 미표시" 재작업 후 독립 재평가).

## 테스트 방법

1. `cd backend && alembic upgrade head` — `transactions.linked_account_id` 컬럼 추가 확인
2. 설정 → 자산 계정에서 간편결제 계정의 연결 계정을 "선택 안 함 (거래별 지정)"으로 저장
3. 거래 추가 시 해당 간편결제 계정을 고르면 "연결 계정 (선택)" 드롭다운이 나타나는지 확인 (후보는 활성 카드/은행)
4. 서로 다른 결제 계정을 지정한 거래 2건을 만들고 자산 페이지의 잔액·추이가 각각의 계정으로 라우팅되는지 확인
5. 건별 연결이 달린 거래가 있는 상태에서 해당 계정의 유형을 카드로 변경 → 422 거부 확인
