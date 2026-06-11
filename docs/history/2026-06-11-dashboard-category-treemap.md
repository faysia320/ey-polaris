# 작업 이력: 대시보드 카테고리별 지출 트리맵 차트 전환

- **날짜**: 2026-06-11
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

대시보드 "카테고리별 지출" 카드의 도넛(pie) 차트를 ECharts 트리맵으로 교체. 대분류별 지출 금액이 사각형 면적 비중으로 표시되며, 라벨(대분류명+원화 금액)·툴팁·빈 상태 메시지를 유지하고 단일 레벨 데이터에 맞춰 줌/드릴다운·브레드크럼을 비활성화했다. 기존 `expense_by_category` API 응답을 그대로 사용하므로 백엔드 변경 없음.

## 변경 파일 목록

- `frontend/src/pages/DashboardPage.tsx` - `donutOption`(pie)을 `treemapOption`(treemap)으로 교체

## 상세 변경 내용

- 구현 중 `width/height: '100%'` 배치가 트리맵 박스를 캔버스에서 오프셋시켜 우측·하단 노드가 잘리는 버그를 발견, `left/top/right/bottom: 0` 명시로 해결.
- 최초 요청은 "히트맵"이었으나 사용자가 트리맵으로 정정 — 초기 조사(docs/tasks/2026-06-11-dashboard-category-heatmap/)는 트리맵 명세로 대체됨.
- 상세: [docs/tasks/2026-06-11-dashboard-category-treemap](../tasks/2026-06-11-dashboard-category-treemap/) 참조 (research / implementation / qa-report, QA 판정 PASS — AC 7/7)

## 테스트 방법

- frontend에서 `npm run lint`, `npm run build` 통과 확인
- 브라우저에서 거래가 있는 월(2026-04, 2026-05)과 없는 월(2026-06)을 오가며 트리맵 렌더링·툴팁·클릭 무동작·빈 상태·월 이동 갱신 확인
