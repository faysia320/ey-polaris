# 작업 이력: 거래 묶기(연결) — 계좌 간 이체·카드 환불 쌍 연결 + 통계 상쇄

- **날짜**: 2026-07-24
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

이미 저장된 수입/지출 2건을 사후에 하나의 "묶음"으로 **연결**하는 기능을 추가했다. 원본 2건은 보존하고 연결 관계로만 표시하며, 수입/지출 통계에서 상쇄한다.

- **이체 묶음**: 서로 다른 계정 간 이동 — 두 건 모두 수입/지출 통계에서 제외
- **환불 묶음**: 카드 결제(지출) + 환불(수입) — 지출에서 환불액을 뺀 순지출만 통계에 반영(결제 월 앵커링으로 카드 익월 환불도 정확히 상쇄)
- 계정 잔액·자산 추이는 원본 income/expense가 이미 각 계정에 ±반영하므로 미변경

## 변경 파일 목록

- `backend/app/models.py` — `TransactionLink` 테이블 + `Transaction.link_id` FK(SET NULL) 추가
- `backend/alembic/versions/0010_transaction_links.py` — 신규 마이그레이션(transaction_links 테이블 + link_id 컬럼/FK/인덱스)
- `backend/app/schemas.py` — `LinkType`, `TransactionOut`에 link 필드, 묶기 요청/응답 스키마
- `backend/app/routers/transactions.py` — `POST /transactions/link`·`DELETE /transactions/link/{id}` 엔드포인트, 묶인 거래 삭제 시 링크 정리, `update` 시 묶음 제약 재검증(`_check_link_pair`)
- `backend/app/routers/analytics.py` — `_income_expense_stats` 헬퍼(묶음 상쇄), dashboard·`_month_stats` 공유
- `frontend/src/types.ts` — `LinkType`, `Transaction`에 link 필드
- `frontend/src/stores/transactions.ts` — `link`/`unlink` 액션
- `frontend/src/pages/TransactionsPage.tsx` — 행 선택·묶기 다이얼로그·묶음 배지·해제 버튼(테이블/모바일 카드/캘린더 상세)

## 상세 변경 내용

상세: [docs/tasks/2026-07-23-transaction-linking-transfer-refund](../tasks/2026-07-23-transaction-linking-transfer-refund/) 참조 (research / implementation / qa-report).

QA 판정 **PASS**(3회차 재검증, AC-1~9 전부 충족, High 0/Medium 0). 재작업으로 해소한 Medium 3건: 월을 넘는 환불 상쇄(결제 월 앵커링), 묶인 거래 삭제 시 링크 정리, 묶인 거래 수정 시 묶음 제약 재검증.

## 테스트 방법

- 목록에서 수입 1건 + 지출 1건 선택 → "묶기" → 유형(이체/환불) 선택 후 확정. 대시보드 수입/지출 수치가 상쇄되는지 확인.
- 묶음 해제 시 두 거래가 독립 복원되고 통계가 원상 복귀하는지 확인.
- 카드 결제(당월) + 환불(익월)을 환불로 묶으면 결제 월 지출이 순지출로 줄어드는지 확인.
- 375px 뷰포트에서 선택 UI·다이얼로그·묶음 배지가 가로 스크롤·겹침 없이 조작 가능한지 확인.
