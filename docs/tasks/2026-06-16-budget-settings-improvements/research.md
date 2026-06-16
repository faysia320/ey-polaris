# Research: 예산 설정 메뉴 개선 (전월 복사 · 빠른 금액 버튼 · 콤마 placeholder)

- 날짜: 2026-06-16
- 요청 원문:
  > 예산설정 메뉴를 아래처럼 개선해줘
  > 1. 상단에 전월 복사 기능 추가. 전월 복사 중 당월 데이터가 있을 경우, 삭제 후 덮어 쓰기
  > 2. 변경 금액 Input 창 안에 금액을 조절하는 스피너가 잇는데 제거 하고, 100만원, 10만원, 5만원 버튼 추가
  > 3. 변경 금액에 현재 예산이 있는 경우 그 금액이 placeholder로 표시되는데 천단위 콤마도 같이 표시

## 요약
예산 설정 페이지(`BudgetsPage.tsx`)는 월 단위로 지출 대분류별 예산을 한 행씩 입력·저장하는 화면이다. 세 가지 개선이 요청되었다. (1) 현재는 한 행씩만 저장 가능 — 상단에 "전월 복사" 버튼을 추가해 직전 월(`addMonths(month, -1)`) 예산을 당월로 일괄 복사하되, 당월에 기존 예산이 있으면 삭제 후 덮어쓴다. 이를 안전·원자적으로 처리하려면 백엔드에 복사 엔드포인트를 추가하는 것이 적절하다(클라이언트 N+M 요청은 비원자적). (2) 변경 금액 `Input`은 `type="number"`라 브라우저 기본 스피너가 노출된다 — 스피너를 제거하고 100만/10만/5만원 빠른 입력 버튼을 추가한다. (3) placeholder는 현재 `String(budget.amount)`로 콤마 없이 표시(`BudgetsPage.tsx:131`) — `Intl.NumberFormat`(이미 `format.ts:3`에 `krw` 존재) 기반으로 천단위 콤마를 적용한다. 백엔드 예산 모델은 (year_month, major) 유니크이며 amount는 `gt=0` 정수다.

## 관련 파일 및 근거
- `frontend/src/pages/BudgetsPage.tsx:19-167` — 예산 설정 화면 전체. 헤더(`:71-82`), 변경 금액 Input(`:127-135`, `type="number"`/`placeholder={String(budget.amount)}`), 저장 검증(`saveRow` `:48-67`).
- `frontend/src/stores/budgets.ts:16-41` — zustand 스토어. `fetch`/`save`(존재 시 PUT, 없으면 POST `:26-35`)/`remove`. 전월 복사용 액션을 여기에 추가하는 것이 일관적.
- `frontend/src/lib/format.ts:3` — `const krw = new Intl.NumberFormat('ko-KR')` (모듈 private). `:17-19` `formatKRW`는 "원" 접미사 포함. 콤마만 필요한 placeholder용으로 접미사 없는 포맷이 필요.
- `frontend/src/lib/format.ts:31-38` — `addMonths(month, delta)`. 전월 계산에 사용.
- `frontend/src/lib/api.ts:24-34` — `api.get/post/put/delete`. 신규 엔드포인트 호출 시 사용.
- `frontend/src/types.ts:71-77` — `Budget { id, year_month, major, amount }`.
- `backend/app/routers/budgets.py:12-55` — list/create/put/delete. 복사 엔드포인트 추가 위치. create는 대분류가 지출 카테고리에 존재하는지 검증(`:27-34`).
- `backend/app/schemas.py:147-169` — `BudgetCreate`(year_month/major/amount, `amount gt=0`), `BudgetUpdate`, `BudgetOut`. 복사 요청/응답 스키마 추가 위치.
- `backend/app/models.py:141-156` — `Budget` 모델. `UniqueConstraint("year_month","major")`, `amount: BigInteger`.
- `frontend/src/components/ui/input.tsx:5-17` — 공통 Input. 스피너 숨김 CSS는 페이지에서 `className`으로 주입 가능(공통 컴포넌트 수정 불필요).

## 영향도
- **백엔드 신규 엔드포인트(권장안)**: `budgets.py`에 복사 라우트 + `schemas.py`에 요청/응답 스키마 추가. 기존 라우트 시그니처는 변경 없음 → 다른 호출부 영향 없음. Alembic 마이그레이션 불필요(모델 스키마 불변).
- **`budgets.ts` 스토어**: 복사 액션 추가 시 `BudgetState` 인터페이스 확장. 소비처는 `BudgetsPage.tsx`뿐이라 영향 국소적.
- **`format.ts`에 콤마 포맷 헬퍼 추가 시**: 순수 추가 — 기존 `formatKRW`/`krw` 사용처 무영향.
- **스피너 제거를 `type="number"` → `type="text"`(inputMode numeric)로 바꿀 경우**: `saveRow`의 `Number(raw)`/`Number.isInteger` 검증 경로 점검 필요(비숫자 입력 가능성). CSS로 스피너만 숨기면 검증 로직 무변경. — 구현 재량(아래 미해결 질문).
- 대시보드 등 예산 소비처(`analytics`/`DashboardOut.budgets`)는 데이터 형태 변화 없음 → 영향 없음.

## 성공 기준 (Acceptance Criteria)
- [ ] AC-1 (전월 복사 — 기본 동작): 예산 설정 상단에 "전월 복사"(또는 동등 라벨) 버튼이 있고, 클릭하면 직전 월의 예산 전 항목이 현재 보고 있는 월로 복사되어 표 및 총 예산에 반영된다 — 브라우저에서 전월에 예산 2건 이상 설정 후 당월로 이동해 버튼 클릭, 표에 동일 금액이 나타나는지 /qa 단계에서 확인.
- [ ] AC-2 (당월 데이터 덮어쓰기): 당월에 기존 예산이 있는 상태에서 전월 복사를 실행하면 당월 기존 예산은 삭제되고 전월 값으로 대체된다(중복/누적 없음) — 당월에 임의 예산 1건을 만든 뒤 전월(다른 금액) 복사 실행, 최종적으로 전월 값만 남는지 /qa에서 확인. (검증: (year_month, major) 유니크 위반 없이 성공.)
- [ ] AC-3 (전월이 비어있을 때 안전 처리): 직전 월에 예산이 하나도 없을 때 전월 복사를 실행해도 당월 데이터가 의도치 않게 전부 삭제되지 않는다(또는 명확한 안내 메시지 표시) — 구체 동작은 구현 재량이나, "조용히 당월을 전부 비우는" 동작은 금지. /qa에서 전월 빈 상태로 버튼 클릭 시 동작 확인.
- [ ] AC-4 (스피너 제거): 변경 금액 입력란에 브라우저 기본 숫자 증감 스피너(up/down 화살표)가 보이지 않는다 — 데스크톱 Chrome에서 입력란에 포커스/호버 시 스피너 미노출을 /qa에서 시각 확인.
- [ ] AC-5 (빠른 금액 버튼): 각 행에 100만원·10만원·5만원 버튼이 있고, 클릭 시 해당 행 변경 금액 입력값이 그만큼 조정된다(누적 가산이 기본 동작 — 정확한 누적/대체 의미는 구현 재량). 버튼으로 만든 금액을 저장하면 그 금액이 현재 예산으로 반영된다 — /qa에서 버튼 클릭→저장→현재 예산 갱신 확인.
- [ ] AC-6 (콤마 placeholder): 현재 예산이 있는 행의 변경 금액 입력란 placeholder가 천단위 콤마 포함으로 표시된다(예: `1,000,000`) — /qa에서 예산이 설정된 행의 빈 입력란 placeholder에 콤마가 보이는지 확인.
- [ ] AC-7 (저장 검증 유지): 변경 금액 저장 시 기존처럼 1원 이상의 정수만 허용되고, 잘못된 값은 에러 메시지로 거부된다 — 0/음수/비정수 입력 저장 시 거부되는지 /qa에서 확인.
- [ ] AC-8 (모바일 375px): 375px 뷰포트에서 빠른 금액 버튼·입력란·저장/삭제 버튼이 가로 스크롤·요소 겹침·잘림 없이 배치되고 터치 조작 가능한 크기를 유지한다 — /qa 단계에서 브라우저 도구로 375px 리사이즈 후 예산 표 확인.
- [ ] AC-9 (빌드·린트): `cd frontend && npm run build`와 `npm run lint`가 통과한다 — /qa에서 명령 실행으로 확인.

## Action Items
- [ ] 백엔드: 전월(또는 임의 source month) → target month 예산 복사 엔드포인트 추가. 한 트랜잭션에서 target month 기존 예산 삭제 후 source month 행을 amount 포함 복제. source가 비어있을 때 처리 방침 결정(권장: 당월 삭제 없이 no-op 또는 422/안내). `schemas.py`에 요청/응답 스키마 추가. (엔드포인트 경로·요청 바디 형태는 구현 재량)
- [ ] 프론트 스토어(`budgets.ts`): 복사 액션 추가(현재 `month` 기준 전월 복사 호출 → 완료 후 `fetch()`로 재조회). `BudgetState` 인터페이스 확장.
- [ ] 프론트 페이지(`BudgetsPage.tsx`): 상단 헤더 영역에 "전월 복사" 버튼 추가, 복사 액션 연결, 로딩/에러 처리. 복사 실행 시 기존 `error` state 재사용.
- [ ] 변경 금액 Input 스피너 제거: CSS로 webkit/moz 스피너 숨김(권장 — 검증 로직 무변경) 또는 `type="text"`+`inputMode="numeric"`로 전환 후 검증 경로 점검. 택일은 구현 재량.
- [ ] 각 행에 100만/10만/5만원 빠른 입력 버튼 추가, 클릭 시 해당 행 `drafts[major]` 값 갱신(누적 가산). 375px 레이아웃 고려한 배치(필요 시 줄바꿈/래핑).
- [ ] placeholder 콤마 적용: `format.ts`에 접미사 없는 천단위 콤마 포맷 헬퍼 추가(또는 기존 `krw` 노출) 후 `placeholder`에 적용. (헬퍼 이름·노출 방식은 구현 재량)
- [ ] `npm run build` / `npm run lint` 통과 확인.

## 미해결 질문
- **전월이 비어있을 때**: 직전 월 예산이 없으면 당월을 비울지(요청의 "삭제 후 덮어쓰기" 문자 그대로) vs 당월 보존 + 안내(데이터 손실 방지). → 권장: 당월 보존 + "복사할 전월 예산이 없습니다" 안내. AC-3에 "조용한 전체 삭제 금지"로 하한만 고정, 정확한 동작은 사용자/구현 재량.
- **빠른 버튼 의미**: 클릭 시 현재 입력값에 **누적 가산**(예: 10만 클릭 2회 = 20만)인지, 해당 금액으로 **대체**인지. → 권장: 누적 가산(스피너 증감 대체 취지에 부합). 구현 재량으로 AC-5에 누적을 기본으로 명시.
- **전월 복사 확인 절차**: 당월 덮어쓰기가 파괴적이므로 confirm 다이얼로그를 둘지 여부. → 요청에 없음. 구현 재량(둬도/안 둬도 AC 충족). 단, 브라우저 `confirm()` 사용 시 Claude 브라우저 도구 세션을 막을 수 있으므로 /qa 자동화를 고려하면 인앱 UI 권장.
