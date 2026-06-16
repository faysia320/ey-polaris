# 작업 이력: 예산 설정 메뉴 개선 (전월 복사 · 빠른 금액 버튼 · 콤마 placeholder)

- **날짜**: 2026-06-16
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
예산 설정 메뉴에 세 가지 개선을 적용했다. (1) 상단 "전월 복사" 기능 — 직전 월 예산을 현재 월로 복사하며, 당월 기존 예산이 있으면 확인 후 삭제·덮어쓴다. (2) 변경 금액 입력란의 브라우저 기본 숫자 스피너를 제거하고 +100만원/+10만원/+5만원 누적 가산 버튼을 추가했다. (3) 현재 예산이 있는 행의 placeholder를 천단위 콤마 형식으로 표시한다.

## 변경 파일 목록
- `backend/app/schemas.py` - `BudgetCopy`(source_month/target_month) 스키마 추가
- `backend/app/routers/budgets.py` - `POST /budgets/copy` 엔드포인트 추가 (한 트랜잭션에서 source 조회→비면 422→target 기존 삭제→복제)
- `frontend/src/stores/budgets.ts` - `copyFromPrevMonth` 액션 추가
- `frontend/src/lib/format.ts` - 접미사 없는 천단위 콤마 포맷 `formatNumber` 추가
- `frontend/src/pages/BudgetsPage.tsx` - 전월 복사 버튼 + 확인 Dialog, 빠른 입력 버튼, 스피너 숨김 CSS, 콤마 placeholder

## 상세 변경 내용
상세: [docs/tasks/2026-06-16-budget-settings-improvements](../tasks/2026-06-16-budget-settings-improvements/) 참조 (research.md / implementation.md / qa-report.md)

주요 설계 결정:
- 전월 복사를 백엔드 엔드포인트로 처리해 `(year_month, major)` 유니크 충돌을 한 트랜잭션 내 "삭제 후 삽입"으로 원자적 회피
- 빈 전월은 target을 건드리지 않고 422 반환 → 당월 데이터 보존
- 당월 예산이 있을 때만 shadcn Dialog로 덮어쓰기 확인 (브라우저 confirm() 미사용)
- 스피너 제거는 `type="number"` 유지 + CSS로만 처리해 기존 정수 검증 로직 보존

## 테스트 방법
- frontend: `cd frontend && npm run build && npm run lint` (build 통과, lint 0 errors)
- backend: `python -m py_compile app/routers/budgets.py app/schemas.py`
- QA: CONDITIONAL PASS — AC-1~AC-7/AC-9 브라우저 E2E·라이브 API로 확인, AC-8(375px)은 동적 미확인이나 정적 신호상 충족. 상세는 qa-report.md 참조
