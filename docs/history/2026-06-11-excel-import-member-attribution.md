# 작업 이력: 엑셀 업로드 거래에 선택 구성원 귀속

- **날짜**: 2026-06-11
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

엑셀 업로드 시 다이얼로그에서 선택한 구성원이 새 계정 소유자로만 쓰이고 거래에는 기록되지 않던 문제를 수정. 구성원별 엑셀 파일을 따로 업로드하는 워크플로를 전제로, 업로드되는 모든 거래를 선택 구성원 소유로 기록하고 같은 월 재업로드 교체 범위를 같은 구성원(+구성원 미지정 과거 잔재)으로 축소했다.

## 변경 파일 목록

- `backend/app/routers/transactions.py` - 가져오기 파라미터 `default_member_id`→`member_id` 개명, 모든 import 거래에 선택 구성원 저장, 재업로드 삭제 범위를 구성원 단위로 축소
- `frontend/src/pages/TransactionsPage.tsx` - 업로드 다이얼로그 라벨·도움말·에러 메시지를 새 동작에 맞게 갱신, 폼 필드명 변경

## 상세 변경 내용

상세: [docs/tasks/2026-06-11-excel-import-transaction-member](../tasks/2026-06-11-excel-import-transaction-member/) 참조 (research.md 부록에 개정 계약, QA 판정 PASS 6/6)

## 테스트 방법

- 컨테이너 내 sqlite in-memory 검증 스크립트: `Get-Content docs/tasks/2026-06-11-excel-import-transaction-member/verify.py -Raw | docker compose exec -T backend python -` → ALL PASS
- 수동: 거래 페이지 → 엑셀 업로드 → 구성원 선택 후 업로드 → 목록에서 모든 거래의 구성원이 선택값과 일치하는지, 다른 구성원으로 같은 월을 추가 업로드해도 기존 거래가 보존되는지 확인
