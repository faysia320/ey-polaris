# Implementation: 대시보드 개편 — 카드 정리, 소진율 스택바, 카테고리별 지출 풀폭·드릴다운·가독성 개선

- 날짜: 2026-06-12
- 기반 명세: docs/tasks/2026-06-12-dashboard-redesign/research.md

## 변경 파일

- `frontend/src/pages/DashboardPage.tsx` — "최근 거래"·"카테고리별 예산 진행" 카드 및 2열 그리드 제거, 트리맵 카드 풀폭 전환(높이 320→400), 소진율 카드를 카테고리별 CSS 스택바+범례로 교체, 트리맵 클릭 → 세부 내역 Dialog 추가, 트리맵 고대비 팔레트·휘도 기반 라벨색 적용
- `frontend/src/components/charts/EChart.tsx` — 옵셔널 `onClick` prop 추가 (ref 보관 방식으로 차트 인스턴스 재생성 없이 최신 핸들러 호출)
- `frontend/src/types.ts` — `Dashboard.recent_transactions` 제거
- `backend/app/routers/analytics.py` — 최근 거래 limit 5 쿼리 및 `recent_transactions` 응답 조립 제거, 미사용이 된 `transaction_to_out` import 제거
- `backend/app/schemas.py` — `DashboardOut.recent_transactions` 필드 제거

## 주요 결정

- **드릴다운 컨테이너**: 사용자 지시대로 Dialog + 거래 나열(날짜·소분류·메모·금액). 헤더에 월·건수·합계 표시. 조회는 기존 `GET /transactions?month=&kind=expense&major=(&member_id=)` 재사용 — 트리맵이 지출 전용이므로 `kind=expense` 고정. 거래 페이지 스토어(`useTransactionStore`)는 필터 상태 오염을 피해 사용하지 않고 `api.get` 직접 호출.
- **트리맵 클릭**: `nodeClick: false`는 유지(내장 줌/링크 동작 차단)하고 ECharts `click` 이벤트만 `EChart onClick` prop으로 수신. 로딩/에러/빈 내역 상태를 Dialog 안에서 처리 (AC-8).
- **가독성 팔레트**: 사용자가 지정한 ECharts 테마 빌더의 dark 테마 팔레트(`#dd6b66, #759aa0, #e69d87, #8dc1a9, #ea7e53, #eedd78, #73a373, #73b9bc, #7289ab, #91ca8c, #f49f42`)를 적용. 테마 빌더 페이지(JS 앱)에서 직접 추출이 불가해 동일 정의의 ECharts 레거시 dark 테마 값을 사용. 라벨색은 블록 휘도 기반으로 어두운색(`#1f2329`)/밝은색(`#eeeeee`)을 자동 선택해 밝은 블록(예: `#eedd78`)에서도 대비 확보. 테두리색은 카드 배경(`--card` ≈ `#171717`)과 일치시킴.
- **스택바**: 카드 폭이 좁아(3열 그리드) ECharts 대신 경량 CSS flex 세그먼트로 구현. 분모를 `max(budget_total, budget_spent)`로 잡아 예산 초과 월에도 바가 넘치지 않음. 세그먼트 `title` 네이티브 툴팁 + 하단 범례(색점·카테고리명·spent/amount, 초과 카테고리는 rose 강조)로 삭제된 "카테고리별 예산 진행" 카드의 정보를 압축 이관. 예산 없는 월은 기존처럼 `—` + 빈 바 유지 (AC-4).
- **백엔드 제거**: 사용자 확정에 따라 `recent_transactions`를 응답 스키마·쿼리에서 완전 제거. 코드베이스 grep으로 잔여 참조 없음 확인(문서 제외).

## 자체 검증 결과

- 실행 명령: `npm run lint` (frontend) → **통과** (0 errors; 경고 2건은 `TransactionsPage.tsx`의 기존 경고로 이번 변경과 무관)
  - 1차 실행에서 `EChart.tsx`의 렌더 중 ref 갱신이 `react-hooks/refs` 에러로 검출 → effect로 이동해 수정 후 통과
- 실행 명령: `npm run build` (frontend) → **통과** (✓ built in 996ms; 청크 크기 경고는 기존과 동일)
- 실행 명령: `python -m py_compile app/routers/analytics.py app/schemas.py` (backend) → **통과** (exit 0). 백엔드 테스트 스위트는 부재(tests 폴더 없음)
- `recent_transactions|transaction_to_out` 전역 grep → 코드 잔여 참조 없음 (docs만 잔존)
- 브라우저 실동작(클릭 드릴다운, 스택바 렌더링)은 미실행 — `/qa` 단계에서 확인 필요

## 성공 기준 자가 체크

- [x] AC-1: "최근 거래" 카드 JSX 제거됨 — DashboardPage.tsx에 해당 마크업 부재
- [x] AC-2: "카테고리별 예산 진행" 카드 JSX 제거됨 — 동일
- [x] AC-3: 소진율 카드가 `budgets[].spent / max(budget_total, budget_spent)` 비율의 CSS 스택바 + 색점 범례로 렌더링 — 코드상 충족, 브라우저 확인은 QA 위임
- [x] AC-4: `budget_total === 0`이면 `—` 표시·빈 바·빈 범례(조건부 렌더) — 코드상 충족
- [x] AC-5: 2열 그리드 제거로 "카테고리별 지출" 카드가 단독 풀폭 섹션 — 코드상 충족
- [x] AC-6: 트리맵 클릭 → `GET /transactions?month=&kind=expense&major=(&member_id=)` 조회 → Dialog에 거래 나열 — 코드상 충족, 실클릭 확인은 QA 위임
- [x] AC-7: 명시적 팔레트 + 휘도 기반 라벨색 자동 선택 — 코드상 충족
- [x] AC-8: 조회 실패 시 Dialog 내 에러 메시지 표시(`detail.error`), 페이지 비파괴 — 코드상 충족
- [x] AC-9: `EChart` `onClick`은 옵셔널 prop — AssetsPage 무변경, 빌드 통과
- [x] AC-10: `npm run lint` / `npm run build` 통과 — 위 검증 결과 참조

## 보류/미완 항목

- 없음 (브라우저 실동작 검증은 /qa 단계 담당)

---

## 2차 수정 (QA CONDITIONAL PASS 후속, 2026-06-12)

QA 보고서(qa-report.md)의 발견 이슈 Medium 1건 + Low 2건을 모두 수정.

### 변경 파일

- `frontend/src/pages/DashboardPage.tsx` — 아래 3건 수정 (이번 차수 변경은 이 파일 1개)

### 수정 내역

- **[Medium] stale 응답 가드**: `detailSeq` ref(요청 시퀀스)를 도입. `openDetail`은 시퀀스를 증가시키고 응답 도착 시 최신 시퀀스가 아니면 무시. Dialog 닫기는 `closeDetail`로 일원화해 시퀀스를 증가시키므로, 로딩 중 닫아도 진행 중 fetch가 닫힌 Dialog를 다시 열지 못하고, 연속 클릭 시 늦게 도착한 이전 응답이 최신 선택을 덮어쓰지 못함.
- **[Low] 에러 고착 해소**: `fetchDashboard` 성공 시 `.then(() => setError(null))`로 에러 상태 초기화 — 실패 후 월 변경으로 성공하면 정상 화면 복귀.
- **[Low] 색상 일관성**: `colorByName` Map(useMemo)을 도입 — `expense_by_category` 순서로 먼저 배색하고 `budgets`의 미등장 이름을 이어서 배색. 트리맵·스택바·범례가 모두 이 맵을 사용하므로 동일 카테고리명은 두 시각화에서 항상 같은 색.

### 자체 검증 결과

- `npm run lint` → **통과** (0 errors, 기존 경고 2건만 잔존)
- `npm run build` → **통과**
- `docker compose up -d --build frontend`로 재기동 후 **브라우저 실확인** (QA가 미확인으로 남긴 항목):
  - 2026-06: 카드 2개 부재, 풀폭 카드, 소진율 카드 범례(생활 > 생필품 0원/100,000원)·빈 트리맵 상태 정상
  - 2026-05: 트리맵 풀폭 렌더링·새 팔레트·라벨 가독 정상
  - '생활' 블록 클릭 → Dialog "2026-05 · 20건 · 합계 2,360,820원" — QA의 API 검증값과 정확히 일치, 거래 나열(날짜·소분류·메모·금액) 정상, Escape로 닫힘 정상

### 성공 기준 자가 체크 (변동분)

- [x] AC-3/AC-5/AC-6/AC-7: 브라우저 실확인 완료 (위 검증 결과)
- 나머지 AC: 1차 구현과 동일하게 유지 (회귀 없음 — lint/build 재통과)

---

## 3차 수정 (2차 QA CONDITIONAL PASS 후속, 2026-06-12)

2차 QA의 Medium(모바일 AC 계약 누락·375px 미검증)·Low(라벨 임계값) 해소. 진행 중 **기존 전역 레이아웃 문제 발견**(AppLayout 사이드바가 고정 240px라 375px에서 콘텐츠 ~135px로 압착) → 사용자 확인을 받아 AppLayout 모바일 대응을 범위에 포함.

### 변경 파일

- `docs/tasks/2026-06-12-dashboard-redesign/research.md` — AC-11(모바일 375px) 추가 (QA 지적에 따른 계약 보강)
- `frontend/src/pages/DashboardPage.tsx` — `labelColorFor` 임계 0.6→0.5 (중간 톤 블록 WCAG AA 미달 해소), 헤더 행 `flex-wrap gap-y-3` (375px 줄바꿈)
- `frontend/src/components/layout/AppLayout.tsx` — 사이드바를 `hidden md:flex`로 데스크톱 전용 전환, 모바일 전용 하단 내비게이션(5개 메뉴, 아이콘+축약 라벨, `fixed bottom`) 추가, `main`을 모바일 풀폭 `p-4 pb-20` / 데스크톱 `md:ml-60 md:p-8`로 변경

### 주요 결정

- **AppLayout 수정은 사용자 승인 하의 범위 확장** — CLAUDE.md "모바일 대응 (UI 필수 제약)"상 사이드바 미대응 시 AC-11 충족이 불가능해 AskUserQuestion으로 확인 후 진행. 모바일 내비는 하단 탭 바 패턴(터치 대상 ~48px, 축약 라벨로 한 줄 유지).
- 375px 검증 방법: 사용자 브라우저 줌(34%)을 건드리지 않기 위해 same-origin 375×812 iframe을 주입해 뷰포트를 에뮬레이션(iframe 내부 미디어 쿼리는 iframe 폭 기준) — 검증 후 제거.

### 자체 검증 결과

- `npm run lint` → **통과** (0 errors, 기존 경고 2건만), `npm run build` → **통과**
- `docker compose up -d --build frontend` 재기동 후 **375px 브라우저 실확인**:
  - 가로 오버플로 없음 — `document.scrollWidth 360 ≤ viewport 375` 수치 확인
  - 헤더 2줄 줄바꿈(제목/컨트롤), 요약 카드 1열 스택, 소진율 스택바·범례 정상(2026-06)
  - 트리맵 모바일 폭 렌더링·라벨 가독(밝은 블록 어두운 라벨) 정상(2026-05)
  - '생활' 블록 클릭 → Dialog가 375px 화면 안에 표시, 20건·합계 2,360,820원 일치, 내부 스크롤 정상
  - 하단 내비 5개 메뉴 표시·활성 상태 강조 정상
- **데스크톱(1528px) 회귀 확인**: 사이드바 표시, 하단 내비 미표시, 기존 레이아웃 동일

### 성공 기준 자가 체크 (변동분)

- [x] AC-7: 임계 0.5로 강화 — 중간 톤 블록(#73a373 등)에 어두운 라벨 배정, 375px에서도 라벨 가독 확인
- [x] AC-11: 375px에서 가로 스크롤 없음(360≤375)·카드 스택·스택바·Dialog·하단 내비 모두 실확인
- 나머지 AC: 회귀 없음 (lint/build 재통과, 데스크톱 화면 확인)
