# QA Report: 모바일 친화성 개선 (터치 타깃·다이얼로그 스크롤·거래 카드 뷰 외)

- 날짜: 2026-07-23
- 작업 폴더: docs/tasks/2026-07-23-mobile-ux-audit
- 판정: CONDITIONAL PASS

> 조건(핵심): 이 작업의 성공 기준 대부분(AC-1~AC-6)은 **375px 실측 브라우저 검증**을 /qa에 위임하고 있으나, 이 환경의 제어 브라우저(claude-in-chrome)가 **로컬 앱에 도달하지 못해 실측을 수행할 수 없었다**(아래 "검증 시나리오" 참조). 코드/정적 근거와 build·lint는 모두 통과하고 명백한 결함은 발견되지 않았으나, /qa 규율("정적 분석만으로는 PASS를 내릴 수 없으니 보수적으로 판정")에 따라 **PASS로 확정하지 않고 CONDITIONAL PASS**로 둔다. 커밋 전 도달 가능한 브라우저 또는 실기기에서 375px 스팟 체크를 권장한다.

## 성공 기준 채점

- ✅(정적)·⚠️(미실측) **AC-1 (전역 무결성 375px)**: 신규/변경 마크업이 모두 flex 기반이며 고정 px 폭을 추가하지 않고 `min-w-0`/`truncate`/`shrink-0`/`flex-wrap`을 사용 — 코드상 가로 오버플로 유발 요소 없음. 다만 375px 뷰포트 실측(레시피 A)은 환경 제약으로 미수행. 근거: 전체 diff 정독 + 각 페이지 변경부 구조 확인.
- ✅(정적)·⚠️(미실측) **AC-2 (터치 타깃 44px 유효영역)**: `touchTarget = "relative after:absolute after:-inset-2 after:content-['']"` → 28px(icon-sm) + 2×8px = 44px 히트영역. 지정된 모든 대상에 적용됨(거래 카드/캘린더 액션, 설정 `RowActions` 3탭 공유, 예산 삭제, 자산 목표·평가이력·계정삭제). `aria-label`도 병행 추가. 기하 분석: 클러스터 `gap-2`(8px)에서 인접 버튼의 히트영역은 **빈 gap 8px 구간에서만 겹치고, 이웃 버튼의 가시 아이콘 위는 덮지 않는다** → 아이콘 직탭은 항상 의도한 버튼이 활성. 평가이력(세로 `space-y-1.5`=6px)은 위/아래로 2px 경계 오버랩이 남으나 삭제는 확인 다이얼로그를 거침. 실제 탭 동작은 미실측.
- ✅(정적)·⚠️(미실측) **AC-3 (긴 폼 다이얼로그 세로 스크롤)**: 거래 추가/수정 `DialogContent`에 `max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]` + 본문 `<ScrollArea className="min-h-0 pr-3">` 적용. 헤더/푸터 고정, 본문만 스크롤. **동일 파일의 검증된 import 다이얼로그(`TransactionsPage.tsx:1033-1055`)와 구조가 완전히 일치** → 앱 내 입증된 패턴 재사용. 다른 다이얼로그 기본값(`dialog.tsx`)은 불변이라 회귀 없음. 375×667 실측은 미수행.
- ✅(정적)·⚠️(미실측) **AC-4 (거래 모바일 카드 뷰)**: 표는 `hidden ... sm:block`, 카드 목록은 `sm:hidden`으로 분기. 카드가 `table.getRowModel().rows`를 순회 → TanStack의 정렬·페이지네이션 결과 공유(AC-4의 "정렬 반영" 충족). 카드에 날짜·구분(Badge)·카테고리·금액·계정·구성원·메모·수정/삭제 표시, 빈 상태 처리 포함. `openEdit`/`remove` 핸들러 공유. 375px(카드)/768px(표) 실측은 미수행.
- ✅(정적)·⚠️(미실측) **AC-5 (헤더/행 빠듯함)**: 자산 목표 카드 헤더·목표 행(`flex-wrap`/`min-w-0`/`truncate`/`shrink-0`), 설정 카테고리 탭 헤더(`flex-wrap`/`min-w-0`/`shrink-0`) 적용. 긴 이름 truncate, 버튼 shrink-0로 겹침 방지. 실측 미수행.
- ✅(정적)·⚠️(미실측) **AC-6 (캘린더 가독성)**: 셀 금액 span에 `w-full truncate` + `title` 적용. 셀은 `grid-cols-7` 자식이라 폭이 제한되고 `w-full truncate`로 셀 밖 넘침 방지, 전체 금액은 title로 확인. 실측 미수행.
- ✅ **AC-7 (회귀 없음)**: **직접 실행 확인.** `npm run build`(tsc -b && vite build) → 성공(3672 모듈, built in 1.39s). `npm run lint` → exit 0, 0 errors, 2 warnings(둘 다 `TransactionsPage.tsx:330/333`의 기존 `useMemo`/`useReactTable` 경고로 이번 변경과 무관 — diff에 해당 라인 변경 없음 확인).

## 검증 시나리오

- **build**: `cd frontend && npm run build` → 성공(vite v8.0.16, 3672 modules, 1.39s). 500kB 청크 경고는 기존 번들 크기 경고로 변경 무관.
- **lint**: `npm run lint` → 0 errors, 2 warnings(사전 존재, 위 AC-7 참조).
- **정적 분석**: 변경 7개 파일 diff 전체 정독 + 헬퍼(`kindAmountSign`/`kindAmountClass`/`KIND_BADGE_VARIANT`)·`touchTarget` 유틸·`DialogContent` 기본 클래스·`Calendar` 사용처(`date-picker.tsx`만; `month-picker`는 자체 그리드라 무영향) 교차 확인.
- **375px 실측 시도(레시피 A) — 실패**: claude-in-chrome 브라우저로 앱에 접속 불가.
  - `http://localhost:3000` → `ERR_CONNECTION_REFUSED`
  - `http://127.0.0.1:3000` → `ERR_CONNECTION_REFUSED`
  - `http://192.168.1.190:3000`(호스트 LAN IP) → `ERR_CONNECTION_TIMED_OUT`
  - `http://example.com` → **정상 로드** → 브라우저는 인터넷에는 도달하나 **호스트 로컬/LAN에는 도달 불가** → 제어 브라우저가 원격/격리 환경으로 판단됨. (대조: 셸 `curl`은 `localhost:3000`/`:8000` 모두 200 — 앱 자체는 정상 기동 중.)
  - 결론: 레시피 A는 "브라우저가 앱에 접속 가능"을 전제로 하는데 이 환경에서 그 전제가 성립하지 않음. iframe 주입도 앱 페이지가 로드되어야 가능하므로 불가. 로컬 서버의 공개 노출은 설정/보안상 수행하지 않음.
- **파괴적 기능·데이터 영향**: 이번 변경은 순수 프론트엔드 표현 계층(레이아웃/클래스)만 수정. DB·API·엑셀 import 경로 등 파괴적 기능은 실행하지 않았으며 검증용 데이터도 생성하지 않음 → 데이터 영향 없음.

## 발견 이슈

- [Medium] (검증 공백 · 환경 제약) `docs/tasks/2026-07-23-mobile-ux-audit/research.md:48-53` AC-1~AC-6 — 이 앱은 모바일 사용을 전제(CLAUDE.md "모바일 대응")로 하고 성공 기준의 핵심이 375px 실측인데, **이 환경에서 실측을 수행하지 못했다**(브라우저가 앱에 도달 불가). 코드/정적 근거상 결함은 없으나, 픽셀 단위 가로 스크롤·요소 겹침·터치 오탭은 정적 분석으로 100% 보장할 수 없다. 이것은 코드 결함이 아니라 **검증 미완**이며, 보수적 판정(CONDITIONAL PASS)의 근거다. 재현: 위 "375px 실측 시도" 참조.
- [Low] `frontend/src/lib/utils.ts:13-14` — 파일 끝에 빈 줄이 2개(불필요한 trailing blank line). 동작 무관 스타일. → QA 중 수정함(아래 참조).

## QA 중 적용한 수정 (Low 한정)

- `frontend/src/lib/utils.ts:12-14` — 파일 끝 여분의 빈 줄 제거(단일 개행으로 정리). 위 [Low] 항목 대응. 동작 변경 없음.
- 수정 후 재검증: `npm run lint` → exit 0(0 errors, 동일한 2 pre-existing warnings). `npm run build` → 성공. 회귀 없음 확인.

## 수정 Action Items (CONDITIONAL)

- [ ] 도달 가능한 브라우저 또는 실기기에서 **375px(및 375×667) 실측**으로 AC-1~AC-6 최종 확인 — 특히 (a) 5개 페이지 가로 스크롤/겹침/잘림 부재, (b) 거래 표/카드·설정 RowActions·자산 목표/평가이력 액션 버튼의 오탭 여부, (c) 거래 추가 다이얼로그를 '이체'로 열어 최상단~최하단 스크롤 도달, (d) 캘린더 큰 금액 날의 셀 넘침. (코드 수정이 아니라 검증 완료를 위한 항목 — /implement 대상이 아니라 실측 가능 환경에서의 확인 항목)

## 다음 단계

CONDITIONAL PASS — 코드·build·lint는 통과하고 정적 근거상 모든 AC가 구현되어 있으나, 이 환경에서 필수 375px 실측을 수행하지 못했다. 커밋 전 도달 가능한 브라우저/실기기에서 위 Action Item의 375px 스팟 체크로 확인 후 `/git-commit` 진행 권장. (실측에서 오버플로/오탭이 발견되면 `/implement`로 회귀 수정.)
