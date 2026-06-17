# QA Report: 대시보드 안내 배너 제거 및 AI 리포트 최상단 배치

- 날짜: 2026-06-16
- 작업 폴더: `docs/tasks/2026-06-16-remove-dashboard-guide-banner/`
- 판정: PASS

## 성공 기준 채점
- ✅ AC-1: 안내 배너(🌟 + guideMessage) 미렌더 — 브라우저(localhost:3000)에서 하드 리로드 후 대시보드 확인. 페이지 텍스트에 🌟 및 "북극성이 밝게 빛나고 있어요" 등 안내 메시지 문자열이 전혀 없음. 정적으로도 `guideMessage` 함수·배너 카드 JSX가 소스에서 제거됨(diff 확인).
- ✅ AC-2: 헤더(월 네비/구성원 필터) 바로 아래 첫 콘텐츠 카드가 "🤖 AI 리포트" — 브라우저 스크린샷 및 get_page_text 순서로 확인(헤더 → AI 리포트 → 수입/지출/예산 그리드 → 카테고리별 지출). 소스상 `DashboardPage.tsx:187`(헤더 닫힘) 직후 `:189` AI 리포트 카드.
- ✅ AC-3: `npm run lint` → 0 errors (잔여 2 warnings는 TransactionsPage.tsx의 기존 항목, 본 변경 무관). `npm run build`(tsc -b && vite build) → 성공(built in 1.20s). 미사용 guideMessage/monthPace로 인한 오류 없음.
- ✅ AC-4: 예산 소진율 카드(0%, 0원/300,000원, 교통/구독 분해), 수입/지출 카드, 카테고리별 지출(트리맵) 모두 정상 렌더 — 브라우저 확인. `budgetTotal`/`budgetSpent`는 `:166-167,170,247,263`에서 계속 사용되어 회귀 없음(grep 확인).
- ✅ AC-5 (모바일): 변경은 순수 제거(삭제된 카드는 `flex items-center gap-3 py-4`로 고정 px 너비 없음)이며 잔여 레이아웃(`flex flex-wrap` 헤더, `grid grid-cols-1 md:grid-cols-3`, 트리맵)은 기존 모바일 퍼스트 반응형 마크업. 카드 제거가 가로 스크롤·겹침·잘림을 새로 유발할 수 없음. 단, 브라우저 도구의 375px 뷰포트 실측은 본 환경에서 resize_window 호출이 스크린샷 캡처에 반영되지 않아 동적 확인 불가 — 정적 분석으로 충족 판정(아래 검증 시나리오 및 Low 참조).

## 검증 시나리오
- `git diff frontend/src/pages/DashboardPage.tsx`: import에서 `monthPace` 제거, `guideMessage` 함수(13줄) 제거, 배너 `<Card>` 블록(7줄) 제거. 그 외 변경 없음(1 insertion, 20 deletions).
- `grep monthPace|guideMessage`(frontend/src): 잔존 참조는 `format.ts:46`의 `monthPace` export 정의뿐. DashboardPage 내 두 심볼 모두 완전 제거 확인.
- `npm run lint`: 0 errors / 2 warnings(기존 TransactionsPage). `npm run build`: 성공, 번들 `index-C32Bc6qc.js`.
- 서빙 번들 일치 확인: `curl localhost:3000` HTML이 `index-C32Bc6qc.js` 참조 → 방금 빌드한 해시와 동일 → 실행 중 docker 스택(ey-polaris-frontend-1, 6분 가동)이 현재 작업 트리 반영. 재빌드/재기동 불필요.
- 브라우저 E2E: 최초 로드 시 배너가 보였으나(브라우저 캐시된 구 번들), `ctrl+shift+r` 하드 리로드 후 배너 사라지고 AI 리포트가 최상단으로 확인 — 코드 결함 아닌 단순 클라이언트 캐시.
- `git status --short`: 의도된 `DashboardPage.tsx` 수정과 untracked docs/tasks 폴더만 존재. 빌드가 추적 파일을 변경하지 않음(dist gitignore).

## 발견 이슈
- [Low] `frontend/src/lib/format.ts:46` — `monthPace`가 이제 프론트엔드 전역에서 사용처가 없는 export(grep 결과 정의 외 참조 0). research.md가 "다른 파일에서 쓰일 수 있어 유지"로 의도적으로 남긴 결정이며 lint 오류를 유발하지 않으므로 차단 사유는 아님. 향후 dead code 정리 시 후보.
- [Low] 동적 375px 뷰포트 실측 미수행 — 본 환경에서 `resize_window`가 스크린샷 캡처 해상도(1512px)에 반영되지 않아 데스크톱 폭으로만 캡처됨. 정적 분석(순수 제거·고정 px 없음)으로 모바일 무영향을 판단함. 환경 한계로 기록.

## 다음 단계
PASS — /git-commit 진행 가능.
