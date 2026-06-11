# Research: 대시보드 카테고리별 지출 히트맵 차트 전환

- 날짜: 2026-06-11
- 요청 원문: 대시보드의 카테고리별 지출을 히트맵 차트로 변경해줘

## 요약

대시보드의 "카테고리별 지출" 카드는 현재 ECharts 도넛(pie) 차트로, 백엔드가 대분류 단위로 집계한 `expense_by_category`(카테고리명 + 월 합계, 1차원)를 그대로 표시한다 (`frontend/src/pages/DashboardPage.tsx:33-49,123-137`, `backend/app/routers/analytics.py:44-54,101-104`). 히트맵은 2차원 격자(축 2개 + 색상 값)가 필요한데 현재 데이터는 1차원이므로, **대분류(y축) × 일(x축, 해당 월 1일~말일) 격자에 일별 지출 금액을 색 농도로 표현**하는 형태로 전환한다. 이를 위해 백엔드 대시보드 응답에 대분류×일 단위 지출 집계 필드를 추가하고(기존 `expense_by_category`는 행 정렬·빈 상태 판정용으로 유지 가능), 프론트는 도넛 옵션을 heatmap 시리즈 + visualMap 옵션으로 교체한다. ECharts 6.1.0 전체 번들을 이미 `import * as echarts from 'echarts'`로 로드하므로 heatmap/visualMap에 추가 의존성은 필요 없다 (`frontend/src/components/charts/EChart.tsx:2`, `frontend/package.json:17`).

## 관련 파일 및 근거

- `frontend/src/pages/DashboardPage.tsx:33-49` — 교체 대상인 도넛 차트 옵션(`donutOption`). `expense_by_category`를 pie 시리즈 데이터로 매핑.
- `frontend/src/pages/DashboardPage.tsx:123-137` — "카테고리별 지출" 카드 렌더링부. 데이터 없으면 빈 상태 메시지("맑은 밤하늘…") 표시 — 이 빈 상태 분기는 유지해야 함.
- `frontend/src/components/charts/EChart.tsx:16-38` — 공용 ECharts 래퍼. `setOption(option, true)`(notMerge)로 옵션 전체 교체 방식이므로 시리즈 타입 변경에 추가 수정 불필요.
- `backend/app/routers/analytics.py:44-54` — 현재 대분류 단위 월 합계 쿼리(`group_by(Category.major)`). 히트맵용으로는 `Transaction.date`(또는 일)까지 group by에 추가한 별도 집계가 필요.
- `backend/app/routers/analytics.py:94-106` — `DashboardOut` 응답 조립부. 새 히트맵 필드를 여기에 추가.
- `backend/app/schemas.py:142-163` — `CategoryAmount`, `DashboardOut` 스키마. 히트맵용 행 스키마(대분류명 + 날짜/일 + 금액)와 `DashboardOut` 필드 추가 지점.
- `frontend/src/types.ts:75-90` — `CategoryAmount`, `Dashboard` 타입. 백엔드 스키마 변경을 추종해야 함.
- `frontend/src/stores/analytics.ts:17-20` — `fetchDashboard`가 `Dashboard` 타입으로 GET `/analytics/dashboard?month=` 호출. 필드 추가만이면 로직 변경 불필요.
- `frontend/src/lib/format.ts` — `formatKRW` 등 포맷 유틸. 히트맵 툴팁 금액 표시에 재사용.
- `backend/app/models.py:35-58` — `Category.major`(대분류) 컬럼. 집계 기준.

## 영향도

- `expense_by_category`의 코드 소비자는 `DashboardPage.tsx`(34, 129행)뿐이다 (grep으로 확인 — 그 외 매칭은 docs 문서). 새 필드를 **추가**하는 방식이면 기존 계약 파괴 없음.
- `DashboardOut`/`Dashboard` 타입에 필드를 추가하면 `stores/analytics.ts`는 타입만 통과하면 되고 로직 변경 없음.
- `EChart.tsx`는 옵션을 통째로 교체(notMerge)하므로 pie→heatmap 전환에 따른 잔여 옵션 오염 위험 없음.
- 백엔드에 테스트 스위트 없음(`backend/` 하위에 tests 디렉터리 부재) — 검증은 API 직접 호출과 프런트 빌드/브라우저 확인으로 수행.

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: `GET /analytics/dashboard?month=YYYY-MM` 응답에 대분류×일 단위 지출 집계 필드가 추가되어, 각 행이 (대분류명, 해당 월 내 날짜 또는 일, 양수 금액)을 담는다. 거래가 있는 월로 curl 호출하여 필드 존재와 값(거래 합계 일치)을 확인. 기존 필드(`expense_by_category` 등)는 그대로 유지된다.
- [ ] AC-2: 대시보드 "카테고리별 지출" 카드가 도넛 대신 히트맵으로 렌더링된다 — x축은 해당 월의 1일~말일(월 길이 28~31일 반영), y축은 지출이 있는 대분류, 셀 색 농도는 일별 지출 금액(visualMap)이다. 브라우저에서 거래가 있는 월을 열어 확인.
- [ ] AC-3: 히트맵 셀 호버 시 툴팁에 대분류·날짜와 함께 `formatKRW` 형식(₩ 원화) 금액이 표시된다. 브라우저에서 셀 호버로 확인.
- [ ] AC-4: 지출이 없는 월에서는 차트 대신 기존 빈 상태 메시지("이번 달 지출이 아직 없어요…")가 그대로 표시된다. 거래가 없는 월로 이동하여 확인.
- [ ] AC-5: 월 이동(◀/▶) 시 히트맵 데이터와 x축 일수가 해당 월에 맞게 갱신된다. 브라우저에서 2개 이상의 월을 오가며 확인.
- [ ] AC-6: `npm run build`(tsc 포함)와 `npm run lint`가 frontend에서 통과하고, 백엔드 앱이 import 오류 없이 기동된다(docker-compose 또는 uvicorn 기동 후 응답 확인).

## Action Items

- [ ] `backend/app/schemas.py`: 히트맵 행 스키마(대분류명·날짜(또는 일)·금액)를 신설하고 `DashboardOut`에 리스트 필드로 추가. (필드명·날짜 표현 형식은 구현 재량)
- [ ] `backend/app/routers/analytics.py`: dashboard 핸들러에 `Category.major` + 거래 일자 기준 지출 집계 쿼리를 추가하고 응답에 포함. 기존 대분류 월 합계 쿼리는 유지(행 정렬 기준으로 재사용 가능).
- [ ] `frontend/src/types.ts`: `Dashboard`에 새 필드 타입 추가.
- [ ] `frontend/src/pages/DashboardPage.tsx`: `donutOption`을 히트맵 옵션으로 교체 — grid/xAxis(1~말일)/yAxis(대분류, 월 합계 내림차순 정렬 권장)/visualMap(0~월 내 셀 최댓값)/heatmap 시리즈/`formatKRW` 툴팁. 빈 상태 분기와 카드 제목은 유지. 대분류 수에 따른 차트 높이 조정은 구현 재량.
- [ ] 거래가 있는 월(예: 2026-04 — 가져오기 데이터 존재가 기존 구현 기록에 확인됨)과 없는 월로 브라우저 확인.

## 미해결 질문

- "히트맵"의 해석: 본 명세는 **대분류×일 격자 히트맵**(ECharts `heatmap` 시리즈)으로 확정했다. 만약 사용자가 의도한 것이 금액 비중을 사각형 크기·색으로 보여주는 **트리맵(주식 시가총액 맵 스타일)**이라면 백엔드 변경 없이 기존 데이터로 ECharts `treemap` 시리즈만 적용하면 되므로, 구현 전 사용자 의도가 다르면 방향 전환이 필요하다.
- 무지출(데이터 없는) 셀의 표현(빈 칸 vs 0값 채움)과 visualMap 색상 팔레트는 구현 재량.
