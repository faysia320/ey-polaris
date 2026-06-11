# QA Report: 대시보드 카테고리별 지출 트리맵 차트 전환

- 날짜: 2026-06-11
- 작업 폴더: docs/tasks/2026-06-11-dashboard-category-treemap
- 판정: PASS

> 평가자 주: 입력으로 지정된 폴더(`2026-06-11-dashboard-category-treemap`)의 research.md를 계약으로 사용. 동일 날짜의 `2026-06-11-dashboard-category-heatmap` 폴더는 research.md:6에 명시된 대로 본 명세로 대체된 구버전이므로 채점 기준에서 제외함. implementation.md의 자가 체크는 인용하지 않고 전 항목을 직접 재검증함.

## 성공 기준 채점

- ✅ AC-1: 트리맵 렌더링·면적 비례 — vite dev 서버(5173) + 백엔드(docker, 8000)로 브라우저에서 2026-04를 직접 열어 확인. API 응답(`GET /api/v1/analytics/dashboard?month=2026-04`)의 대분류 11종이 모두 사각형으로 표시되고, 최대 금액인 식비(11,653,527원, 전체 지출 20,157,295원의 약 58%)가 차트의 절반 이상을 차지하는 최대 면적으로 렌더링됨. 도넛(pie) 시리즈는 코드에서 제거됨(`frontend/src/pages/DashboardPage.tsx:40` `type: 'treemap'`).
- ✅ AC-2: 라벨·툴팁 — 각 사각형에 `대분류명\n금액` 라벨 표시(예: "여행/숙박 2,566,174원"). 호버 시 `formatKRW` 원화 포맷 툴팁 확인: 최대 노드("식비 11,653,527원")와 최소 노드("의료/건강 65,500원", 전체의 0.3%) 모두 직접 호버로 검증. (극소 사각형의 라벨 잘림은 Low 이슈로 기록 — 툴팁으로 식별 가능)
- ✅ AC-3: 클릭 무동작 — 식비 사각형을 실제 클릭한 전후 스크린샷 비교로 줌/드릴다운/레이아웃 변화 없음 확인. 브레드크럼 미표시. 코드상 `roam: false`, `nodeClick: false`, `breadcrumb: { show: false }` (DashboardPage.tsx:46-48).
- ✅ AC-4: 빈 상태 유지 — 지출 없는 2026-06(`expense_by_category: []`를 API로 직접 확인)에서 차트 대신 "이번 달 지출이 아직 없어요. 맑은 밤하늘이네요 🌌" 메시지 표시를 브라우저로 확인. 빈 상태 분기(DashboardPage.tsx:138)는 변경되지 않음.
- ✅ AC-5: 월 이동 갱신 — ◀/▶로 2026-06 → 05 → 04 → 05 → 06 왕복. 4월(식비 최대, 11종)과 5월(생활 2,373,165원 최대, 12종)의 트리맵이 서로 다른 데이터로 갱신되고, 6월 복귀 시 빈 상태로 정상 전환됨.
- ✅ AC-6: 백엔드 무변경 — `git status --porcelain` 결과 수정 파일은 `frontend/src/pages/DashboardPage.tsx` 1개뿐(나머지는 docs/tasks 신규 문서). diff 16+/7- 전부 프런트 차트 옵션 범위.
- ✅ AC-7: 빌드·린트 — `npm run lint` 통과(0 errors; TransactionsPage 기존 경고 2건은 본 변경과 무관한 파일), `npm run build`(tsc -b && vite build) 통과(888ms) — 직접 실행으로 확인.

## 검증 시나리오

- 정적: DashboardPage.tsx 전체(208행)·EChart.tsx·format.ts·research.md 참조 라인 교차 확인. EChart 래퍼의 `setOption(option, true)`(notMerge)로 pie→treemap 전환 시 잔여 옵션 오염 없음을 확인.
- `npm run lint` → 통과 (경고 2건은 TransactionsPage 기존 건)
- `npm run build` → 통과
- `curl /api/v1/analytics/dashboard?month=2026-04|05|06` → 4월 11종/5월 12종/6월 빈 배열 확인 (브라우저 검증의 기대값으로 사용)
- 브라우저(Chrome + vite dev): 6월 빈 상태 → 5월 트리맵 → 4월 트리맵 → 호버 툴팁(최대/최소 노드) → 클릭(줌 없음) → 6월 복귀. 콘솔 메시지 점검 — 앱/ECharts 에러 0건(검출된 EXCEPTION 6건은 "message channel closed" — 브라우저 확장 잡음으로 앱 코드와 무관).
- 정리: dev 서버 종료, `git status`로 검증 전후 작업 트리 무변경 확인.

## 발견 이슈

- [Low] `frontend/src/pages/DashboardPage.tsx:50-53` — 면적이 작은 사각형(예: 2026-04의 문화/여가 103,649원·의료/건강 65,500원)은 라벨이 "문"처럼 중간에서 잘리거나 아예 표시되지 않음(ECharts 기본 클리핑). 툴팁으로 식별 가능하므로 동작 결함은 아니나, `label.overflow: 'truncate'`(말줄임표) 또는 작은 노드 라벨 숨김(`label.show` 조건) 적용 시 더 깔끔함. 명세가 라벨 구성을 구현 재량으로 둔 점(research.md:45) 감안.
- [Low] `frontend/src/pages/DashboardPage.tsx:36,52` — 툴팁(valueFormatter)과 라벨 포매터에서 `formatKRW(Number(...))` 변환 로직이 중복됨. 사소한 중복으로 기능 영향 없음.

## 수정 Action Items

- 없음 (Low 2건은 선택적 개선 사항 — 강제하지 않음)

## 다음 단계

/git-commit 진행 가능. (선택: Low 2건을 후속 작업으로 누적 관리 중인 `docs/tasks/2026-06-11-qa-low-followups`류 폴더에 기록 가능)
