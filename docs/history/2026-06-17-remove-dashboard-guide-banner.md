# 작업 이력: 대시보드 가이드 배너 제거

- **날짜**: 2026-06-17
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
대시보드 상단의 "북극성 가이드" 배너(예산 대비 지출 속도에 따른 안내 문구)를 제거한다. 관련 `guideMessage` 함수와 미사용이 된 `monthPace` import도 함께 정리한다.

## 변경 파일 목록
- `frontend/src/pages/DashboardPage.tsx` - 가이드 배너 카드 및 `guideMessage` 함수 제거, 미사용 `monthPace` import 제거.

## 상세 변경 내용
- 상세: [docs/tasks/2026-06-16-remove-dashboard-guide-banner](../tasks/2026-06-16-remove-dashboard-guide-banner/) 참조 (research.md / implementation.md / qa-report.md).

## 테스트 방법
- `cd frontend && npm run build` 통과(미사용 import 제거로 타입체크 정상).
