# 작업 이력: 지출/수입 구분 뱃지 다크모드 가독성 개선 + 금액 컬럼 정렬·단위 정리

- **날짜**: 2026-07-23
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
거래 내역의 구분 뱃지(수입/지출/이체)가 다크 전용 테마(채도 0 회색조)에서 무채색 shadcn 변형끼리 구별되지 않던 문제를 개선. 뱃지를 금액 텍스트와 동일한 의미색(수입=emerald / 지출=rose / 이체=sky)의 은은한 틴트로 통일했다. 이어 사용자 요청으로 금액 테이블 컬럼을 우측 정렬하고 지출/수입 내역 금액에서 "원" 접미사를 제거했다.

## 변경 파일 목록
- `frontend/src/pages/TransactionsPage.tsx` — `KIND_BADGE_VARIANT`(무채색 변형)를 의미색 틴트 className 매핑 `KIND_BADGE_CLASS`로 교체(세 call site 일괄). 금액 컬럼 헤더·셀 우측 정렬, 지출/수입 내역 금액 3곳 `formatKRW→formatNumber`로 "원" 제거.

## 상세 변경 내용
- 뱃지: `bg-{color}-500/15 text-{color}-300 border-{color}-500/25` 틴트. 공용 `badge.tsx` 미수정(다른 사용처 무영향), base `variant="outline"` 유지로 형태 보존.
- 금액: 데스크톱 테이블 컬럼 우측 정렬(`w-full justify-end` + `block text-right tabular-nums`), 기존 `formatNumber`(단위 없는 천단위 포맷) 재사용으로 "원" 삭제. 부호·의미색·자산평가/엑셀 프리뷰 금액은 불변.
- 상세: [docs/tasks/2026-07-23-kind-badge-dark-readability](../tasks/2026-07-23-kind-badge-dark-readability/) 참조 (research / implementation / qa-report).

## 테스트 방법
- `cd frontend && npm run build` (tsc + vite) / `npm run lint` — 에러 0.
- 거래 내역 화면에서 수입/지출/이체 뱃지가 서로 다른 의미색으로 읽히는지, 금액 컬럼이 우측 정렬되고 "원"이 없는지 확인. 375px 모바일 뷰에서 뱃지 잘림·가로 스크롤 없음 확인.
