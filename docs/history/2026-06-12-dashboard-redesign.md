# 작업 이력: 대시보드 개편 — 카드 정리, 소진율 스택바, 트리맵 드릴다운·모바일 대응

- **날짜**: 2026-06-12
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

대시보드에서 "최근 거래"·"카테고리별 예산 진행" 카드를 삭제하고, 예산 소진율을 카테고리별 스택바(+범례)로 교체했다. "카테고리별 지출" 트리맵을 풀폭으로 전환하고 블록 클릭 시 해당 대분류의 거래 세부 내역을 Dialog로 표시한다(stale 응답 가드 포함). 트리맵 가독성을 ECharts 테마 빌더 dark 팔레트 + 휘도 기반 라벨색으로 개선했다. 진행 중 발견된 전역 레이아웃 문제(고정 사이드바의 모바일 압착)를 사용자 승인 하에 함께 해결 — 사이드바를 데스크톱(md+) 전용으로 전환하고 모바일 하단 내비게이션을 추가했다. 백엔드는 `recent_transactions` 응답 필드·쿼리를 제거했다.

## 변경 파일 목록

- `frontend/src/pages/DashboardPage.tsx` - 카드 2개 삭제, 풀폭 전환, 스택바, 드릴다운 Dialog, 팔레트·라벨색, 헤더 줄바꿈
- `frontend/src/components/charts/EChart.tsx` - 옵셔널 `onClick` prop 추가
- `frontend/src/components/layout/AppLayout.tsx` - 사이드바 md+ 전용 전환, 모바일 하단 내비 추가
- `frontend/src/types.ts` - `Dashboard.recent_transactions` 제거
- `backend/app/routers/analytics.py` - 최근 거래 쿼리·응답 조립 제거
- `backend/app/schemas.py` - `DashboardOut.recent_transactions` 제거

## 상세 변경 내용

상세: [docs/tasks/2026-06-12-dashboard-redesign](../tasks/2026-06-12-dashboard-redesign/) 참조 (research / implementation / qa-report, 3차 QA 판정 **PASS** — AC 11/11)

- QA 1차(CONDITIONAL): stale 응답 경합 가드, 에러 고착, 색상 일관성 지적 → 2차 수정 반영
- QA 2차(CONDITIONAL): 모바일 AC 계약 누락 지적 → AC-11 추가, AppLayout 모바일 대응(범위 확장 사용자 승인), 라벨 대비 임계 강화 → 3차 PASS

## 테스트 방법

- frontend `npm run lint`(0 errors), `npm run build` 통과
- 브라우저: 2026-05(거래 有)·2026-06(예산 有) 월에서 카드 구성·스택바·트리맵 클릭→Dialog(20건·합계 2,360,820원 = API 일치) 확인
- 모바일(375px): 가로 오버플로 없음(scrollWidth 360), 카드 1열 스택, Dialog 화면 내 표시, 하단 내비 동작 확인. 데스크톱(1528px) 회귀 없음
