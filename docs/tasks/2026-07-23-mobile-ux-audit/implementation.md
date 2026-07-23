# Implementation: 모바일 친화성 개선 (터치 타깃·다이얼로그 스크롤·거래 카드 뷰 외)

- 날짜: 2026-07-23
- 기반 명세: docs/tasks/2026-07-23-mobile-ux-audit/research.md

## 변경 파일
- `frontend/src/lib/utils.ts` — 공통 `touchTarget` 클래스 추가(icon-sm 등 작은 버튼의 터치 히트영역을 의사요소로 44px까지 확장).
- `frontend/src/components/ui/calendar.tsx` — 팝오버 캘린더 `--cell-size` 28px(`--spacing(7)`) → 36px(`--spacing(9)`)로 상향해 날짜 탭 영역 확보.
- `frontend/src/pages/TransactionsPage.tsx` — (1) 거래 추가/수정 다이얼로그에 `max-h`+내부 `ScrollArea` 세로 스크롤 도입, (2) sm 미만 전용 거래 카드 목록 신설(표는 `hidden sm:block`), (3) 캘린더 뷰 일자별 거래 목록 오버플로 대응(min-w-0·flex-wrap·truncate)과 액션 버튼 터치 타깃.
- `frontend/src/pages/AssetsPage.tsx` — 목표 카드 헤더·목표 행 줄바꿈/truncate 처리, 목표·평가이력 액션 버튼 터치 타깃, 계정 삭제 버튼을 공통 `touchTarget`로 리팩터.
- `frontend/src/pages/SettingsPage.tsx` — 카테고리 탭 헤더 줄바꿈 허용, 공통 `RowActions`(3개 탭 공유)의 수정/삭제 버튼 터치 타깃.
- `frontend/src/pages/BudgetsPage.tsx` — 예산 행 삭제 버튼 터치 타깃.
- `frontend/src/components/transactions/TransactionCalendar.tsx` — 셀 내 수입/지출 금액을 `w-full truncate`+`title`로 말줄임 처리(셀 밖 넘침 방지).

## 주요 결정
- **터치 타깃 방식**: research의 `[기술 결정]`대로 시각 크기를 바꾸지 않고 의사요소(`after:-inset-2`)로 히트영역만 44px로 확장하는 공통 `touchTarget` 클래스를 도입. 데스크톱 버튼 크기·레이아웃 회귀를 피하기 위해 `button.tsx` 사이즈 변형은 손대지 않음. 인접 액션 클러스터는 `gap-1`→`gap-2`로 넓혀 히트영역 중심이 겹치지 않게 함.
- **거래 표 액션 버튼**: 표를 `hidden sm:block`(데스크톱 전용)으로 돌리고 모바일은 신설 카드 뷰가 대체하므로, 데스크톱 표의 행 액션 버튼에는 터치 확장을 적용하지 않음(마우스 조작). 모바일 카드의 액션 버튼에만 `touchTarget` 적용.
- **거래 카드 데이터원**: 카드 목록은 표와 동일하게 `table.getRowModel().rows`를 순회 → TanStack Table의 정렬·페이지네이션 결과가 카드에도 그대로 반영됨(AC-4). 편집/삭제는 기존 `openEdit`/`remove` 핸들러 공유.
- **다이얼로그 세로 스크롤**: 앱에 이미 검증된 import 다이얼로그 패턴(`max-h-[calc(100dvh-2rem)]`+`grid-rows-[auto_minmax(0,1fr)_auto]`+`ScrollArea`)을 거래 폼에 그대로 재사용. `DialogContent` 공통 기본값은 건드리지 않아 다른 짧은 다이얼로그의 기존 표시에 영향 없음(영향도 최소화).
- **평가 이력 삭제 버튼**: 기존 주석은 "행 간격이 좁아 히트 확장 시 이웃 행 오탭"을 이유로 제외했었음. 이번엔 행 간격을 `space-y-1`→`space-y-1.5`, `gap-1`→`gap-2`로 넓히고 적용. 경계 오탭이 나더라도 삭제는 날짜·금액을 보여주는 확인 다이얼로그를 거치므로 안전.
- **캘린더 셀 크기**: research Action Item대로 `--cell-size`를 36px로 상향. 44px는 7열 캘린더를 과도하게 키워 데스크톱 팝오버까지 비대해지므로, 모바일 탭 개선과 레이아웃 균형을 고려해 36px로 결정(AC-2의 44px 하드 기준은 표/카드/설정/자산 액션 버튼 대상이며 캘린더 셀은 대상 목록에 없음).

## 자체 검증 결과
- 실행 명령: `cd frontend && npm run build` (tsc -b && vite build) → **통과** (3672 모듈 변환, 빌드 성공). 청크 크기 500kB 경고는 이번 변경과 무관한 기존 경고.
- 실행 명령: `npm run lint` (eslint) → **통과** (exit 0, 0 errors, 2 warnings). 두 경고(`TransactionsPage.tsx:330` useMemo 누락 의존성 `openEdit`, `:333` TanStack `useReactTable` incompatible-library)는 이번에 수정하지 않은 기존 `columns`/`useReactTable` 코드에 대한 것으로 변경 전부터 존재.
- 브라우저 E2E(375px 뷰포트 실측)는 이 단계의 역할이 아니며 **/qa(qa-evaluator)에 위임**. 본 단계는 코드 수준 근거 + 빌드/린트까지 자체 검증.

## 성공 기준 자가 체크
- [x] AC-1 (전역 무결성): 신규/변경 마크업이 모두 flex + `min-w-0`/`truncate`/`shrink-0`/`flex-wrap` 기반이라 고정 px 폭을 추가하지 않음. 캘린더 뷰 일자 목록의 잠재적 가로 넘침(원래 min-w-0 없음)도 함께 해소. 375px 실측은 /qa 위임.
- [x] AC-2 (터치 타깃): 표·목록·카드의 아이콘 액션 버튼(거래 카드/캘린더, 설정 RowActions, 예산 삭제, 자산 목표·평가이력·계정삭제)에 44px 히트영역(`touchTarget`) 적용, 클러스터 `gap-2`로 오탭 완화. 실측 탭은 /qa 위임.
- [x] AC-3 (긴 폼 다이얼로그 세로 스크롤): 거래 추가/수정 다이얼로그에 `max-h`+`ScrollArea` 적용, 헤더/푸터 고정·본문만 스크롤. 다른 다이얼로그 기본값 불변.
- [x] AC-4 (거래 모바일 카드 뷰): sm 미만 카드 목록 신설(날짜·구분·카테고리·금액·계정·구성원·메모·수정/삭제), sm+ 표 유지. 동일 `getRowModel().rows`로 정렬·페이지네이션 반영. 빈 상태 처리 포함.
- [x] AC-5 (헤더/행 빠듯함): 자산 목표 카드 헤더·목표 행, 설정 카테고리 탭 헤더에 `flex-wrap`/`min-w-0`/`truncate`/`shrink-0` 적용.
- [x] AC-6 (캘린더 가독성): 셀 금액 `w-full truncate`+`title`로 셀 밖 넘침 방지, 전체 금액은 title로 확인 가능.
- [x] AC-7 (회귀 없음): `npm run build`·`npm run lint` 통과.

## 보류/미완 항목
- 없음. (AC-2의 캘린더 팝오버 셀은 44px 대신 36px로 상향 — 사유는 위 주요 결정 참조. 해당 셀은 AC-2 하드 기준 대상 목록에 포함되지 않음.)
