# Implementation: 앱 native scroll을 shadcn/ui ScrollArea로 교체

- 날짜: 2026-06-16
- 기반 명세: docs/tasks/2026-06-12-replace-native-scroll-with-scrollarea/research.md

## 변경 파일
- `frontend/src/components/ui/scroll-area.tsx` — 신규. shadcn scroll-area를 레포 컨벤션(`radix-ui` 모놀리식 import, `data-slot`, `cn`)으로 작성. `ScrollArea`(Root+Viewport+자동 세로 ScrollBar+Corner), `ScrollBar`(orientation 지원) export
- `frontend/src/components/ui/table.tsx` — `Table` 래퍼 `<div overflow-x-auto>`를 `<ScrollArea>` + `<ScrollBar orientation="horizontal">`로 교체 (테이블 사용처 5곳에 일괄 적용)
- `frontend/src/pages/TransactionsPage.tsx` — 가져오기 건너뜀 목록(구 :909)·이체 검토 목록(구 :925)의 `overflow-y-auto` div를 ScrollArea로 교체 + import 추가
- `frontend/src/pages/DashboardPage.tsx` — 카테고리 지출 상세 다이얼로그 목록(구 :296)을 ScrollArea로 교체 + import 추가
- `frontend/src/pages/AssetsPage.tsx` — 자산 평가 이력 목록(구 :381)을 ScrollArea로 교체 + import 추가

## 주요 결정
- **세로 목록은 시각 클래스를 분리 배치**: `max-h-*`·`rounded-md`·`border`는 ScrollArea(Root)에, `space-y-*`·`p-2`는 내부 래퍼 div에 두었다. ScrollArea의 children은 Viewport에 직접 들어가므로, 원래 div 한 곳에 몰려 있던 `space-y-1`(자식 간 간격)을 Root에 그대로 두면 적용 대상이 사라진다. 따라서 콘텐츠를 감싸는 내부 div에 간격·패딩을, 스크롤 컨테이너(Root)에 높이 제한·테두리를 배치해 기존 시각 거동을 보존했다.
- **Table은 가로 ScrollBar만 추가**: ScrollArea 컴포넌트가 세로 ScrollBar를 자동 렌더하므로, 테이블은 `<ScrollBar orientation="horizontal" />`만 children으로 추가(shadcn 공식 가로 스크롤 패턴). 세로 스크롤바는 세로 오버플로가 없으면 표시되지 않아 무해.
- **`pr-1` 유지**: 이체 검토 목록의 native 스크롤바 보정 여백 `pr-1`은 내부 래퍼에 그대로 두었다(research 명시 "유지/제거는 구현 재량"). 제거 시 콘텐츠가 스크롤바와 닿을 여지가 있어 보수적으로 유지.
- **제외 항목 미변경**: 미해결 질문 2건(문서 body 스크롤, `SelectContent`)은 사용자가 "권고안 따름(둘 다 제외)"로 확정 → `select.tsx`·`AppLayout.tsx` 무변경.

## 자체 검증 결과
- 실행 명령: `npm run build` (tsc -b && vite build) → **통과** (3421 모듈 변환, 빌드 성공. chunk 크기 경고는 기존부터 있던 일반 경고로 본 변경과 무관)
- 실행 명령: `npm run lint` (eslint .) → **통과** (0 errors, 2 warnings). 경고 2건은 `TransactionsPage.tsx:309·312`의 `useMemo`/`useReactTable` 관련 기존 경고로, 이번에 수정하지 않은 코드 영역
- 잔존 확인: `grep -rE "overflow-(x|y)-auto" frontend/src` → `select.tsx` 1곳만 매치(의도된 제외). 앱 코드의 다른 native scroll 사용처는 0건
- 브라우저 E2E(375px·1280px 실측, 터치 스크롤, 다이얼로그 스크롤 동작)는 /qa 단계에 위임

## 성공 기준 자가 체크
- [x] AC-1: scroll-area.tsx 추가 완료, `overflow-(x|y)-auto`가 select.tsx 1곳 제외 0건 (grep 확인)
- [x] AC-2: table.tsx 래퍼를 ScrollArea+가로 ScrollBar로 교체해 가로 스크롤 보존. 빌드 통과 — 시각/터치 실측은 /qa 위임
- [x] AC-3 (모바일 AC): 코드 수준에서 페이지 레벨 가로 스크롤 유발 요소 제거(테이블 가로 스크롤이 ScrollArea Viewport로 격리됨) — 375px 실측 채점은 /qa 위임
- [x] AC-4: 세로 목록 4곳을 `max-h` 유지한 채 ScrollArea로 교체 — 다이얼로그 열어 스크롤 동작 실측은 /qa 위임
- [x] AC-5: `select.tsx`·`AppLayout.tsx` 무변경 (git diff에 미포함)
- [x] AC-6: `npm run build`·`npm run lint` 통과 (에러 0)

## 보류/미완 항목
- 없음 (브라우저 E2E 채점은 파이프라인상 /qa의 역할)
