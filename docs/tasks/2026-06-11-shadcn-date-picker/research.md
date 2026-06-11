# Research: date input을 shadcn/ui Date Picker로 교체

- 날짜: 2026-06-11
- 요청 원문: 목표일 같은 date input을 모두 찾아 shadcn/ui 의 date picker로 변경해줘

## 요약

프론트엔드 전체에서 네이티브 날짜류 input은 5곳이며, 그중 `type="date"`가 3곳(거래 날짜, 평가 기준일, 목표일), `type="month"`가 2곳(조회 월, 엑셀 가져올 월)이다. **5곳 모두 교체 대상이다(사용자 확정)**. shadcn/ui의 Date Picker는 단일 컴포넌트가 아니라 Popover + Calendar(react-day-picker) 조합 패턴이며, 현재 프로젝트에는 Popover/Calendar 컴포넌트와 `react-day-picker`·`date-fns` 의존성이 모두 없어 신규 추가가 필요하다. 기존 ui 컴포넌트들은 통합 `radix-ui` 패키지에서 프리미티브를 import하는 스타일(`components.json`의 radix-nova 스타일)이므로 새 컴포넌트도 동일 규약을 따라야 한다. 페이지 상태는 모두 `'YYYY-MM-DD'`(일) / `'YYYY-MM'`(월) 문자열(빈 값은 `''` 또는 `null`)로 관리되고 백엔드 API도 동일 포맷을 받으므로, 문자열 상태를 유지한 채 Date 변환을 내부에서 처리하는 공용 래퍼를 만들어 교체하는 방향이 안전하다. 단, react-day-picker는 "월만 선택"하는 모드를 제공하지 않으므로 월 입력 2곳은 Popover + 연도 내비게이션 + 12개월 그리드 형태의 **커스텀 MonthPicker**(shadcn 스타일 준수)로 구현해야 한다.

## 관련 파일 및 근거

### 교체 대상 (type="date" — 3곳)
- `frontend/src/pages/AssetsPage.tsx:444-450` — **목표일 (선택)** 입력. 값이 비어 있을 수 있는 선택 필드(`goalDate`, 빈 문자열 초기화 `:67`, 제출 시 `goalDate || null`로 변환 `:174`). 선택 해제(clear)가 가능해야 함.
- `frontend/src/pages/AssetsPage.tsx:358-365` — **평가 기준일** 입력. `max={todayISO()}`로 미래 날짜 차단(`:362`), 제출 시에도 미래 날짜 검증 존재(`:133`). 기본값은 오늘(`:57`, `:109`).
- `frontend/src/pages/TransactionsPage.tsx:597-603` — **거래 날짜** 입력. 필수 필드, 기본값 오늘(`emptyForm()` `:71-72`). Dialog 내부에 위치(`:586`).

### 교체 대상 (type="month" — 2곳, 커스텀 MonthPicker)
- `frontend/src/pages/TransactionsPage.tsx:362-374` — **조회 월 필터**(`filters.month`, `'YYYY-MM'` 또는 `null`). 빈 값(`null`)이면 전체 기간 조회이므로 미선택 상태 표현과 선택 해제(clear)가 가능해야 함. 값 변경 시 `setFilters`가 즉시 재조회를 수행(`:370`). Dialog 밖(페이지 필터 바)에 위치.
- `frontend/src/pages/TransactionsPage.tsx:785-793` — **엑셀 가져올 월**(`importMonth`, `'YYYY-MM'`, 기본 전월 `:98`). 필수 필드. Dialog 내부에 위치.
- 참고: 캘린더 뷰의 월 이동 버튼(`TransactionsPage.tsx:517-523`, `moveCalendarMonth`)은 input이 아니므로 대상 아님. 단, 조회 월 필터와 같은 `filters.month`를 공유하므로 MonthPicker 교체 후에도 양방향 동기화(버튼으로 이동 → 필터 표시 갱신)가 유지되어야 함.

### 기반 구조
- `frontend/components.json:3` — shadcn 스타일 `radix-nova`, `iconLibrary: lucide`, ui alias `@/components/ui`.
- `frontend/src/components/ui/dialog.tsx:4` — `import { Dialog as DialogPrimitive } from "radix-ui"` — 통합 radix-ui 패키지 import 규약. 신규 popover.tsx도 동일 규약 필요.
- `frontend/package.json:12-27` — `react-day-picker`, `date-fns` 미설치. `radix-ui@^1.5.0`(Popover 프리미티브 포함), `shadcn@^4.11.0` CLI 존재. `frontend/package-lock.json` 존재(의존성 추가 시 lockfile 갱신 필요).
- `frontend/src/components/ui/` — 현재 badge/button/card/dialog/input/label/select/separator/table/tabs만 존재. **calendar.tsx, popover.tsx 없음**.
- `frontend/src/lib/format.ts:12-15` — `todayISO()`: 로컬 타임존 기준 `'YYYY-MM-DD'` 생성. Date ↔ 문자열 변환 시 이 로컬 기준 방식을 따라야 함(`toISOString()`은 UTC 변환으로 한국 타임존에서 날짜가 하루 밀릴 수 있음).

## 영향도

- `frontend/src/pages/AssetsPage.tsx`, `frontend/src/pages/TransactionsPage.tsx` — input → DatePicker 교체 및 import 변경. 상태 타입(문자열)과 제출 로직은 변경하지 않으므로 store(`goals.ts`, `transactions.ts`)·백엔드 API에는 영향 없음.
- `frontend/package.json` / `frontend/package-lock.json` — `react-day-picker`, `date-fns` 의존성 추가. Docker 빌드(`frontend/Dockerfile`)는 lockfile 기반 설치이므로 lockfile 갱신만 정상이면 영향 없음.
- 3곳 모두 Dialog(`Radix Dialog`) 내부에 위치 — Popover가 Dialog 위에 떠야 하므로 portal/z-index 동작 확인 필요(둘 다 Radix 프리미티브라 기본 동작으로 호환되나 검증 항목에 포함).
- 평가액 다이얼로그의 미래 날짜 제출 검증(`AssetsPage.tsx:133`)은 유지 — 피커에서 미래를 막더라도 방어 로직 삭제 금지.

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: `frontend/src` 내 `type="date"` 네이티브 input이 0건이다 — `grep -r 'type="date"' frontend/src` 결과 없음으로 확인.
- [ ] AC-2: 거래 추가/수정 다이얼로그의 날짜 필드가 Popover+Calendar 기반 date picker로 표시되고, 날짜 선택 시 `form.date`에 `'YYYY-MM-DD'` 문자열이 저장되어 거래 생성/수정이 기존과 동일하게 동작한다 — 앱 실행 후 거래 추가로 확인(또는 해당 동작을 검증하는 수동 시나리오).
- [ ] AC-3: 평가액 갱신 다이얼로그의 기준일 picker는 오늘 이후 날짜를 선택할 수 없다(달력에서 미래 날짜 비활성). 기존 제출 시 미래 날짜 검증(`AssetsPage.tsx`의 '기준일은 미래 날짜일 수 없습니다')은 그대로 유지된다 — 코드 확인 및 달력 UI에서 미래 날짜 클릭 불가 확인.
- [ ] AC-4: 목표 추가/수정 다이얼로그의 목표일 picker는 (a) 미선택 상태(빈 값)를 표현할 수 있고 (b) 선택한 날짜를 해제(clear)할 수 있으며, 빈 값 제출 시 기존처럼 `target_date: null`로 저장된다 — UI에서 해제 후 저장 → 목표 목록에 날짜 미표시로 확인.
- [ ] AC-5: 선택된 날짜가 트리거 버튼에 사용자가 읽을 수 있는 형식으로 표시되고, 미선택 시 placeholder 문구가 표시된다 — UI 확인. (표시 포맷은 구현 재량: `YYYY-MM-DD` 또는 한국어 포맷)
- [ ] AC-6: 타임존 안전성 — 날짜 선택 결과가 로컬 기준으로 문자열화되어, 어떤 날짜를 선택해도 저장 문자열이 달력에서 클릭한 날짜와 일치한다(`toISOString()` 미사용) — 변환 코드 리뷰로 확인.
- [ ] AC-7: `cd frontend && npm run build`(tsc + vite build)가 에러 없이 통과한다.
- [ ] AC-8: `cd frontend && npm run lint`가 에러 없이 통과한다.
- [ ] AC-9: `frontend/src` 내 `type="month"` 네이티브 input이 0건이다 — `grep -r 'type="month"' frontend/src` 결과 없음으로 확인.
- [ ] AC-10: 조회 월 필터가 Popover 기반 MonthPicker로 표시되고, 월 선택 시 `filters.month`에 `'YYYY-MM'`이 저장되어 거래 목록이 해당 월로 재조회된다. (a) 미선택(전체 기간) 상태를 표현할 수 있고 (b) 선택 해제 시 `month: null`로 전체 기간 조회로 돌아간다 — UI에서 선택/해제 후 목록 변화로 확인.
- [ ] AC-11: 캘린더 뷰의 월 이동 버튼(◀/▶)으로 월을 변경하면 조회 월 필터 MonthPicker의 표시값도 함께 갱신된다(기존 `filters.month` 공유 동작 유지) — 캘린더 뷰에서 월 이동 후 필터 표시 확인.
- [ ] AC-12: 엑셀 업로드 다이얼로그의 가져올 월이 MonthPicker로 표시되고, 기본값은 전월이며, 선택한 `'YYYY-MM'` 값으로 업로드 요청이 전송된다 — UI 확인 및 코드 리뷰.
- [ ] AC-13: MonthPicker는 연도 이동 내비게이션과 12개월 선택 그리드를 제공하고, 기존 ui 컴포넌트와 동일한 디자인 토큰(cn 유틸, 기존 Button/Popover 스타일)을 사용한다 — UI 및 코드 확인. (그리드 레이아웃·월 표기 등 세부는 구현 재량)

## Action Items

- [ ] `react-day-picker`, `date-fns` 의존성 추가 (shadcn CLI `npx shadcn add calendar popover` 활용 가능 — radix-nova 스타일·기존 import 규약(`radix-ui` 통합 패키지)과 일치하는지 생성 결과 확인 필수).
- [ ] `frontend/src/components/ui/popover.tsx`, `frontend/src/components/ui/calendar.tsx` 생성 — 기존 ui 컴포넌트들과 동일한 코드 스타일(data-slot, cn 유틸, radix-ui 통합 import).
- [ ] 문자열 value/onChange 인터페이스(`value: string`(빈 값 `''` 허용), `onChange(next: string)`)를 갖는 공용 DatePicker 래퍼 컴포넌트 1개 생성 — 내부에서 Date ↔ `'YYYY-MM-DD'` 로컬 변환 처리, `disabled` 날짜 범위(미래 차단)·clear 가능 여부를 props로 지원. (배치 위치·세부 props 설계는 구현 재량)
- [ ] `TransactionsPage.tsx` 거래 날짜 input을 DatePicker로 교체 (필수 필드, 기본 오늘).
- [ ] `AssetsPage.tsx` 기준일 input을 DatePicker로 교체 (미래 날짜 비활성).
- [ ] `AssetsPage.tsx` 목표일 input을 DatePicker로 교체 (선택 필드 — 빈 상태 + clear 지원).
- [ ] 커스텀 MonthPicker 컴포넌트 생성 — Popover 트리거 버튼 + 연도 이동 내비게이션 + 12개월 그리드. 문자열 인터페이스(`value: string`(`''` 허용), `onChange(next: string)`), clear 가능 여부 props 지원. react-day-picker 불사용(월 전용 모드 부재), 기존 ui 컴포넌트 스타일 규약 준수. (배치 위치·세부 설계는 구현 재량)
- [ ] `TransactionsPage.tsx` 조회 월 필터 input을 MonthPicker로 교체 (clear 가능 — 해제 시 `month: null` 전체 조회, 캘린더 뷰 월 이동과의 동기화 유지).
- [ ] `TransactionsPage.tsx` 엑셀 가져올 월 input을 MonthPicker로 교체 (필수, 기본 전월).
- [ ] 달력 한국어 표시(date-fns `ko` 로케일) 적용 — 앱 전체가 한국어 UI이므로 권장. MonthPicker의 월 표기도 한국어(1월~12월) 권장 (세부는 구현 재량).
- [ ] Dialog 내부에서 Popover가 정상적으로 열리고 상호작용되는지 확인 (date 3곳 + 가져올 월이 Dialog 내부).

## 미해결 질문

- ~~`type="month"` 2곳 처리 여부~~ → **해결됨(2026-06-11 사용자 확정)**: 월 선택 UI까지 교체한다. react-day-picker는 월 전용 선택 모드가 없으므로 커스텀 MonthPicker로 구현 (Action Items·AC-9~13 반영).
- shadcn CLI(`npx shadcn add`)가 이 프로젝트의 radix-nova 스타일로 calendar/popover를 정상 생성하는지는 실행 전 확정 불가 — 생성물이 기존 규약과 다르면 수동 작성으로 대체 (구현 재량).
