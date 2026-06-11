# QA Report: date input을 shadcn/ui Date Picker로 교체 (2차 — Medium 수정 재검증)

- 날짜: 2026-06-11
- 작업 폴더: docs/tasks/2026-06-11-shadcn-date-picker
- 판정: PASS

> 2차 QA. 1차 QA(CONDITIONAL PASS)의 Medium 1건("선택된 날짜 재클릭 시 필수 필드가 비워짐")에 대한 수정(2차 구현, `date-picker.tsx`의 onSelect 가드)을 재검증했다. 변경분은 커밋 `8c5608d`로 이미 커밋되어 working tree는 clean — diff 대신 커밋 내용과 현재 코드를 직접 검증했다. (실기동 검증 시점의 브라우저 날짜는 2026-06-12)

## 성공 기준 채점

- ✅ AC-1: `grep 'type="date"' frontend/src` → 0건 직접 확인 (Grep 도구, DatePicker/MonthPicker 참조만 검출).
- ✅ AC-2: 실기동 확인(localhost:5173 dev 서버, Chrome). 거래 추가 다이얼로그의 날짜 필드가 Popover+Calendar로 Dialog 위에 정상 렌더, 달력에서 6월 3일 클릭 시 트리거가 "2026년 6월 3일"로 갱신. `onChange`가 `toISODate()` 결과('YYYY-MM-DD')를 `form.date`에 전달함은 코드 확인(`TransactionsPage.tsx:601-605`, `date-picker.tsx:86`). 실제 거래 생성 제출은 사용자 실데이터 변형 회피로 미실행(1차 QA와 동일 방침).
- ✅ AC-3: 코드 확인 — `AssetsPage.tsx:360-365`의 기준일이 `<DatePicker disableFuture>`, `date-picker.tsx:78`에서 `disabled={{ after: new Date() }}`로 미래 날짜 비활성. 제출 검증 '기준일은 미래 날짜일 수 없습니다'(`AssetsPage.tsx:134`) 유지. 실기동은 1차 QA와 동일 사유로 불가(개발 DB에 평가액 갱신 대상 유형 계정 없음 — 계정 신규 생성은 실데이터 변형이라 미시도). 동일 컴포넌트의 달력 동작은 다른 2곳에서 실기동 확인됨.
- ✅ AC-4: 실기동 확인. 목표 추가 다이얼로그의 목표일이 (a) 빈 값일 때 placeholder "목표일 없음" 표시, (b) 6월 30일 선택 → "2026년 6월 30일" 표시 → 재오픈 시 "선택 해제" 버튼 노출, (c) 선택된 날짜(30) 재클릭으로도 해제되어 placeholder로 복귀(clearable 경로는 재클릭 해제 허용 — 의도된 동작). 빈 값 제출 시 `target_date: goalDate || null`은 코드 확인(`AssetsPage.tsx:175`).
- ✅ AC-5: 실기동 확인. 선택 시 ko 로케일 PPP 포맷("2026년 6월 11일" 등), 미선택 시 placeholder("날짜 선택"/"목표일 없음"/"전체 기간"/"월 선택") 표시.
- ✅ AC-6: 코드 확인. `date-picker.tsx:23-27` `toISODate()`가 `getFullYear/getMonth/getDate` 로컬 기준 문자열화, `parseISODate()`는 로컬 자정 Date 생성. 신규 파일 내 `toISOString()` 사용 없음.
- ✅ AC-7: `npm run build` 직접 실행 → tsc + vite build 통과 (청크 크기 경고는 기존 echarts 번들 관련).
- ✅ AC-8: `npm run lint` 직접 실행 → 에러 0, 경고 2 (`TransactionsPage.tsx:268, 271`의 useReactTable 관련 — 1차 QA에서 변경 전에도 존재함을 검증한 기존 경고).
- ✅ AC-9: `grep 'type="month"' frontend/src` → 0건 직접 확인.
- ✅ AC-10: 실기동 확인. 조회 월 필터 MonthPicker에서 5월 선택 → 트리거 "2026년 5월" 갱신 + 목록이 5월 거래로 재조회(1/5 페이지). "선택 해제" 클릭 → placeholder "전체 기간" 복귀(전체 조회).
- ✅ AC-11: 실기동 확인. 캘린더 뷰 ◀로 2026-05→2026-04 이동 시 조회 월 필터 트리거가 "2026년 4월"로 동기 갱신, 피커 재오픈 시 4월이 선택 상태로 표시.
- ✅ AC-12: 실기동 확인. 엑셀 업로드 다이얼로그의 가져올 월이 MonthPicker로 표시되고 기본값 "2026년 5월"(전월 — 실기동 시점 2026-06-12 기준). `body.append('month', importMonth)` 전송은 코드 확인(실 업로드는 데이터 변형 회피로 미실행).
- ✅ AC-13: 실기동+코드 확인. ◀ 연도 ▶ 내비게이션 + 1월~12월 3×4 그리드, 기존 `Button`(variant ghost/default)·`Popover`·`cn` 유틸·data-slot 규약 사용(`month-picker.tsx`).

## 1차 QA Medium 수정 재검증 (핵심)

- 수정 내용: `date-picker.tsx:79-88` — onSelect에서 `!date && !clearable`이면 onChange 없이 팝오버만 닫는 가드. (1차 보고서가 제안한 `required={!clearable}`은 react-day-picker v10의 discriminated union 타입 제약으로 불가하다는 구현 측 판단 — `props.d.ts`의 PropsSingle/PropsSingleRequired 구분을 확인했고 타당함. 가드 방식으로 동일한 관찰 동작 달성.)
- 실기동 재현: 거래 추가 다이얼로그(필수 필드) → 기본값 "2026년 6월 11일" → 달력에서 선택된 11 재클릭 → **팝오버 닫히고 값 유지**("2026년 6월 11일" 그대로, placeholder로 변하지 않음). 1차 QA의 재현 절차와 동일 시나리오로 수정 확인 완료.
- clearable 경로 회귀 확인: 목표일에서 선택된 날짜 재클릭 시 정상적으로 해제됨(빈 placeholder 복귀) — 가드가 clearable 동작을 깨지 않음.

## 검증 시나리오

- `npm run build` → 통과. `npm run lint` → 에러 0 / 기존 경고 2.
- Grep: `type="date"` 0건, `type="month"` 0건, 신규 파일 내 `toISOString` 0건.
- 실기동 (localhost:5173 dev 서버, Chrome 자동화, 새 탭):
  - 거래 날짜(필수): 달력 오픈(Dialog 위 정상) → 선택된 날짜 재클릭(값 유지 확인 — Medium 수정 검증) → 다른 날짜(6/3) 선택(트리거 갱신 확인).
  - 목표일(clearable): 빈 placeholder → 6/30 선택 → 재오픈 시 "선택 해제" 노출 → 선택된 날짜 재클릭으로 해제 확인.
  - 조회 월 필터: 5월 선택(목록 재조회 1/5페이지) → 캘린더 뷰 ◀ 이동(필터 "2026년 4월" 동기화) → "선택 해제"(placeholder "전체 기간" 복귀).
  - 엑셀 업로드: 가져올 월 기본값 전월("2026년 5월") 확인 후 취소.
  - 콘솔 에러 0건 (본 세션 추적 범위 기준 — 추적은 세션 중 시작되어 초기 로드 메시지는 미포함).
- 미실행 항목과 사유: 거래/목표 실제 저장, 엑셀 실제 업로드, 평가액 다이얼로그 진입(대상 계정 부재)은 사용자 실데이터 변형 회피로 미실행 — 해당 경로는 상태→payload 코드 추적으로 확인. 모든 다이얼로그는 취소로 닫아 데이터 무변경.
- QA 종료 후 `git status --porcelain` → 무변경(clean) 확인.

## 발견 이슈

- [Low] `frontend/src/components/ui/month-picker.tsx:89,99` — 연도 내비게이션에 상·하한이 없어 무의미한 연도(음수 포함)까지 이동 가능. 네이티브 month input도 동일했고 잘못된 값이 저장되지는 않으므로(클릭한 연-월이 그대로 'YYYY-MM') 동작 결함은 아님. 필요 시 합리적 범위 제한 고려.
- [Low] `frontend/src/components/ui/date-picker.tsx:16-20` — `parseISODate`가 'YYYY-MM-DD' 형식 외 입력에 대한 방어가 없음(Invalid Date 가능). 현재 호출처는 모두 통제된 값(`todayISO()`, API 응답)이라 실위험 낮음 — 참고용 기록.
- (1차 QA의 [Medium] 재클릭 해제 이슈는 수정 확인되어 종결. 1차 [Low] 작업 트리 혼입은 커밋 분리로 해소됨 — `8c5608d`는 본 작업분만 포함.)

## 수정 Action Items (FAIL/CONDITIONAL 시)

- 해당 없음 (PASS — Low 2건은 기록용이며 수정 의무 없음)

## 다음 단계

PASS — 변경분은 이미 커밋됨(`8c5608d`). 본 qa-report.md 갱신분만 /git-commit 진행 가능.
