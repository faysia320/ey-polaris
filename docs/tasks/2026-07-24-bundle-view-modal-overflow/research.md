# Research: 묶음 보기 모달 콘텐츠 오버플로 수정

- 날짜: 2026-07-24
- 요청 원문: 캡춰 이미지 처럼 묶음 보기 모달에서 컨텐츠 내용이 모달을 뚫고 나오는 문제가 있어

## 요약
묶음 보기 다이얼로그에서 긴 계정명(예: `우리직장인재테크 저축예금(수수료우대형 · 신한이영은 [이체→지출: 이체]`)이 `truncate`로 잘리지 않고 모달 경계를 뚫고 나온다. 원인은 `DialogContent`가 CSS `grid` 컨테이너(`dialog.tsx:64`)인데, grid item의 기본 `min-width`가 `auto`라서 내부에 `white-space: nowrap`(=`truncate`) 텍스트가 있으면 grid 트랙이 그 텍스트의 min-content 폭만큼 팽창하기 때문이다. 묶음 보기 콘텐츠 wrapper `<div className="space-y-3 text-sm">`(`TransactionsPage.tsx:1876`)가 이 grid item인데 `min-w-0`이 없어, 하위 `<p className="truncate ...">`(`:1890`, `:1909`)가 폭 제약을 받지 못하고 팽창해 `max-w-[calc(100%-2rem)]`/`sm:max-w-md`(이 모달은 `:1863`에서 `className="sm:max-w-md"`로 오버라이드) 모달 밖으로 넘친다. 해결은 이 grid item wrapper에 `min-w-0`을 부여해 트랙 폭을 모달 폭에 고정하고 `truncate`가 정상 작동하도록 하는 것.

## 관련 파일 및 근거
- `frontend/src/pages/TransactionsPage.tsx:1862` — 묶음 보기 `<Dialog>` 루트. `viewOpen` 상태로 열림.
- `frontend/src/pages/TransactionsPage.tsx:1876` — 콘텐츠 wrapper `<div className="space-y-3 text-sm">`. `DialogContent`(grid)의 직속 자식이자 문제의 grid item. 여기에 `min-w-0`이 없어 팽창 발생.
- `frontend/src/pages/TransactionsPage.tsx:1890` / `:1909` — `<p className="truncate text-muted-foreground">` 지출/수입 다리의 날짜·계정명·메모 줄. `truncate`가 걸려 있으나 조상 grid item이 팽창해 무력화됨.
- `frontend/src/pages/TransactionsPage.tsx:1880` / `:1899` — 카테고리명 줄의 `<span className="flex min-w-0 ...">` + `<span className="truncate">`. 이미 `min-w-0`이 있어 flex 레벨은 정상(이 수정 대상 아님, 팽창은 상위 grid item에서 발생).
- `frontend/src/components/ui/dialog.tsx:64` — `DialogContent`가 `grid w-full max-w-[calc(100%-2rem)] ... sm:max-w-sm`. grid 컨테이너라는 것이 근본 원인의 배경. **공용 컴포넌트이므로 이 파일은 수정하지 않고** 호출부 wrapper에서 `min-w-0`으로 해결한다.

## 영향도
- `TransactionsPage.tsx`의 묶음 보기 다이얼로그 wrapper 한 곳에 클래스 추가 → 해당 모달에만 영향. 다른 페이지·모달 무영향.
- `dialog.tsx`는 건드리지 않으므로 앱 전역 다이얼로그 회귀 위험 없음.
- 동일 grid-item-min-width 패턴이 다른 다이얼로그(예: `TransactionsPage.tsx:1861` 이전의 수정/삭제 모달들)에도 잠재하나, 이번 요청 범위는 묶음 보기 모달로 한정. 조사 중 육안 확인된 넘침은 묶음 보기 모달뿐.

## 성공 기준 (Acceptance Criteria)
- [ ] AC-1: 묶음 보기 모달에서 지출/수입 다리의 날짜·계정명·메모 줄이 모달 내부 폭을 넘지 않고, 넘치는 텍스트는 말줄임(…)으로 잘린다 — 매우 긴 계정명을 가진 묶음 거래로 모달을 열어 텍스트가 모달 경계 안에 머무는지 육안 확인.
- [ ] AC-2: 카테고리명(상단 줄)과 금액이 겹치지 않고, 금액은 잘리지 않으며 우측 정렬을 유지한다 — 긴 카테고리명 케이스에서 금액 전체가 보이는지 확인.
- [ ] AC-3 (모바일): 375px 뷰포트에서 묶음 보기 모달이 가로 스크롤·요소 겹침·텍스트 잘림(말줄임 외) 없이 표시된다 — **/qa 단계에서** 브라우저 도구로 375px 뷰포트에서 모달을 열어 확인.
- [ ] AC-4: 기존 동작(묶음 해제 버튼, 닫기 버튼, 유형별 효과 요약 문구) 회귀 없음 — 모달 조작이 이전과 동일하게 동작하는지 확인.
- [ ] AC-5: `cd frontend && npm run build`가 성공한다(tsc + vite 타입/빌드 오류 없음) — 빌드 실행으로 확인.

## Action Items
- [ ] 묶음 보기 콘텐츠 wrapper `<div className="space-y-3 text-sm">`(`TransactionsPage.tsx:1876`)에 `min-w-0`을 추가해 grid item이 콘텐츠 min-content 폭으로 팽창하지 않게 한다.
- [ ] (검증) 긴 계정명/카테고리명 케이스에서 지출·수입 두 다리 모두 말줄임 처리 및 모달 폭 유지 확인.

## 결정 사항 및 출처
- [기술 결정] 수정 위치를 공용 `dialog.tsx`가 아닌 호출부 wrapper로 → grid item wrapper(`:1876`)에 `min-w-0` 추가: 전역 다이얼로그 회귀를 피하고 문제 모달만 국소 수정. 명세의 Action Items에 반영.
- [기술 결정] `overflow-x-auto`(가로 스크롤 허용) 대신 `min-w-0`+기존 `truncate` 유지(말줄임 처리) → 요약성 모달에서 가로 스크롤보다 말줄임이 UX상 적절. 전체 문자열은 개별 거래 행에서 확인 가능.

## 미해결 질문
- 없음
