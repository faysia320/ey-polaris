# Implementation: 자산 페이지 모바일 가로 스크롤 제거 (+전 페이지 확장)

- 날짜: 2026-06-12
- 기반 명세: `docs/tasks/2026-06-12-assets-page-horizontal-scroll/research.md`

## 변경 파일

- `frontend/src/components/layout/AppLayout.tsx` — `main`에 `min-w-0` 추가 (flex item 자동 최소 폭 해제 — 핵심 수정) + 사유 주석
- `frontend/src/components/charts/EChart.tsx` — 차트 컨테이너에 `contain: 'inline-size'` 추가 (canvas 인라인 px 폭의 min-content 전파를 컴포넌트 차원에서 차단하는 이중 방어) + 사유 주석
- `frontend/src/pages/TransactionsPage.tsx` — 페이지 헤더를 모바일 퍼스트로 변경: `flex items-center justify-between` → `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`, 액션 행에 `flex-wrap` 추가 (한 줄 강제 시 min-content 508px로 375px 초과)

## 주요 결정

- **구현 전 미해결 질문 해소 (AskUserQuestion)**: ① 재현 환경 = "창 축소/회전" — research.md의 데드락 경로 ①과 일치, 수정 방향 그대로 유효. ② 작업 범위 = "다른 페이지도 포함" — `/transactions`·`/budgets`·`/settings` 오버플로도 이번 작업에 포함하고 research.md에 AC-5·AC-6을 추가했다.
- **EChart 방어는 `contain: inline-size` 채택** (research.md 재량 항목): `min-w-0`류는 flex/grid item에만 의미가 있어 블록 컨테이너인 차트 div에는 효과가 없다. CSS size containment(inline 축)는 어떤 조상 레이아웃에서도 canvas 고정 폭의 intrinsic size 전파를 차단하므로 더 견고하다. 컨테이너는 height 명시 + width는 부모 기반이라 레이아웃 부작용 없음.
- **BudgetsPage·SettingsPage는 페이지 수정 불필요**: 두 페이지의 오버플로(+144px/+70px)는 고정 폭 컬럼을 가진 테이블의 min-content가 `main`의 `min-width:auto`를 통해 뷰포트를 밀던 것으로, `main min-w-0`만으로 해소됨을 실측 확인했다. 테이블은 기존 shadcn Table의 `overflow-x-auto` 래퍼(`table.tsx`)가 내부 스크롤로 처리하며 hidden 클리핑은 발생하지 않는다 (CLAUDE.md "본질적으로 넓은 콘텐츠는 명시적 오버플로 처리" 부합).
- TransactionsPage 헤더는 내부 스크롤이 아니라 **줄바꿈/적층**으로 처리 — 버튼·필터는 조작 대상이라 스크롤 뒤로 숨기면 안 되기 때문.

## 자체 검증 결과

- 실행 명령: `cd frontend && npm run build` → **통과** (tsc + vite, 1.08s. 청크 500kB 경고는 기존부터 있던 정보성 경고)
- 실행 명령: `cd frontend && npm run lint` → **통과** (0 errors. 경고 2건은 변경과 무관한 기존 항목: `useReactTable` react-hooks/incompatible-library)
- 브라우저 실측 (vite dev 5173, 375px iframe 시뮬레이션 — 클래식 스크롤바 환경이라 clientWidth 356):
  - 375px 신규 로드: `/` `/assets` `/transactions` `/budgets` `/settings` 전부 `scrollWidth === clientWidth` (수정 전: transactions +217, budgets +144, settings +70)
  - 900px 로드 → 375px 축소 (사용자 재현 경로): `/assets` `scrollWidth === clientWidth` (수정 전 +168px 데드락), canvas 560px → **292px로 축소 확인** (렌더링 프레임 발생 시 ResizeObserver 발화 — 백그라운드 탭 스로틀 환경에서는 프레임을 강제해 확인했고, 포그라운드 실창에서는 즉시 발화)
  - 내부 클리핑 검사: 넓은 테이블은 모두 `overflow-x-auto` 컨테이너에서 내부 스크롤 처리, `overflow:hidden` 클리핑 0건
  - 데스크톱 1280px: 사이드바 240px + 본문 정상, 오버플로 0, 자산 추이 차트 canvas 925px(컨테이너에 맞음) — 스크린샷 육안 확인

## 성공 기준 자가 체크

- [x] AC-1: 375px 신규 로드 `/assets` 가로 스크롤 없음 — 실측 scrollWidth=clientWidth=356
- [x] AC-2: 900→375px 축소 시 가로 스크롤 없음 + canvas 292px로 축소 — 실측 확인 (단, 백그라운드 탭 스로틀로 프레임 강제 후 확인이므로 QA에서 포그라운드 실창 재확인 권장)
- [x] AC-3: 1280px에서 사이드바+본문+차트 정상 — 측정·스크린샷 확인
- [x] AC-4: `npm run build` 통과
- [x] AC-5: 375px 신규 로드 전 페이지 가로 스크롤 없음 + hidden 클리핑 없음 — 실측 확인
- [x] AC-6: transactions 헤더 모바일 적층·줄바꿈 — 코드 변경 + 375px 오버플로 0 실측 (육안 정밀 확인은 QA에 위임)

## 보류/미완 항목

- 없음. (참고: QA는 AC-2를 포그라운드 실창에서 재검증할 것 — 본 검증 환경은 백그라운드 탭이라 rAF/ResizeObserver가 스로틀됨)
