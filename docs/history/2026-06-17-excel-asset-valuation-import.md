# 작업 이력: 엑셀(뱅샐현황) 업로드로 부동산·주식 평가액 자동 갱신

- **날짜**: 2026-06-17
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
뱅크샐러드 내보내기 파일의 첫 시트 "뱅샐현황" 재무현황 자산 표에서 부동산·주식(투자성 자산) 평가액을 읽어, 엑셀 업로드 확정 시 오늘 날짜의 자산 평가액(`AssetValuation`)으로 자동 반영한다. 그동안 계정마다 수동 입력하던 평가액 갱신을 업로드 한 번으로 처리한다.

## 변경 파일 목록
- `backend/app/excel_import.py` - `parse_valuations()` 추가: "뱅샐현황" 자산 표 헤더를 동적 탐지하고 항목(병합 셀)을 carry-forward 하여 부동산→`real_estate`/투자성 자산→`stock` 추출. 헤더 컬럼 순서 비정상 시 방어 처리.
- `backend/app/routers/transactions.py` - 업로드 미리보기/확정에 평가액 처리 추가. dedup·0원 신규 미생성·동명 비시세형 계정 제외 정책을 공유 헬퍼 `_effective_valuations`로 추출해 미리보기와 확정이 동일 집합·건수를 사용.
- `backend/app/schemas.py` - `ImportValuationRow` 추가, `ImportPreview.valuations`·`ImportResult.valuation_count` 필드 추가.
- `frontend/src/types.ts` - 위 스키마에 대응하는 타입 추가.
- `frontend/src/pages/TransactionsPage.tsx` - 미리보기에 반영될 평가 목록, 결과에 반영 건수 표시. 검토(이체)행이 없어도 평가액이 있으면 미리보기로 확인 후 확정.

## 상세 변경 내용
- 매칭 규칙: 엑셀 상품명과 같은 이름의 `stock`/`real_estate` 계정에만 매칭(동명의 비시세형 계정과는 충돌시키지 않음). 매칭 계정이 없으면 해당 유형으로 자동 생성하되 0원 신규 항목은 만들지 않는다(기존 계정이면 0으로 갱신).
- 평가일은 서버 `date.today()`이며 선택한 가져오기 월과 무관하게 자산 표 전체를 반영. `(account_id, date)` upsert로 재업로드 시 중복 없이 갱신.
- 상세: [docs/tasks/2026-06-16-excel-asset-valuation-import](../tasks/2026-06-16-excel-asset-valuation-import/) 참조 (research.md / implementation.md / qa-report.md — 최종 PASS).

## 테스트 방법
- 백엔드: `parse_valuations`에 참조 파일 바이트 투입 → real_estate 1 + stock 10 추출, 동산/총자산/순자산 제외 확인.
- API: `POST /transactions/import` 후 `GET /accounts/{id}/valuations`에 오늘 날짜 평가액, `GET /analytics/assets` 잔액=평가액·`valued_at`=오늘 확인. 동일 파일 재업로드 시 중복 없음.
- 프론트: `cd frontend && npm run build` 통과. 업로드 다이얼로그 미리보기 평가 목록·결과 건수 표시(모바일 375px mobile-safe 패턴).
