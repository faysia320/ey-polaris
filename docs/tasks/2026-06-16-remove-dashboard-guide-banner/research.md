# Research: 대시보드 안내 배너 제거 및 AI 리포트 최상단 배치

- 날짜: 2026-06-16
- 요청 원문: 대시보드 최상단에 "정상 궤도를 유지하고 있어요 🛰️" 이 섹션을 제거해줘. AI 리포트가 이제 가장 위로 오면 돼

## 요약
대시보드 상단에는 예산 소진 상태에 따라 메시지를 보여주는 안내 배너 카드(🌟 + `guideMessage(...)`)가 있고(`DashboardPage.tsx:201-206`), 그 아래에 AI 리포트 카드(`DashboardPage.tsx:208-237`)가 있다. 요청은 이 안내 배너 카드를 제거하고 AI 리포트 카드가 헤더(월 네비게이션) 바로 아래 최상단에 오도록 하는 것이다. 배너 카드 JSX만 제거하면 AI 리포트 카드가 자연히 맨 위로 올라온다. 배너 전용으로만 쓰이는 `guideMessage` 함수(`:51-61`)와 그 함수에서만 사용하는 `monthPace` import(`:19`, 사용처는 `:56`뿐)도 함께 제거해 미사용 코드/린트 오류를 방지한다. `budgetTotal`/`budgetSpent`는 예산 소진율 카드에서 계속 쓰이므로 유지한다.

## 관련 파일 및 근거
- `frontend/src/pages/DashboardPage.tsx:201-206` — 제거 대상인 안내 배너 카드 JSX (🌟 + `guideMessage(budgetTotal, budgetSpent, month)`).
- `frontend/src/pages/DashboardPage.tsx:208-237` — AI 리포트 카드. 배너 제거 후 헤더(`:199`) 바로 아래 최상단에 위치하게 된다.
- `frontend/src/pages/DashboardPage.tsx:51-61` — `guideMessage` 함수. 배너에서만 호출되므로(`:204`) 제거 대상.
- `frontend/src/pages/DashboardPage.tsx:19` — `monthPace` import. 파일 내 사용처는 `guideMessage`의 `:56`뿐(grep 확인) → 함수 제거 시 미사용이 되므로 import에서 제거.
- `frontend/src/pages/DashboardPage.tsx:184-187 부근` — `budgetTotal`/`budgetSpent` 산출. 예산 소진율 카드(하단)에서 계속 사용되므로 **유지**.

## 영향도
- `frontend/src/pages/DashboardPage.tsx` — 단일 파일 변경. 배너 카드·`guideMessage`·`monthPace` import 제거.
- `frontend/src/lib/format.ts` — `monthPace`는 export로 남으며 다른 파일에서 쓰일 수 있으므로 **변경하지 않음**(이 파일에서 import만 제거). 부작용 없음.
- 백엔드/타입/스토어 변경 없음 — UI 표면 변경만.

## 성공 기준 (Acceptance Criteria)
- [ ] AC-1: 대시보드에서 "정상 궤도를 유지하고 있어요 🛰️" 등 안내 배너 카드(🌟 메시지)가 더 이상 렌더되지 않는다 — /qa 단계에서 브라우저로 대시보드를 열어 해당 배너 부재 확인.
- [ ] AC-2: 헤더(월 이동/구성원 필터) 바로 아래 첫 번째 콘텐츠 카드가 "🤖 AI 리포트" 카드다 — /qa 단계에서 브라우저로 DOM 순서/시각 순서 확인.
- [ ] AC-3: `npm run build`(tsc+vite)와 `npm run lint`가 통과한다(미사용 `guideMessage`/`monthPace`로 인한 오류 없음) — 빌드/린트 실행으로 확인.
- [ ] AC-4: 예산 소진율 카드 등 나머지 대시보드 기능(수입/지출/예산/트리맵/세부 다이얼로그)은 회귀 없이 동작한다 — /qa 단계에서 브라우저로 확인.
- [ ] AC-5 (모바일): 375px 뷰포트에서 배너 제거 후에도 가로 스크롤·요소 겹침·잘림이 없고 AI 리포트 카드가 최상단에 정상 표시된다 — /qa 단계에서 브라우저 도구(375px)로 확인.

## Action Items
- [ ] `DashboardPage.tsx`에서 안내 배너 카드 JSX(`:201-206`) 제거.
- [ ] `DashboardPage.tsx`에서 `guideMessage` 함수(`:51-61`) 제거.
- [ ] `DashboardPage.tsx`의 import에서 `monthPace` 제거(`:19`). `addMonths`/`currentMonth`/`formatKRW`는 유지.
- [ ] `npm run build` 및 `npm run lint`로 미사용 심볼/타입 오류 없음 확인.

## 미해결 질문
- 없음 (단순 UI 제거. `guideMessage`/`monthPace`가 배너 전용임을 grep으로 확인했고, `budgetTotal`/`budgetSpent`는 예산 소진율 카드에서 계속 사용되어 유지).

---

작업 폴더: `docs/tasks/2026-06-16-remove-dashboard-guide-banner/`
