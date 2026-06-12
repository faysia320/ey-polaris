# 작업 이력: 모바일 뷰포트 가로 스크롤 제거 (자산 페이지 외 전 페이지)

- **날짜**: 2026-06-12
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

뷰포트 축소/회전 시 자산 페이지 등에서 발생하던 가로 스크롤 데드락을 제거했다. 원인은 ECharts canvas의 인라인 px 폭이 flex item의 `min-width:auto`를 통해 min-content로 전파되던 것 — `main`에 `min-w-0`, 차트 컨테이너에 `contain: inline-size` 이중 방어를 적용했다. 거래 페이지 헤더는 모바일 적층·줄바꿈으로 변경.

## 변경 파일 목록

- `frontend/src/components/layout/AppLayout.tsx` - `main`에 `min-w-0` (핵심 수정)
- `frontend/src/components/charts/EChart.tsx` - `contain: 'inline-size'` (컴포넌트 차원 이중 방어)
- `frontend/src/pages/TransactionsPage.tsx` - 헤더 모바일 퍼스트 적층 + 액션 `flex-wrap`

## 상세 변경 내용

상세: [docs/tasks/2026-06-12-assets-page-horizontal-scroll](../tasks/2026-06-12-assets-page-horizontal-scroll/) 참조 (research.md / implementation.md)

## 테스트 방법

- 375px 신규 로드 및 900→375px 축소에서 전 페이지(`/`, `/assets`, `/transactions`, `/budgets`, `/settings`) `scrollWidth === clientWidth` 확인
- 데스크톱 1280px 레이아웃·차트 폭 회귀 없음 확인 (구현 단계 실측 완료, /qa 미수행 상태)
