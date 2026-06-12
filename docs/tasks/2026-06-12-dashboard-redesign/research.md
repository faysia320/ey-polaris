# Research: 대시보드 개편 — 카드 정리, 소진율 스택바, 카테고리별 지출 풀폭·드릴다운·가독성 개선

- 날짜: 2026-06-12
- 요청 원문: 대시보드를 아래처럼 수정해줘
  1. 최근 거래 카드 삭제
  2. 카테고리별 예산진행 카드도 삭제
  3. 예산 소진율을 stack bar로 변경 가능할지 검토
  4. 카테고리별 지출을 가로로 꽉차게 하고 클릭했을 때 세부 내역이 보이면 좋겠어. 그리고 스타일도 지금의 어두운 테마에서 글씨 색이나 배경색이 가독성이 좋지 않아 개선해줘

## 요약

대시보드는 `frontend/src/pages/DashboardPage.tsx` 단일 페이지로, 안내 카드 + 요약 3카드(수입/지출/예산 소진율) + 2열 그리드(좌: 카테고리별 지출 트리맵, 우: 예산 진행 + 최근 거래)로 구성된다. 1·2번 삭제 대상 카드는 우측 열 전체이므로, 삭제 후 트리맵 카드를 풀폭으로 전환하는 4번 레이아웃 변경과 자연스럽게 맞물린다.

3번 스택바는 **가능**하다. API 응답 `dashboard.budgets`가 카테고리별 `amount`/`spent`를 이미 제공하므로(백엔드 변경 불필요), 소진율 카드의 단색 진행바를 카테고리별 구간으로 분할한 스택바로 교체할 수 있다. 2번에서 삭제되는 "카테고리별 예산 진행" 정보가 이 스택바로 압축 이관되는 효과도 있다.

4번 드릴다운은 기존 API `GET /transactions?month=&major=&member_id=`가 대분류(major) 필터를 이미 지원하므로 백엔드 변경 없이 구현 가능하다. 단, 공용 `EChart` 래퍼가 클릭 이벤트 핸들러를 받지 않아 옵셔널 prop 추가가 필요하고, 트리맵의 `nodeClick: false` 설정을 해제해야 한다. 가독성은 트리맵이 ECharts `dark` 테마 기본 팔레트에 의존해 라벨 대비가 들쭉날쭉한 것이 원인으로, 명시적 고대비 팔레트와 라벨 스타일 지정으로 개선한다.

## 관련 파일 및 근거

- `frontend/src/pages/DashboardPage.tsx:183-207` — 삭제 대상 ① "최근 거래" 카드 JSX. `dashboard.recent_transactions` 사용처는 이곳뿐.
- `frontend/src/pages/DashboardPage.tsx:152-181` — 삭제 대상 ② "카테고리별 예산 진행" 카드 JSX. `dashboard.budgets`를 순회.
- `frontend/src/pages/DashboardPage.tsx:115-133` — "예산 소진율" 카드. 현재 단색(`bg-yellow-300`) 단일 진행바(123-128행). 스택바로 교체할 위치.
- `frontend/src/pages/DashboardPage.tsx:136-150` — 2열 그리드(`lg:grid-cols-2`)와 "카테고리별 지출" 트리맵 카드. 풀폭 전환 시 이 그리드 래퍼가 사라짐.
- `frontend/src/pages/DashboardPage.tsx:36-61` — 트리맵 옵션. `nodeClick: false`(50행)로 클릭이 막혀 있고, 라벨색 `#e4e4e7`·테두리 `#18181b` 하드코딩(52-56행). 팔레트는 ECharts dark 테마 기본값에 의존 → 가독성 개선 대상.
- `frontend/src/components/charts/EChart.tsx:16-38` — 공용 ECharts 래퍼. `option/height/className`만 받고 이벤트 핸들러 prop이 없음 → 클릭 드릴다운을 위해 옵셔널 이벤트 prop 추가 필요.
- `frontend/src/stores/analytics.ts:17-22` — 대시보드 데이터 fetch. `Dashboard` 타입 그대로 사용.
- `frontend/src/types.ts:83-92` — `Dashboard` 타입. `budgets: BudgetProgress[]`(카테고리별 amount/spent — 스택바 데이터 소스), `recent_transactions`(카드 삭제 시 미사용화).
- `backend/app/routers/analytics.py:77-85,101-113` — 대시보드 응답 조립. `budgets`(카테고리별 예산·지출)와 `recent_transactions`(87-99행, limit 5 쿼리) 생성.
- `backend/app/routers/transactions.py:49-82` — 거래 목록 API. `major`(대분류)·`month`·`member_id` 필터 지원(75-77행) → 트리맵 클릭 세부 내역 조회에 그대로 사용 가능.
- `frontend/src/stores/transactions.ts:7-26` — 프런트에도 `major` 필터 포함 쿼리 빌더가 이미 존재(참고용 — 대시보드는 전용 fetch를 두는 편이 거래 페이지 상태와 간섭이 없음).
- `frontend/src/components/ui/dialog.tsx` — shadcn Dialog 존재 → 세부 내역 표시 컨테이너로 활용 가능.
- `frontend/src/index.css:86-118` — `.dark` 테마 변수(카드 배경 `oklch(0.205 0 0)` 등). `frontend/src/main.tsx:7-8`에서 다크 테마 고정. 트리맵 테두리색을 카드 배경과 맞출 때 참조.

## 영향도

- `frontend/src/components/charts/EChart.tsx` — 클릭 이벤트 prop 추가 시 `AssetsPage.tsx`도 이 컴포넌트를 사용하므로(grep 확인: 사용처는 DashboardPage·AssetsPage 2곳) **옵셔널 prop**으로 추가해 기존 사용처에 무영향이어야 함.
- `backend/app/routers/analytics.py` / `backend/app/schemas.py:156-164` — `recent_transactions`를 응답에서 제거하면 limit 5 쿼리(analytics.py:87-99)도 함께 정리 가능. 사용처가 대시보드뿐이라 안전하지만, 프런트 `types.ts:91`도 동기 수정 필요. (제거하지 않고 프런트만 미사용 처리해도 동작에는 문제 없음 — 미해결 질문 참조)
- `dashboard.budgets` 필드는 카드 ②를 삭제해도 **스택바(3번)와 `budget_total`/`budget_spent` 계산의 데이터 소스이므로 백엔드에서 제거하면 안 됨** (analytics.py:105-107).
- 거래 페이지(`TransactionsPage.tsx`)·거래 스토어 — 세부 내역 조회를 대시보드 전용 로컬 fetch로 구현하면 영향 없음. `useTransactionStore`를 재사용하면 거래 페이지 필터 상태가 오염되므로 권장하지 않음.

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: 대시보드에 "최근 거래" 카드가 더 이상 렌더링되지 않는다 — `DashboardPage.tsx`에서 해당 JSX 부재 확인 및 브라우저에서 대시보드 화면 확인.
- [ ] AC-2: 대시보드에 "카테고리별 예산 진행" 카드가 더 이상 렌더링되지 않는다 — 확인 방법 동일.
- [ ] AC-3: "예산 소진율" 카드의 진행바가 카테고리별 구간으로 나뉜 스택바로 표시되고, 각 구간 크기가 `budgets[].spent` 비율과 일치하며 구간별 카테고리명·금액을 식별할 수 있다(범례·툴팁 등 수단은 구현 재량) — 예산이 있는 월에서 브라우저로 확인.
- [ ] AC-4: 예산이 없는 월(`budget_total === 0`)에서 소진율 카드가 깨지지 않고 기존처럼 `—` 등 빈 상태를 표시한다 — 예산 없는 월로 이동해 확인.
- [ ] AC-5: "카테고리별 지출" 카드가 페이지 가로 전체 폭을 차지한다 — 브라우저 확인.
- [ ] AC-6: 트리맵에서 대분류 블록을 클릭하면 해당 대분류·해당 월(·활성 구성원 필터)의 거래 세부 내역(날짜·소분류·금액 포함)이 표시된다 — 브라우저에서 클릭 후 내역이 `GET /transactions?month=&major=` 결과와 일치하는지 확인.
- [ ] AC-7: 트리맵 블록의 글자색이 배경 블록색과 충분한 대비를 갖는다(명시적 팔레트 지정 + 라벨 스타일 조정) — 브라우저에서 전 블록 라벨 가독 확인.
- [ ] AC-8: 세부 내역 조회 실패 시 에러가 사용자에게 표시되고 페이지가 깨지지 않는다 — 백엔드 중지 상태에서 클릭해 확인(또는 코드상 에러 처리 존재 확인).
- [ ] AC-9: `AssetsPage`의 기존 차트가 변경 전과 동일하게 동작한다(EChart prop 추가가 옵셔널이므로) — 자산 페이지 렌더링 확인.
- [ ] AC-10: `frontend`에서 `npm run lint`와 `npm run build`가 통과한다 — 명령 실행으로 확인.
- [ ] AC-11: 모바일 뷰포트(375px)에서 대시보드가 깨지지 않는다 — 요약 카드 1열 스택, 스택바·범례 가로 비넘침, 트리맵 카드 풀폭 유지, 세부 내역 Dialog가 화면 안에 표시 — 375px로 리사이즈한 브라우저에서 확인. (2차 QA 지적으로 추가 — CLAUDE.md "모바일 대응" 제약 반영)

## Action Items

- [ ] `DashboardPage.tsx`에서 "최근 거래" 카드(183-207행)와 "카테고리별 예산 진행" 카드(152-181행), 우측 열 래퍼 및 2열 그리드(`lg:grid-cols-2`, 136행)를 제거하고 "카테고리별 지출" 카드를 풀폭 단독 섹션으로 전환. 미사용이 된 `Badge` import 등 정리.
- [ ] "예산 소진율" 카드의 단일 진행바를 `dashboard.budgets` 기반 카테고리별 스택바로 교체. 예산 초과(`spent > amount`) 및 전체 초과(`budget_spent > budget_total`) 표시 방식 포함. 구현 방식(CSS flex 세그먼트 vs ECharts bar)은 구현 재량 — 카드 폭이 좁으므로(3열 그리드 내) 경량 CSS 방식 권장.
- [ ] `EChart.tsx`에 옵셔널 클릭(또는 이벤트 맵) prop을 추가하고, 차트 인스턴스에 바인딩/해제 처리.
- [ ] 트리맵 옵션에서 `nodeClick` 차단을 해제하고 클릭 핸들러로 대분류명을 받아, `GET /transactions?month=<현재월>&major=<대분류>(&member_id=)`로 세부 내역을 조회해 Dialog 또는 카드 하단 인라인 패널로 표시(컨테이너 형태는 구현 재량, `ui/dialog.tsx` 활용 권장). 조회 에러 처리 포함.
- [ ] 트리맵 가독성 개선: 명시적 고대비 색상 팔레트 지정, 라벨 글자색·크기·(필요시 textShadow) 조정, 테두리색을 카드 배경(`--card`)과 일치시켜 블록 구분 개선.
- [ ] (선택 — 미해결 질문 1 결정에 따름) 백엔드 `DashboardOut.recent_transactions` 필드·limit 5 쿼리 제거 및 `types.ts`의 `Dashboard.recent_transactions` 동기 제거.
- [ ] `npm run lint` / `npm run build` 실행 및 브라우저 검증.

## 미해결 질문

- `recent_transactions`를 백엔드 응답에서도 제거할지: 사용처가 대시보드뿐이라 제거가 깔끔하나(불필요 쿼리 1개 절감), 프런트만 정리해도 무방. **권장: 백엔드까지 제거** — 단일 사용자 앱이라 API 호환성 부담 없음.
- 스택바 구간 색상 팔레트와 범례/툴팁의 구체 형태 — 구현 재량.
- 세부 내역 컨테이너(Dialog vs 인라인 패널)와 내역 표시 형식(거래 나열 vs 소분류 집계 + 거래 나열) — 구현 재량. Dialog + 거래 나열(날짜·소분류·메모·금액)을 기본안으로 권장.
