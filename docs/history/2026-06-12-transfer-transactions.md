# 작업 이력: 이체(transfer) 거래 도입 및 엑셀 업로드 이체 검토 흐름

- **날짜**: 2026-06-12
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

거래 종류에 `transfer`를 추가하여 카드대금 상환·내계좌이체·저축/투자 이동을 표현할 수 있게 했다. 이체는 출금 계정 −, 입금(상대) 계정 +로 잔액에 양다리 반영되며, 수입/지출 통계(대시보드·카테고리 집계·예산)에는 포함되지 않는다. 엑셀 업로드는 미리보기 → 행별 검토(수입/지출/이체/건너뛰기) → 확정의 2단계 흐름으로 확장했고, 내계좌이체 중 같은 날짜·같은 금액·반대 부호 쌍은 자동 페어링해 한 건의 이체로 병합한다.

## 변경 파일 목록

- `backend/alembic/versions/0006_transfer_transactions.py` - (신규) counter_account_id 컬럼 + 이체 카테고리 시드
- `backend/app/models.py` - Transaction.counter_account_id 컬럼·관계, kind 확장
- `backend/app/schemas.py` - CategoryKind "transfer", 상대 계정 필드, 임포트 미리보기/결정 스키마
- `backend/app/routers/transactions.py` - 이체 검증·직렬화, import/preview 신설, decisions 처리
- `backend/app/routers/analytics.py` - 잔액·월별 추이에 이체 입금 다리(+) 가산
- `backend/app/excel_import.py` - "이체" 행 스킵 → 검토 대상 분리 반환, 내계좌이체 자동 페어링
- `frontend/src/types.ts`, `frontend/src/lib/format.ts` - transfer 타입·라벨
- `frontend/src/pages/TransactionsPage.tsx` - 이체 폼·표기·필터, 업로드 검토 흐름 UI
- `frontend/src/pages/SettingsPage.tsx` - 카테고리 kind '이체' 지원
- `frontend/src/components/transactions/TransactionCalendar.tsx` - 일별 합계에서 transfer 제외

## 상세 변경 내용

상세: [docs/tasks/2026-06-12-transfer-transactions](../tasks/2026-06-12-transfer-transactions/) (기본 명세), [docs/tasks/2026-06-12-import-transfer-review](../tasks/2026-06-12-import-transfer-review/) (검토 흐름 명세 + implementation.md), [docs/tasks/2026-06-12-card-liability-asset-aggregation](../tasks/2026-06-12-card-liability-asset-aggregation/) (선행 분석: 카드 음수 잔액 집계 문제) 참조.

## 테스트 방법

- `docker compose up -d --build` 후 alembic 0006 적용, `GET /categories`에서 이체 카테고리 5종 확인
- 거래 페이지에서 구분 '이체'로 수동 등록 → 자산 페이지에서 출금/입금 계정 잔액 양다리 반영, 대시보드 수입/지출 불변 확인
- 엑셀 업로드 → 미리보기에서 이체 행 검토 목록·자동 페어 표시 → 행별 결정 후 확정
- 자체 검증 기록: py_compile·`npm run build`·`npm run lint` 통과, 수동 API 검증 18/18 PASS (implementation.md 참조)
