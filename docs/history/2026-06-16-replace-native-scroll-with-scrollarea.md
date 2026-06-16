# 작업 이력: 앱 native scroll을 shadcn/ui ScrollArea로 교체

- **날짜**: 2026-06-16
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

앱 전반의 native overflow 스크롤(`overflow-x-auto`/`overflow-y-auto`)을 shadcn/ui `ScrollArea` 컴포넌트로 교체했다. 공통 `Table` 래퍼와 페이지 내 세로 목록(거래 가져오기 건너뜀·이체 검토, 대시보드 카테고리 상세, 자산 평가 이력)에 일괄 적용해 스크롤 UI를 일관화했다.

## 변경 파일 목록

- `frontend/src/components/ui/scroll-area.tsx` — 신규. shadcn scroll-area를 레포 컨벤션(`radix-ui` 모놀리식 import·`data-slot`·`cn`)으로 작성
- `frontend/src/components/ui/table.tsx` — `Table` 래퍼 `<div overflow-x-auto>`를 `<ScrollArea>` + 가로 `<ScrollBar>`로 교체 (테이블 사용처 5곳에 일괄 반영)
- `frontend/src/pages/TransactionsPage.tsx` — 가져오기 건너뜀·이체 검토 세로 목록을 ScrollArea로 교체
- `frontend/src/pages/DashboardPage.tsx` — 카테고리 지출 상세 다이얼로그 목록을 ScrollArea로 교체
- `frontend/src/pages/AssetsPage.tsx` — 자산 평가 이력 목록을 ScrollArea로 교체

## 상세 변경 내용

상세: [docs/tasks/2026-06-12-replace-native-scroll-with-scrollarea](../tasks/2026-06-12-replace-native-scroll-with-scrollarea/) 참조

## 테스트 방법

- `cd frontend && npm run build` (tsc + vite) 통과, `npm run lint` 에러 0
- 잔존 native scroll 확인: `grep -rE "overflow-(x|y)-auto" frontend/src` → 의도된 제외(`select.tsx`) 1곳만 매치
- 브라우저 E2E(375px·1280px 가로 스크롤, 다이얼로그 세로 스크롤, 터치 스크롤)는 /qa 단계에서 수행
