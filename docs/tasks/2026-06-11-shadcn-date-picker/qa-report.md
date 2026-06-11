# QA Report: date input을 shadcn/ui Date Picker로 교체

- 날짜: 2026-06-11
- 작업 폴더: docs/tasks/2026-06-11-shadcn-date-picker
- 판정: CONDITIONAL PASS

## 성공 기준 채점

- ✅ AC-1: `grep 'type="date"' frontend/src` → 0건 직접 확인.
- ✅ AC-2: 실기동 확인(localhost:5173, Vite dev 서버 = 현재 작업 트리). 거래 추가 다이얼로그의 날짜 필드가 Popover+Calendar로 표시되고(Dialog 위 정상 렌더), 달력에서 6월 3일 클릭 시 트리거가 "2026년 6월 3일"로 갱신됨. `form.date`에 `toISODate()` 결과('YYYY-MM-DD')가 저장되고 제출 payload가 `form.date`를 그대로 사용함은 코드로 확인(`TransactionsPage.tsx:170`). 실제 거래 생성은 사용자 실데이터 DB 변형을 피하기 위해 실행하지 않음(검증 가드 동작은 아래 시나리오에서 확인).
- ✅ AC-3: 코드 확인 — `AssetsPage.tsx`의 기준일이 `<DatePicker disableFuture>`로 교체되었고, `date-picker.tsx:78`에서 `disabled={{ after: new Date() }}`로 미래 날짜 비활성. 제출 시 미래 날짜 검증('기준일은 미래 날짜일 수 없습니다', `AssetsPage.tsx:134`)도 유지. **단, 실기동 확인 불가** — 현재 개발 DB에 평가액 갱신 대상 유형(VALUATION_TYPES)의 계정이 없어 '평가액 갱신' 버튼이 렌더되지 않음(계정을 새로 만들면 사용자 데이터가 변형되므로 미시도). 동일 DatePicker 컴포넌트의 달력 동작 자체는 다른 2곳에서 실기동 확인됨.
- ✅ AC-4: 실기동 확인. 목표 추가 다이얼로그의 목표일이 (a) 빈 값일 때 placeholder "목표일 없음" 표시, (b) 6월 30일 선택 → "2026년 6월 30일" 표시 → 팝오버 재오픈 시 "선택 해제" 버튼 노출 → 클릭 시 빈 상태로 복귀함을 확인. 빈 값 제출 시 `target_date: goalDate || null` 변환은 코드로 확인(`AssetsPage.tsx:175`, 실제 목표 저장은 데이터 변형 회피로 미실행).
- ✅ AC-5: 실기동 확인. 선택 시 ko 로케일 PPP 포맷("2026년 6월 11일"), 미선택 시 placeholder("날짜 선택"/"목표일 없음"/"전체 기간") 표시.
- ✅ AC-6: 코드 확인. `date-picker.tsx:23-27`의 `toISODate()`가 `getFullYear/getMonth/getDate` 로컬 기준으로 문자열화하고, `parseISODate()`도 로컬 자정 생성. `toISOString()` 사용 없음(전 신규 파일 grep 확인).
- ✅ AC-7: `npm run build` 직접 실행 → tsc + vite build 통과 (청크 크기 경고는 기존 echarts 번들 관련).
- ✅ AC-8: `npm run lint` 직접 실행 → 에러 0, 경고 2. 경고 위치(`TransactionsPage.tsx:268, 271`)는 이번 diff 범위 밖(기존 useReactTable 관련)으로 기존 경고임을 확인.
- ✅ AC-9: `grep 'type="month"' frontend/src` → 0건 직접 확인.
- ✅ AC-10: 실기동 확인. 조회 월 필터 MonthPicker에서 5월 선택 시 `GET /api/v1/transactions?month=2026-05` 요청(200) 발생, 목록이 17페이지(전체)→5페이지(5월)로 재조회됨. "선택 해제" 클릭 시 placeholder "전체 기간" 표시 + 전체 기간 목록 복귀.
- ✅ AC-11: 실기동 확인. 캘린더 뷰 ◀ 클릭으로 2026-05→2026-04 이동 시 조회 월 필터 트리거가 "2026년 4월"로 동기 갱신됨.
- ✅ AC-12: 실기동 확인. 엑셀 업로드 다이얼로그의 가져올 월이 MonthPicker로 표시되고 기본값 "2026년 5월"(전월, 오늘 2026-06-11 기준). 업로드 요청에 `body.append('month', importMonth)` 전송은 코드 확인(실 업로드는 미실행 — 데이터 변형 회피).
- ✅ AC-13: 실기동+코드 확인. ◀ 연도 ▶ 내비게이션 + 1월~12월 3×4 그리드, 기존 `Button`(variant ghost/default, size icon-sm)·`Popover`·`cn` 유틸 사용, data-slot 규약 준수.

## 검증 시나리오

- `npm run build` → 통과. `npm run lint` → 에러 0 / 기존 경고 2 (경고 라인이 diff 밖임을 직접 확인).
- `grep type="date"`, `grep type="month"` → 각 0건. `toISOString` 신규 파일 내 사용 없음.
- 실기동 (localhost:5173 dev 서버 = 작업 트리 코드, Chrome 자동화):
  - 조회 월 필터: 선택(네트워크 요청 `?month=2026-05` 200 확인)·해제(전체 기간 복귀)·캘린더 뷰 월 이동 동기화 모두 정상.
  - 거래 추가 다이얼로그: Dialog 내부에서 Popover/Calendar 정상 오픈·선택·트리거 갱신.
  - 엣지 케이스 — **선택된 날짜 재클릭**: 필수 필드(거래 날짜)에서 값이 해제되어 빈 상태가 됨(아래 Medium 이슈). 이 상태로 제출 시 기존 검증 '날짜를 입력해주세요'가 차단함(API 호출 없음)을 확인.
  - 목표일: 빈 상태 placeholder → 선택 → "선택 해제"로 해제까지 확인.
  - 엑셀 업로드 다이얼로그: 가져올 월 기본값 전월 확인 (업로드 자체는 미실행).
  - 콘솔 에러 0건 (세션 중 추적 기준).
- 미실행 항목과 사유: 거래/목표/평가액의 실제 저장 호출은 사용자 실데이터(가계부 DB)를 변형하므로 미실행 — 해당 경로는 상태→payload 코드 추적으로 확인. 평가액 다이얼로그는 대상 유형 계정이 DB에 없어 UI 진입 불가(코드 검증으로 대체).
- 검증 중 1회 `502 Bad Gateway`(백엔드 프록시 일시 오류) 관찰 — 동일 요청 재시도는 200. 피커가 보낸 요청 포맷(`month=2026-05`)은 정상이므로 본 변경과 무관한 환경 이슈.
- QA 종료 후 `git status` → 시작 시점과 동일(QA로 인한 작업 트리 변경 없음, 본 보고서 제외).

## 발견 이슈

- [Medium] `frontend/src/components/ui/date-picker.tsx:79-82` — react-day-picker single 모드의 기본 동작으로, **이미 선택된 날짜를 다시 클릭하면 선택이 해제**되어 `onChange('')`가 호출됨. 필수 필드인 거래 날짜(tx-date)·기준일(val-date)에서도 발생(실기동 재현: 거래 추가 → 달력에서 오늘(선택됨) 클릭 → 트리거가 "날짜 선택" placeholder로 변함). 제출은 기존 검증('날짜를 입력해주세요'/'기준일을 입력해주세요')이 차단하므로 데이터 손상은 없으나, 필수 필드가 일반적인 달력 조작만으로 비워지는 것은 의도된 UX가 아님. react-day-picker v10은 single 모드에 `required` prop(선택 해제 방지)을 지원하므로 `clearable`이 아닐 때 이를 전달하면 해결됨.
- [Low] `frontend/src/pages/TransactionsPage.tsx` — `pageError`가 catch에서만 설정되고 이후 성공 조회 시 해제되지 않아, 일시적 502 이후 목록이 정상 복구돼도 에러 배너가 계속 남음. 단, 이는 변경 전부터 있던 기존 패턴(이번 diff가 도입한 것 아님) — 참고용 기록.
- [Low] 작업 트리 혼입 — 현재 미커밋 변경에 본 작업과 무관한 별개 작업분이 섞여 있음: `backend/app/routers/transactions.py`·`TransactionsPage.tsx`의 `member_id` 관련 변경(`2026-06-11-excel-import-transaction-member`), `SettingsPage.tsx`(`2026-06-11-category-collapsible-groups`). 커밋 단계에서 작업별 분리 필요.

## 수정 Action Items (FAIL/CONDITIONAL 시)

- [ ] `date-picker.tsx`: 필수 필드에서 선택 해제가 불가능하도록 수정 — `clearable`이 아닐 때 DayPicker(single 모드)에 `required` 전달(예: `<Calendar mode="single" required={!clearable} ...>`)하고, onSelect의 `date ? ... : ""` 분기가 clearable 경로에서만 빈 값을 내보내는지 확인. 수정 후 거래 추가 다이얼로그에서 선택된 날짜 재클릭 시 값이 유지되는지 재검증.

## 다음 단계

/implement docs/tasks/2026-06-11-shadcn-date-picker 로 Medium 1건 수정 후 /qa 재실행. (커밋 시 타 작업 변경분 분리에 유의)
