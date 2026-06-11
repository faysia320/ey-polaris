# Implementation: date input을 shadcn/ui Date Picker로 교체

- 날짜: 2026-06-11
- 기반 명세: docs/tasks/2026-06-11-shadcn-date-picker/research.md

## 변경 파일
- `frontend/package.json` / `frontend/package-lock.json` — `react-day-picker@10.0.1`, `date-fns@4.4.0` 추가 (shadcn CLI가 설치)
- `frontend/src/components/ui/popover.tsx` — 신규. shadcn CLI 생성 (radix-ui 통합 import, 기존 규약 일치 — 수정 없음)
- `frontend/src/components/ui/calendar.tsx` — 신규. shadcn CLI 생성 + 타입 오류 1건 수정 (`table` → `month_grid`, 아래 주요 결정 참조)
- `frontend/src/components/ui/date-picker.tsx` — 신규. 공용 DatePicker 래퍼 (Popover+Calendar, 문자열 인터페이스, ko 로케일). QA Medium 수정 반영: 필수 필드(clearable 아님)에서 선택된 날짜 재클릭으로 인한 해제를 무시 (2차 구현)
- `frontend/src/components/ui/month-picker.tsx` — 신규. 커스텀 MonthPicker (연도 내비게이션 + 12개월 그리드)
- `frontend/src/pages/TransactionsPage.tsx` — 거래 날짜(tx-date)→DatePicker, 조회 월 필터(filter-month)→MonthPicker(clearable, placeholder "전체 기간"), 가져올 월(import-month)→MonthPicker
- `frontend/src/pages/AssetsPage.tsx` — 기준일(val-date)→DatePicker(disableFuture), 목표일(goal-date)→DatePicker(clearable, placeholder "목표일 없음")

## 주요 결정
- **shadcn CLI 사용**: `npx shadcn add popover calendar`가 radix-nova 스타일로 기존 규약(radix-ui 통합 패키지 import, data-slot, cn)과 일치하는 컴포넌트를 생성함을 확인. 단 calendar 템플릿의 classNames 키 `table`이 react-day-picker@10의 `ClassNames` 타입에 없어 tsc 실패 → v10의 올바른 키 `month_grid`로 수정 (`UI.d.ts`의 `MonthGrid = "month_grid"` 확인).
- **문자열 인터페이스 유지**: DatePicker/MonthPicker 모두 `value: string`(빈 값 `''`) / `onChange(next: string)`로 설계해 페이지 상태·제출 로직을 변경하지 않음. Date↔문자열 변환은 DatePicker 내부에서 로컬 기준으로 처리 (`toISOString()` 미사용 — 명세의 타임존 안전성 요건).
- **MonthPicker는 react-day-picker 불사용**: 월 전용 선택 모드가 없어 Popover + 연도 이동(◀ 연도 ▶) + 12개월(1월~12월) 그리드로 직접 구현. 열 때마다 보기 연도를 선택값(없으면 올해)으로 초기화.
- **clear 동작**: clearable일 때 Popover 하단에 "선택 해제" 버튼 → `onChange('')`. 조회 월 필터는 해제 시 기존과 동일하게 `month: null`(전체 기간)로 전달, 목표일은 제출 시 기존 로직(`goalDate || null`)이 null 변환.
- **검증 로직 유지**: 거래 날짜의 `!form.date` 검증(TransactionsPage:162), 기준일의 미래 날짜 제출 검증(AssetsPage)은 그대로 유지. 기준일 달력은 `disabled={{ after: new Date() }}`로 미래 날짜 비활성.
- **캘린더 뷰 동기화**: 조회 월 필터는 기존과 동일하게 `filters.month`를 value로 읽으므로 캘린더 뷰 ◀/▶ 이동(`moveCalendarMonth`) 시 표시값이 자동 동기화됨 (상태 공유 구조 변경 없음).

- **QA Medium 수정 — `required` prop 대신 onSelect 가드 (2차 구현)**: qa-report.md는 `required={!clearable}` 전달을 제안했으나, react-day-picker v10의 DayPicker props는 `required: true`(PropsSingleRequired) / `required?: false | undefined`(PropsSingle)로 구분되는 discriminated union이어서 boolean 변수 전달은 타입 에러가 됨 (`props.d.ts:492-508` 확인). 대신 onSelect에서 `!date && !clearable`이면 onChange 없이 팝오버만 닫는 가드로 동일한 관찰 동작(필수 필드 해제 불가, 재클릭 = 확정처럼 닫힘)을 구현. clearable 필드(목표일)는 기존대로 재클릭 해제 허용.

## 자체 검증 결과
- 실행 명령: `npm run build` (tsc -b && vite build) → **통과** (calendar.tsx 타입 수정 후. 청크 크기 경고는 기존 echarts 번들 관련으로 변경과 무관)
- 실행 명령: `npm run lint` → **통과** (에러 0, 경고 2 — `git stash` 후 변경 전 상태에서도 동일 경고 2건 확인, 기존 경고임)
- `grep type="(date|month)" frontend/src` → **0건**
- (2차 구현 후) `npm run build` / `npm run lint` 재실행 → **통과** (동일: 에러 0, 기존 경고 2)

## 성공 기준 자가 체크
- [x] AC-1: `type="date"` 0건 — grep 확인
- [x] AC-2: tx-date가 DatePicker로 교체, `form.date`에 'YYYY-MM-DD' 저장 (onChange가 toISODate 결과 전달) — 코드 확인 (실기동 확인은 /qa 권장)
- [x] AC-3: val-date에 `disableFuture`(달력 미래 비활성), 제출 검증 문구 유지 — 코드 확인
- [x] AC-4: goal-date `clearable` — 빈 값 placeholder 표시 + "선택 해제" 버튼, 제출 시 `goalDate || null` 유지 — 코드 확인
- [x] AC-5: 트리거에 선택값(ko 로케일 'PPP' 포맷, 예: 2026년 6월 11일) 또는 placeholder 표시 — 코드 확인
- [x] AC-6: 변환은 로컬 기준 parseISODate/toISODate, `toISOString()` 미사용 — date-picker.tsx 확인
- [x] AC-7: `npm run build` 통과
- [x] AC-8: `npm run lint` 통과 (기존 경고 2건만 존재, stash로 기존 여부 검증)
- [x] AC-9: `type="month"` 0건 — grep 확인
- [x] AC-10: filter-month가 MonthPicker(clearable)로 교체, 선택 시 `setFilters({month})` 재조회, 해제 시 `month: null` — 코드 확인
- [x] AC-11: 캘린더 뷰 월 이동과 필터 표시 동기화 — `filters.month` 공유 구조 무변경으로 유지 (실기동 확인은 /qa 권장)
- [x] AC-12: import-month가 MonthPicker로 교체, 기본값 전월(`addMonths(currentMonth(), -1)` 무변경) — 코드 확인
- [x] AC-13: MonthPicker가 기존 Button/Popover/cn 토큰 사용, 연도 내비게이션 + 12개월 그리드 제공 — 코드 확인

## 보류/미완 항목
- 없음
- 참고: 작업 트리에 본 작업과 무관한 기존 미커밋 변경 존재 — `frontend/src/pages/SettingsPage.tsx` (별개 작업 `2026-06-11-category-collapsible-groups`의 것으로 추정). 본 작업에서는 건드리지 않음.
- 참고: UI 실기동 확인(AC-2/4/10/11의 브라우저 동작)은 코드 수준으로만 검증함 — /qa 단계에서 실행 확인 권장.
