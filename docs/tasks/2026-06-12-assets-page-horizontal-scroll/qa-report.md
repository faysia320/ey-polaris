# QA Report: 자산 페이지 모바일 가로 스크롤 제거 (+전 페이지 확장)

- 날짜: 2026-06-12
- 작업 폴더: `docs/tasks/2026-06-12-assets-page-horizontal-scroll`
- 판정: PASS

평가 범위: 이 작업의 변경분은 `frontend/src/components/layout/AppLayout.tsx`(main에 `min-w-0`), `frontend/src/components/charts/EChart.tsx`(`contain: 'inline-size'`), `frontend/src/pages/TransactionsPage.tsx`(헤더 모바일 적층) 3개 파일이다. 워킹트리의 나머지 변경(backend, BudgetsPage, DashboardPage, stores/budgets, types 등)은 별도 작업 `2026-06-12-budget-major-category` 소속으로 본 평가 대상이 아니다.

검증 방법: 브라우저 자동화 패키지(playwright/puppeteer)가 없어, **Edge headless(`--headless=new`) + CDP(WebSocket, Node 24 내장)**로 직접 동적 검증을 수행했다. 대상은 수정 코드를 서빙 중인 vite dev 서버(localhost:5173, `/api`→backend:8000 프록시, 실데이터)이며, 서빙 코드에 `min-w-0`·`inline-size`·`flex-col gap-3 sm:flex-row`가 포함됨을 curl로 사전 확인했다. 검증 스크립트는 OS 임시 디렉터리에서 실행 후 삭제했고, 레포 파일은 일절 변경하지 않았다 (`git status`로 확인).

## 성공 기준 채점

- ✅ AC-1 (375px `/assets` 신규 로드): `Emulation.setDeviceMetricsOverride` 375×812로 신규 로드 후 측정 — `scrollWidth=375 === clientWidth=375` (오버플로 0), canvas 311px ≤ 컨테이너. 스크린샷 육안 확인에서도 겹침·잘림 없음 (하단 내비·카드 모두 정상)
- ✅ AC-2 (1000px 로드 → 375px 축소): 1000px 로드 시 canvas 649px → 375px로 축소 후 1.5초 대기 — `scrollWidth=375 === clientWidth=375`, **canvas 649→311px로 축소 확인** (ResizeObserver 발화 → `chart.resize()` 동작 실측). research.md가 QA에 위임한 핵심 시나리오를 headless 환경(rAF 정상 발화)에서 직접 검증함
- ✅ AC-3 (1280px 회귀 없음): `/assets` — 사이드바 visible·240px, main 1025px, canvas 929px(컨테이너 적합), 오버플로 0. `/` 대시보드 — 사이드바 정상, 오버플로 0. 스크린샷 육안 확인 정상. 단, "기존과 동일"의 수정 전후 픽셀 비교는 수행하지 않음(워킹트리 stash는 평가자 권한 밖) — 구조 측정값과 스크린샷으로 갈음
- ✅ AC-4 (빌드): `npm run build` 직접 실행 → 통과 (tsc + vite 1.05s. 500kB 청크 경고는 기존 정보성 경고)
- ✅ AC-5 (375px 전 페이지): `/` `/transactions` `/budgets` `/settings` 신규 로드 모두 `scrollWidth === clientWidth = 375`. 전체 DOM 스캔으로 내부 오버플로 요소의 `overflow-x` 검사 — 넓은 테이블(transactions·settings)은 `overflow-x-auto` 래퍼의 내부 스크롤로 처리, **hidden/clip 클리핑 0건**
- ✅ AC-6 (375px transactions 헤더): 제목·구성원 필터·테이블/캘린더 토글·엑셀 업로드·거래 추가 전부 bounding rect 측정 — 모두 `right ≤ 375`, `width > 0` (필터 right 144, 토글 230/306, 업로드 128, 추가 235). 2줄 적층(`flex-wrap`)으로 배치됨을 스크린샷 육안 확인. 클릭 차단 요소 없음

## 검증 시나리오

- 정적: 변경 3개 파일 전체 + 호출부 추적 (EChart 사용처 2곳 — `AssetsPage.tsx:342`, `DashboardPage.tsx:270` — 모두 CardContent 블록 컨텍스트 직계 자식이라 `contain: inline-size`의 intrinsic 폭 0 부작용 없음 확인. `min-w-0`는 5개 페이지 공통 main에 적용되나 AC-3/AC-5에서 회귀 없음 실측)
- `npm run build` → 통과 / `npm run lint` → 0 errors, 경고 2건(둘 다 `useReactTable` react-hooks/incompatible-library — 변경과 무관한 기존 항목)
- 동적 (Edge headless + CDP, vite dev 5173 실데이터):
  - 375px 신규 로드 5개 페이지 전부 오버플로 0
  - 1000→375px 축소 데드락 시나리오: 오버플로 0 + canvas 649→311px 축소 (수정 전 증상이던 "canvas 폭 고착"이 재현되지 않음)
  - 1280px 데스크톱 `/assets`·`/` 구조 측정 + 스크린샷
  - 전체 요소 스캔으로 hidden 클리핑 검사 (0건)
  - 헤더 컨트롤 6종 bounding rect 측정
- 시도했으나 이슈를 못 찾은 추가 케이스: EChart 사용처 전수 조사(intrinsic 폭 붕괴 여부), 모바일 하단 내비와 콘텐츠 겹침(pb-20으로 확보됨, 스크린샷 확인)
- 검증 한계: ① 대시보드 treemap은 현재 월(2026-06) 지출 데이터가 없어 차트 렌더 상태로는 미검증 — 단, 동일 EChart 컴포넌트 + 동일 레이아웃 경로가 `/assets`에서 데이터 포함으로 검증되었고, 수정이 레이아웃 차원(main `min-w-0`)이라 동일하게 적용됨. 검증 목적의 거래 데이터 생성은 사용자 DB 변조라 수행하지 않음. ② 실기기 회전(orientation change)은 headless에서 뷰포트 축소로 등가 검증함

## 발견 이슈

- [Low] `frontend/src/components/charts/EChart.tsx:48` — `contain: 'inline-size'`는 Safari 16+/Chrome 105+/Firefox 110+ 요구. 미지원 구형 브라우저에서는 이 2차 방어만 조용히 무력화됨 (1차 수정인 `min-w-0`는 영향 없으므로 기능 자체는 유지). 현 시점 지원 범위로는 문제 없음 — 기록 차원
- [Low] `frontend/src/pages/TransactionsPage.tsx:443-456` — 테이블/캘린더 토글 버튼 실측 높이 28px(`size="sm"`)로 일반적 터치 타깃 권장(≈44px)보다 작음. 기존 앱 전반의 컨벤션이며 이번 변경으로 도입된 것이 아니고, AC-6(보임·조작 가능)은 충족 — 추후 개선 후보

## 수정 Action Items

(없음 — Low 2건은 기록용이며 수정 의무 없음)

## 다음 단계

/git-commit 진행 가능. 단, 워킹트리에 별도 작업 `2026-06-12-budget-major-category` 변경이 섞여 있으므로 커밋 시 본 작업 파일 3개(`AppLayout.tsx`, `EChart.tsx`, `TransactionsPage.tsx`)와 작업 폴더 문서만 스테이징할 것.
