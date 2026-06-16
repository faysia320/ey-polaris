# 작업 이력: 간편결제(easy_pay) 계정 유형 추가 및 연결 카드/계좌 기반 자산 집계 구분

- **날짜**: 2026-06-16
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

네이버페이/카카오페이/토스 같은 간편결제 서비스를 자산 계정의 `easy_pay` 유형으로 추가하고, 실제 결제가 빠지는 카드/은행 계정을 연결(`linked_account_id`)하도록 했다. 자산 집계는 **패스스루** 방식 — 간편결제 지출이 연결 계정 잔액에 귀속되고 간편결제 계정 자체는 잔액 0으로 수렴한다. 자산 상태 페이지의 연결 카드/은행 카드 안에서 '직접 사용 / 간편결제 채널별' 사용을 **부호 있는 '잔액 구성'**으로 분해해 보여주며, 분해 항목 합이 상단 잔액과 정확히 일치한다.

## 변경 파일 목록

- `backend/app/models.py` — `Account.linked_account_id` 자기참조 FK(RESTRICT)·relationship 추가
- `backend/app/schemas.py` — `AccountType`에 `easy_pay`, `AccountCreate.linked_account_id` + 유형↔연결 정합성 `model_validator`, `UsageSource`·`AccountBalance.usage_breakdown` 추가
- `backend/alembic/versions/0008_easy_pay_linked_account.py` — `accounts.linked_account_id` 컬럼·자기참조 FK 마이그레이션 (신규)
- `backend/app/routers/accounts.py` — 연결 계정 존재·유형(card|bank)·자기참조 DB 검증
- `backend/app/routers/analytics.py` — easy_pay 패스스루 라우팅, '잔액 구성' 분해(개설 잔액+직접+채널별+입금·이체) 산출
- `frontend/src/types.ts`, `frontend/src/stores/masterData.ts` — 타입·스토어에 `easy_pay`/`linked_account_id`/`usage_breakdown` 반영
- `frontend/src/pages/SettingsPage.tsx` — 간편결제 유형 + 연결 계정 Select(card|bank 필터)·검증·테이블 표시
- `frontend/src/pages/AssetsPage.tsx` — 간편결제 그룹 비노출, 연결 계정 카드 내 '잔액 구성' 분해 렌더

## 상세 변경 내용

상세: [docs/tasks/2026-06-16-easy-pay-account-linking](../tasks/2026-06-16-easy-pay-account-linking/) 참조 (research.md / implementation.md / qa-report.md).

주요 결정 한 가지: 분해는 QA 후 사용자 피드백을 반영해 '지출 합계(절대값)'에서 **부호 있는 '잔액 구성'**으로 변경했다 — 합이 상단 잔액과 일치하도록 `balance = 개설 잔액 + 직접 사용(net) + Σ 간편결제 채널(net) + 입금·이체(net)`로 구성한다.

## 테스트 방법

- `cd frontend && npm run build && npm run lint` 통과
- QA(qa-report.md PASS): alembic upgrade/downgrade, API 거부 케이스(422/404), easy_pay 지출 5만원 → 연결 카드 잔액 정확히 5만원 감소·간편결제 잔액 0·총합 보존, 브라우저로 설정 폼·자산 페이지 분해 확인
- 자산 상태 페이지에서 연결 카드의 '잔액 구성' 항목 합이 상단 잔액과 일치하는지 육안 확인
