# Research: 자산 페이지 모바일 가로 스크롤 제거

- 날짜: 2026-06-12
- 요청 원문: 모바일로 볼때 자산 메뉴만 가로 스크롤이 생기는 문제가 있어

## 요약

자산 페이지의 가로 스크롤은 **ECharts canvas의 고정 px 폭 + `main` flex item의 `min-width:auto`** 조합이 만드는 레이아웃 데드락이다. `AppLayout.tsx:72`의 `<main className="flex-1 ...">`은 flex item이라 기본 `min-width:auto`가 적용되어 자식 콘텐츠의 min-content 폭 이하로 줄어들지 못한다. ECharts는 init 시점의 컨테이너 폭을 canvas와 래퍼 div에 **인라인 px**로 박아 넣으므로(`EChart.tsx:30,46`), 차트가 한 번 넓게 그려진 뒤 뷰포트가 좁아지면 `main`이 canvas 폭 이하로 수축하지 못해 문서 전체가 가로로 넘친다. 이때 컨테이너 자체가 줄어들지 않으니 `EChart.tsx:33`의 ResizeObserver도 영원히 발화하지 않아 자가 복구가 불가능하다.

브라우저 실측(375px iframe 시뮬레이션)으로 두 가지 발현 경로를 확인했다: ① 넓은 뷰포트에서 로드 후 좁은 뷰포트로 전환(DevTools 디바이스 모드 진입, 창 축소, 가로↔세로 회전)하면 800→375px 기준 **168px 가로 오버플로**(scrollWidth 524 vs clientWidth 356, canvas 460px 고착) 발생. ② 데스크톱에서 신규 로드 시에도 차트 init 이후 데이터 로드로 세로 스크롤바가 생기며 뷰포트가 좁아지면 같은 데드락으로 **15px 안팎의 가로 스크롤** 발생(800px 실측). 반면 현재 데이터 기준 375px **신규 로드**에서는 자산 페이지에 오버플로가 없었다(스크롤 폭 356 = 클라이언트 폭 356).

"자산 메뉴만" 보이는 이유: 대시보드도 같은 구조의 EChart를 쓰지만 현재 월(2026-06)에 지출 데이터가 없어 차트가 아예 렌더되지 않아 증상이 숨어 있다. 거래가 쌓이는 달에는 대시보드도 동일 잠재 결함이 드러난다. 수정은 페이지가 아니라 레이아웃 차원(`main`에 `min-w-0`)에서 해야 하며, 실측으로 이 한 줄이 가로 스크롤을 해소함(scrollWidth 524→356)을 검증했다.

## 관련 파일 및 근거

- `frontend/src/components/layout/AppLayout.tsx:72` — `<main className="flex-1 p-4 pb-20 md:ml-60 md:p-8">`. flex item에 `min-w-0`가 없어 `min-width:auto`로 자식 min-content 이하 수축 불가. **수정 지점**
- `frontend/src/components/charts/EChart.tsx:30` — `echarts.init(containerRef.current, 'dark')`. init 시점 컨테이너 폭이 canvas/래퍼에 인라인 px로 고정됨 (실측: 래퍼 div와 canvas에 `width: 460px` 인라인 스타일 확인)
- `frontend/src/components/charts/EChart.tsx:33-34` — `ResizeObserver(() => chart.resize())`가 컨테이너를 관찰하지만, 데드락 상태에서는 컨테이너 폭이 변하지 않아 발화 자체가 안 됨
- `frontend/src/pages/AssetsPage.tsx:337-344` — 월별 자산 추이 카드. `space-y-6` 블록 바로 아래 Card라 canvas min-content가 `main`까지 그대로 전파됨 (grid `minmax(0,1fr)` 같은 차단 장치 없음)
- `frontend/src/components/ui/card.tsx:15` — Card에 `overflow-hidden`이 이미 있어, `main`이 수축 가능해지면 일시적으로 큰 canvas는 클리핑으로 가려짐 (시각적 안전망)
- `frontend/src/pages/DashboardPage.tsx:270` — 대시보드 treemap도 동일 패턴. 현재는 데이터 없음(`이번 달 지출이 아직 없어요`)으로 차트 미렌더 → 증상 미발현일 뿐 동일 잠재 결함

## 영향도

- `AppLayout.tsx`의 `main`은 전체 5개 페이지의 공통 부모 — `min-w-0` 추가는 모든 페이지에 적용된다. 효과는 "min-content가 뷰포트를 밀어 가로 스크롤을 만들던 요소가 이제 부모 폭에 맞춰 수축(또는 내부 overflow 처리)됨"이며, 이는 의도된 방향이다. 데스크톱(≥768px)에서는 콘텐츠가 min-content보다 충분히 넓어 동작 변화 없음.
- 부수 발견: `min-w-0` 적용 시 페이지 가로 스크롤은 즉시 사라지지만, 이미 커져 있던 canvas는 ResizeObserver가 발화해 `chart.resize()`가 돌 때까지 Card의 `overflow-hidden`에 클리핑된다. 실제 브라우저(포그라운드 창)에서는 RO가 즉시 발화하므로 문제없을 것으로 예상하나, 본 조사는 백그라운드 창(rAF 스로틀)에서 수행되어 canvas 축소까지는 실측하지 못했다 — QA에서 실창 확인 필요.

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1 (모바일 AC): 375px 뷰포트에서 `/assets` 신규 로드 시 가로 스크롤·요소 겹침·잘림 없음 — 브라우저 도구로 375px 뷰포트에서 `document.documentElement.scrollWidth === clientWidth` 확인
- [ ] AC-2 (핵심 재현 시나리오): 넓은 뷰포트(≥1000px)에서 `/assets` 로드 후 375px로 축소했을 때 가로 스크롤이 없고, 차트 canvas 폭이 컨테이너 폭에 맞게 줄어든다 — 실제 브라우저 창 리사이즈 또는 DevTools 디바이스 모드 전환으로 `scrollWidth === clientWidth` 및 canvas `getBoundingClientRect().width ≤ 컨테이너 폭` 확인
- [ ] AC-3 (회귀 없음 — 데스크톱): 1280px 뷰포트에서 `/assets`·`/`(대시보드) 레이아웃이 기존과 동일(사이드바 + 본문, 차트 정상 폭) — 브라우저 도구로 육안 확인
- [ ] AC-4 (회귀 없음 — 빌드): `cd frontend && npm run build` 통과 — 명령 실행으로 확인
- [ ] AC-5 (범위 확장 — 전 페이지 모바일): 375px 뷰포트에서 `/`·`/transactions`·`/budgets`·`/settings` 신규 로드 시에도 페이지 레벨 가로 스크롤 없음(`scrollWidth === clientWidth`) — 브라우저 도구로 확인. 테이블 등 본질적으로 넓은 콘텐츠는 내부 `overflow-x-auto` 스크롤로 처리되어야 하며 `overflow:hidden` 클리핑으로 잘려서는 안 됨
- [ ] AC-6 (범위 확장 — transactions 헤더): 375px에서 지출/수입 내역 페이지의 제목·필터·뷰 전환·업로드·추가 버튼이 모두 화면 안에 보이고 조작 가능 — 브라우저 도구로 육안 확인

> 범위 확장 메모 (2026-06-12, /implement 단계): 조사에서 발견된 `/transactions`·`/budgets`·`/settings`의 별도 가로 오버플로를 이번 작업에 포함하기로 사용자가 결정함 (AskUserQuestion 답변: "다른 페이지도 포함"). AC-5·AC-6은 이에 따라 추가된 계약.

## Action Items

- [ ] `AppLayout.tsx:72`의 `main`에 `min-w-0` 클래스 추가 (flex item의 자동 최소 폭 해제 — 실측으로 효과 검증된 변경)
- [ ] (구현 재량) `EChart` 컴포넌트 차원의 방어를 함께 둘지 판단 — 예: 컨테이너에 `min-w-0`/`max-w-full` 보강. 단, min-content 전파 차단의 본질 수정은 `main`의 `min-w-0`이며 EChart 측 변경만으로는 해결되지 않음에 유의
- [ ] QA: AC-2를 실제 포그라운드 브라우저 창에서 수행 (본 조사는 rAF 스로틀 환경이라 ResizeObserver 발화→canvas 축소를 직접 실측하지 못함)

## 미해결 질문

(모두 해소됨 — 2026-06-12 /implement 단계에서 AskUserQuestion으로 확인)

- ~~**사용자의 정확한 재현 환경**~~ → **창 축소/회전**으로 확인됨. 실측 재현된 경로 ①(뷰포트 축소 데드락)과 일치하며 `main min-w-0` 수정이 정확히 이 경로를 해소한다.
- ~~**별도 결함 처리 여부**~~ → **이번 작업에 포함**으로 결정됨 (AC-5·AC-6 추가).
