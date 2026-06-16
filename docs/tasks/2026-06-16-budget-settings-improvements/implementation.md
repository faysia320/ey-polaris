# Implementation: 예산 설정 메뉴 개선 (전월 복사 · 빠른 금액 버튼 · 콤마 placeholder)

- 날짜: 2026-06-16
- 기반 명세: docs/tasks/2026-06-16-budget-settings-improvements/research.md

## 미해결 질문 확정 (AskUserQuestion 결과)
- 빈 전월: **당월 보존 + 안내** (전월 예산 없으면 당월 삭제하지 않고 안내 메시지)
- 빠른 버튼: **누적 가산** (클릭 시 현재 입력값에 더함)
- 덮어쓰기 확인: **인앱 확인 UI** (당월 예산 있을 때만 Dialog)

## 변경 파일
- `backend/app/schemas.py` — `BudgetCopy`(source_month/target_month) 스키마 추가.
- `backend/app/routers/budgets.py` — `POST /budgets/copy` 추가. 한 트랜잭션에서 source 월 조회 → 비면 422 → target 월 기존 삭제 → 복제 후 커밋. `delete` import 추가.
- `frontend/src/stores/budgets.ts` — `copyFromPrevMonth` 액션 추가(현재 월의 전월→현재월 복사 후 재조회). `addMonths` import 추가.
- `frontend/src/lib/format.ts` — 접미사 없는 천단위 콤마 포맷 `formatNumber` 추가.
- `frontend/src/pages/BudgetsPage.tsx` — 상단 "전월 복사" 버튼 + 당월 데이터 있을 때 확인 Dialog, 빠른 입력 버튼(+100만원/+10만원/+5만원, 누적 가산), Input 스피너 숨김 CSS, placeholder 콤마(formatNumber) 적용.

## 주요 결정
- **복사를 백엔드 엔드포인트로**: 클라이언트에서 삭제+생성 N+M 요청은 비원자적이라 중간 실패 시 데이터 불일치 위험. `(year_month, major)` 유니크 충돌도 한 트랜잭션 내 "삭제 후 삽입"으로 안전하게 회피.
- **빈 전월은 422로 신호**: source가 비면 target을 건드리지 않고 `422 "복사할 전월 예산이 없습니다"` 반환 → 프론트가 에러 메시지로 표시(당월 보존 보장).
- **확인 UI는 당월 데이터가 있을 때만**: `items.length > 0`이면 Dialog로 확인, 없으면 즉시 복사(불필요한 확인 단계 제거). 브라우저 `confirm()` 대신 shadcn Dialog 사용 — /qa 브라우저 자동화 호환.
- **스피너 제거는 CSS 방식**: `type="number"` 유지 + `appearance` 계열 CSS로 스피너만 숨김 → 기존 `Number()`/`Number.isInteger` 검증 경로 무변경(AC-7 유지). `type="text"` 전환보다 변경 최소.
- **빠른 버튼 라벨 "+100만원/+10만원/+5만원"**: research AC-5의 "100만원·10만원·5만원" 문구를 포함하면서 `+`로 누적 가산 의미를 전달. `flex-wrap`으로 375px에서 줄바꿈 처리.
- **모바일 너비**: 변경 금액 컬럼을 `w-28`→`w-32`로 소폭 확대, 입력란/버튼은 세로 스택(`flex-col`)+버튼 `flex-wrap`. 표는 기존 `Table`이 ScrollArea로 감싸 가로 오버플로 시에도 페이지 레이아웃이 깨지지 않음.

## 자체 검증 결과
- 실행 명령: `cd frontend && npm run build` → **통과** (tsc -b + vite build 성공, 타입 에러 없음).
- 실행 명령: `npm run lint` → **통과(0 errors)**. 경고 2건은 `TransactionsPage.tsx`의 기존 항목으로 이번 변경과 무관(내 변경 파일은 경고 없음).
- 실행 명령: `python -m py_compile budgets.py schemas.py` → **OK(구문 유효)**.
- 브라우저 E2E(전월 복사 동작·스피너 미노출·375px 레이아웃 시각 확인)는 **/qa(qa-evaluator)에 위임**.

## 성공 기준 자가 체크
- [x] AC-1 (전월 복사 기본): `POST /budgets/copy`로 전월 전 항목을 당월에 복제, `copyFromPrevMonth` 후 `fetch()`로 표·총 예산 갱신.
- [x] AC-2 (덮어쓰기): 복사 엔드포인트가 target 월 기존 예산을 `delete` 후 삽입 → 중복/누적 없음, 유니크 위반 없음.
- [x] AC-3 (빈 전월 안전): source 비면 삭제 전 422 반환 → 당월 보존 + 프론트 안내 메시지. 조용한 전체 삭제 없음.
- [x] AC-4 (스피너 제거): `NO_SPINNER` CSS로 webkit inner/outer spin-button 및 `appearance:textfield` 적용. (시각 확인은 /qa)
- [x] AC-5 (빠른 버튼): 각 행에 +100만원/+10만원/+5만원 버튼, `addAmount`로 누적 가산, 저장 시 `save`로 반영.
- [x] AC-6 (콤마 placeholder): `formatNumber(budget.amount)`로 `1,000,000` 형식 placeholder.
- [x] AC-7 (저장 검증 유지): `type="number"` 유지, `saveRow`의 `Number.isInteger`/`<=0` 검증 그대로.
- [x] AC-8 (모바일 375px): 세로 스택 + flex-wrap + ScrollArea 백업. (브라우저 시각 확인은 /qa)
- [x] AC-9 (빌드·린트): build 통과, lint 0 errors.

## 보류/미완 항목
- 없음. (브라우저 E2E 시각 검증은 설계상 /qa 단계 담당)
