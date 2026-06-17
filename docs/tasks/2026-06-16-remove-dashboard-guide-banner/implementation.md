# Implementation: 대시보드 안내 배너 제거 및 AI 리포트 최상단 배치

- 날짜: 2026-06-16
- 기반 명세: `docs/tasks/2026-06-16-remove-dashboard-guide-banner/research.md`

## 변경 파일
- `frontend/src/pages/DashboardPage.tsx` — 안내 배너 카드 JSX(🌟 + guideMessage) 제거, `guideMessage` 함수 제거, import에서 `monthPace` 제거

## 주요 결정
- 배너 카드 JSX만 제거하면 바로 아래 "🤖 AI 리포트" 카드가 헤더 다음 첫 카드로 올라온다(별도 위치 이동 불필요).
- 배너 전용으로만 쓰이던 `guideMessage` 함수와 그 함수에서만 쓰던 `monthPace` import를 함께 제거해 미사용 심볼/린트 오류를 방지.
- `budgetTotal`/`budgetSpent`는 예산 소진율 카드(`DashboardPage.tsx:166-167,170,247,263`)에서 계속 사용되므로 유지 — 제거 시 회귀 발생하므로 그대로 둠.
- research.md와 다르게 한 점 없음.

## 자체 검증 결과
- 실행 명령: `npm run lint` → 통과 (0 errors; 잔여 2 warnings는 기존 `TransactionsPage.tsx`, 본 변경과 무관)
- 실행 명령: `npm run build` (tsc -b && vite build) → 통과 (BUILD_OK)
- 실행 명령: `docker compose up -d --build frontend` → 통과 (최신 번들 재배포)
- 브라우저 확인(배너 부재·AI 리포트 최상단·375px)은 /qa 위임

## 성공 기준 자가 체크
- [x] AC-1: 안내 배너 카드 JSX를 제거해 🌟 메시지가 더 이상 렌더되지 않음. 브라우저 확인은 /qa 위임.
- [x] AC-2: 배너 제거로 헤더(`div` 월 네비) 다음 첫 카드가 "🤖 AI 리포트" 카드가 됨(소스 순서상 직후 배치). 브라우저 확인은 /qa 위임.
- [x] AC-3: `npm run build`·`npm run lint` 통과 — 미사용 guideMessage/monthPace로 인한 오류 없음.
- [x] AC-4: 예산 소진율·합계·트리맵·세부 다이얼로그 관련 코드는 미변경(budgetTotal/budgetSpent 유지). 브라우저 회귀 확인은 /qa 위임.
- [x] AC-5 (모바일): 고정 px 너비 도입 없이 카드 제거만 수행 — 레이아웃 영향 없음. 375px 실측은 /qa 위임.

## 보류/미완 항목
- 없음 (브라우저 E2E·375px 실측은 /qa 단계)
