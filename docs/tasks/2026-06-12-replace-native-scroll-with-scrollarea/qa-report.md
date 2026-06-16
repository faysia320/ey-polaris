# QA Report: 앱 native scroll을 shadcn/ui ScrollArea로 교체

- 날짜: 2026-06-12
- 작업 폴더: docs/tasks/2026-06-12-replace-native-scroll-with-scrollarea
- 판정: PASS

## 평가 환경
- 채점 기준: 위 작업 폴더 `research.md`의 성공 기준 AC-1~AC-6
- 동적 검증: 현재 작업 트리를 반영하는 Vite dev 서버(`http://localhost:5173`)에서 수행. dev 서버가 서빙하는 `scroll-area.tsx` 소스가 작업 트리와 일치함을 curl로 확인(번들 stale 아님). docker 컨테이너(:3000)는 3일 전 정적 빌드라 변경 미반영이므로 사용하지 않음.
- 빌드/린트: `frontend`에서 직접 1회 실행
- 브라우저 E2E: claude-in-chrome으로 신규 탭 생성 후 수행, 검증 후 탭 정리. `git status`로 레포 무변경 확인 완료.

## 성공 기준 채점

- ✅ AC-1: `scroll-area.tsx` 신규 추가 확인(Read). `grep -rE "overflow-(x|y)-auto" frontend/src` 직접 실행 → `select.tsx:72` 1곳만 매치(의도된 제외). 앱 코드의 다른 native scroll 0건.
- ✅ AC-2: 1280px 뷰포트 `/transactions`(2026-05 데이터)에서 테이블 정상 렌더. 테이블 위에서 우측 가로 스크롤 시 가려져 있던 계정/구성원/메모 컬럼 및 수정·삭제 아이콘이 드러남(헤더·필터는 고정). ScrollArea 가로 스크롤 보존 확인.
- ✅ AC-3 (모바일 AC): 좁은 뷰포트에서 `/`·`/transactions`·`/budgets`·`/assets`·`/settings` 모두 시각적으로 페이지 레벨 가로 스크롤·요소 겹침·잘림 없음을 스크린샷으로 확인. 대시보드 카드 단일 컬럼 스택, 예산/설정 테이블이 폭 내 수렴, 하단 네비게이션 정상. 단, `scrollWidth === clientWidth` 수치 동일성은 JS 평가 도구 미가용으로 **수치 측정이 아닌 시각 확인**으로 갈음함(아래 이슈 참조).
- ✅ AC-4: 대시보드 카테고리 상세 다이얼로그(생활, 20건)를 열어 직접 검증 — `max-h-80` 제한 안에서 리스트가 세로 스크롤되며 ScrollArea 스크롤바 표시, 헤더 고정. 이는 `max-h-*`(고정 height 아님) Root + `size-full` Viewport 조합이 실제로 세로 스크롤되는지에 대한 핵심 우려를 해소함. 나머지 3곳(자산 평가 이력, 가져오기 건너뜀/이체 검토 목록)은 동일 ScrollArea + `max-h` + 내부 래퍼 패턴으로 diff상 구조 동일 → 코드 등가로 채택(엑셀 업로드·평가 입력 선행조건이 필요해 개별 미오픈, 동적 미확인 사실로 명시).
- ✅ AC-5: `git status`에 `select.tsx`·`AppLayout.tsx` 모두 미포함(무변경) 확인.
- ✅ AC-6: `npm run build`(tsc -b && vite build) → 통과(3421 모듈, chunk 경고는 기존 일반 경고). `npm run lint` → 0 errors, 2 warnings(`TransactionsPage.tsx:309·312` useMemo/useReactTable 기존 경고, 본 변경 무관). 직접 실행으로 확인.

## 검증 시나리오
- `grep -rE "overflow-(x|y)-auto" frontend/src` → `select.tsx:72` 단일 매치
- `npm run build` → built in 1.07s, 에러 0
- `npm run lint` → 0 errors / 2 pre-existing warnings
- radix `@radix-ui/react-scroll-area@1.2.11` 내부 Viewport가 `overflowX/Y: scroll/hidden` + 내부 div `display:table; minWidth:100%` 적용함을 dist에서 확인 → 가로 스크롤 메커니즘 근거
- 1280px /transactions: 테이블 가로 스크롤 동작 확인(컬럼·액션 아이콘 노출)
- 좁은 뷰포트 5개 페이지: 페이지 레벨 가로 오버플로 없음(시각)
- 대시보드 생활 카테고리 다이얼로그: 20건 리스트 세로 스크롤 동작 확인
- dev 서버 서빙 코드 == 작업 트리 일치 확인(curl), 검증 후 `git status` 무변경 확인

## 발견 이슈
- [Low] `research.md:50` (AC-3) — AC가 `document.documentElement.scrollWidth === clientWidth` 수치 동일성을 명시하나, 이 QA 환경에는 임의 JS 평가 도구(javascript_tool)가 로드되지 않아 수치로 단언하지 못하고 시각 확인으로 갈음함. 5개 페이지 모두에서 가로 스크롤바·잘림이 관찰되지 않았으므로 통과로 판정하되, 픽셀 단위 1px 오버플로는 시각으로 놓칠 여지가 이론상 존재함(동적 미확인 사실).
- [Low] AC-4 부분 — 세로 스크롤 목록 4곳 중 대시보드 1곳만 실제 데이터로 동적 확인. 나머지 3곳(자산 평가 이력, 가져오기 건너뜀/이체 검토 목록)은 선행조건(엑셀 업로드·평가 입력) 때문에 개별로 열지 않고, diff상 동일 ScrollArea+`max-h`+내부 래퍼 패턴이라는 코드 등가로 채택함.
- [Low] 작업 트리 범위 외 변경 혼입 — `frontend/src/pages/BudgetsPage.tsx`, `backend/app/schemas.py`, `docs/tasks/2026-06-12-budget-major-category/implementation.md`가 함께 변경되어 있으나 이는 별개 작업(budget-major-category)에 속하며 본 scroll-area 작업과 무관. `implementation.md` 변경 파일 목록에도 BudgetsPage가 없어 일관됨. 본 작업 AC에는 영향 없음(참고용 기록). BudgetsPage는 모바일에서 정상 렌더 확인.

## 다음 단계
PASS — /git-commit 진행 가능. (커밋 시 scroll-area 작업과 budget-major-category 작업의 변경이 작업 트리에 섞여 있으므로 커밋 분리 여부를 /git-commit에서 확인 권장.)
