# Research: 대시보드 카테고리별 지출 트리맵 차트 전환

- 날짜: 2026-06-11
- 요청 원문: 트리맵이야 내가 히트맵이라고 잘못 이야기 했어 (이전 요청: "대시보드의 카테고리별 지출을 히트맵 차트로 변경해줘" — 사용자가 트리맵으로 정정)

> 이 문서는 `docs/tasks/2026-06-11-dashboard-category-heatmap/research.md`를 대체한다. 해당 문서의 미해결 질문(히트맵 vs 트리맵 해석)이 **트리맵**으로 확정되어, 백엔드 변경이 불필요한 단순한 명세로 재작성했다. 이전 폴더의 명세는 구현하지 않는다.

## 요약

대시보드의 "카테고리별 지출" 카드는 현재 ECharts 도넛(pie) 차트로, 백엔드가 대분류 단위로 집계한 `expense_by_category`(대분류명 + 월 합계 금액 목록)를 표시한다 (`frontend/src/pages/DashboardPage.tsx:33-49,123-137`, `backend/app/routers/analytics.py:44-54,101-104`). 트리맵은 항목별 (이름, 값) 1차원 데이터를 사각형 면적 비중으로 표현하므로 **기존 API 응답을 그대로 사용할 수 있어 백엔드 변경이 전혀 필요 없다**. 변경은 `DashboardPage.tsx`의 차트 옵션 1곳 — pie 시리즈를 treemap 시리즈로 교체 — 으로 국한된다. ECharts 6.1.0 전체 번들을 이미 `import * as echarts from 'echarts'`로 로드하므로 treemap에 추가 의존성도 없다 (`frontend/src/components/charts/EChart.tsx:2`, `frontend/package.json:17`).

## 관련 파일 및 근거

- `frontend/src/pages/DashboardPage.tsx:33-49` — 교체 대상인 도넛 차트 옵션(`donutOption`). `expense_by_category`를 `{name, value}` 배열로 매핑하는 구조는 treemap 시리즈에서도 동일하게 재사용 가능.
- `frontend/src/pages/DashboardPage.tsx:123-137` — "카테고리별 지출" 카드 렌더링부. 지출 데이터가 없으면 빈 상태 메시지("이번 달 지출이 아직 없어요. 맑은 밤하늘이네요 🌌")를 표시하는 분기(129행)는 그대로 유지해야 함.
- `frontend/src/components/charts/EChart.tsx:16-38` — 공용 ECharts 래퍼. `setOption(option, true)`(notMerge=true)로 옵션을 통째로 교체하므로 시리즈 타입 변경에 래퍼 수정 불필요. 다크 테마(`echarts.init(..., 'dark')`)로 초기화됨(22행) — treemap 라벨·테두리 색은 다크 배경에 맞춰야 함.
- `frontend/src/lib/format.ts` — `formatKRW`. 현재 도넛 툴팁에서 사용 중(`DashboardPage.tsx:36`)이며 트리맵 툴팁에도 동일하게 재사용.
- `backend/app/routers/analytics.py:44-54,101-104` — `expense_by_category` 생성부(대분류 group by, 금액 내림차순 정렬). **변경 없음** — 트리맵 입력으로 충분.
- `frontend/src/types.ts:75-79,88` — `CategoryAmount`, `Dashboard.expense_by_category` 타입. **변경 없음**.

## 영향도

- 변경 파일은 `frontend/src/pages/DashboardPage.tsx` 1개로 예상. `expense_by_category`의 코드 소비자는 이 파일뿐임을 grep으로 확인(그 외 매칭은 docs 문서).
- `EChart.tsx`는 notMerge 옵션 교체 방식이라 pie→treemap 전환에 따른 잔여 옵션 오염 위험 없음.
- 백엔드·스토어(`stores/analytics.ts`)·타입(`types.ts`) 변경 없음 — API 계약 그대로.
- 백엔드에 테스트 스위트 없음(backend/ 하위 tests 디렉터리 부재) — 검증은 프런트 빌드와 브라우저 확인으로 수행.

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: 대시보드 "카테고리별 지출" 카드가 도넛 대신 **트리맵**으로 렌더링되며, 각 사각형의 면적이 대분류별 지출 금액에 비례한다. 거래가 있는 월(예: 2026-04 — 가져오기 데이터 존재가 기존 구현 기록 `docs/tasks/2026-06-11-category-hierarchy-and-import/implementation.md:48`에 확인됨)을 브라우저에서 열어 확인.
- [ ] AC-2: 각 사각형에 대분류명이 라벨로 표시되고, 호버 툴팁에 `formatKRW` 형식(원화) 금액이 표시된다. 브라우저에서 호버로 확인.
- [ ] AC-3: 트리맵 노드 클릭 시 줌/드릴다운 동작이 발생하지 않거나 의미 없는 동작(단일 레벨 데이터의 확대 등)으로 사용자를 혼란시키지 않는다 — 단일 레벨 데이터이므로 줌·브레드크럼 비활성화 권장. 브라우저에서 사각형 클릭으로 확인.
- [ ] AC-4: 지출이 없는 월에서는 차트 대신 기존 빈 상태 메시지("이번 달 지출이 아직 없어요…")가 그대로 표시된다. 거래가 없는 월로 이동하여 확인.
- [ ] AC-5: 월 이동(◀/▶) 시 트리맵이 해당 월 데이터로 갱신된다. 브라우저에서 2개 이상의 월을 오가며 확인.
- [ ] AC-6: 백엔드 코드는 변경되지 않는다 — `git diff`(또는 `git status`)로 변경이 frontend에 국한됨을 확인.
- [ ] AC-7: frontend에서 `npm run build`(tsc 포함)와 `npm run lint`가 통과한다.

## Action Items

- [ ] `frontend/src/pages/DashboardPage.tsx`: `donutOption`을 트리맵 옵션으로 교체 — treemap 시리즈(`{name, value}` 데이터 매핑은 기존 그대로), 사각형 내 대분류명 라벨, `formatKRW` 툴팁, 단일 레벨에 맞는 줌/브레드크럼 비활성화, 다크 테마에 맞는 테두리·라벨 색. 변수명(`donutOption` → 의미에 맞게), 색상 팔레트, 금액·비중 라벨 추가 표시 여부는 구현 재량.
- [ ] 거래가 있는 월(2026-04 등)과 없는 월을 브라우저로 오가며 AC-1~5 확인.

## 미해결 질문

- 없음 — 이전 명세(heatmap 폴더)의 유일한 미해결 질문이었던 차트 해석이 트리맵으로 확정됨. 라벨 구성(이름만 vs 이름+금액)·색상은 구현 재량으로 남긴다.
