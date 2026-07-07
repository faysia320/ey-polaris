# Implementation: 구성원 Select 드롭다운 위치 및 테이블/캘린더 토글 높이 정렬

- 날짜: 2026-07-07
- 기반 명세: docs/tasks/2026-07-07-member-select-dropdown-and-view-toggle-height/research.md

## 변경 파일
- `frontend/src/components/ui/select.tsx` — `SelectContent` 기본 `position`을 `item-aligned` → `popper`, `align`을 `center` → `start`로 변경하고 `sideOffset = 4`를 추가·전달. 드롭다운이 트리거 바로 아래로 뜨도록 함(앱 전역 Select 적용).
- `frontend/src/pages/TransactionsPage.tsx` — 테이블/캘린더 토글 컨테이너에 `h-8` 고정, 두 버튼에 `h-full` 부여. 토글 그룹 외곽 높이를 select 트리거(h-8=32px)와 일치시킴.

## 주요 결정
- **position=popper + sideOffset=4**: research.md의 지시대로 shadcn 표준 popper로 전환. `item-aligned`는 선택 항목을 트리거 위에 겹쳐 정렬해 "위치 이상" 문제의 원인이었음. 컴포넌트에 이미 popper용 translate 클래스가 존재해 재사용됨. `sideOffset=4`로 트리거와 목록 사이 간격 확보.
- **align=start**: research 영향도 분석의 "좁은 트리거(w-28/w-32)에서 목록 정렬 자연스러움 확인" 항목을 반영. center 대신 start로 두면 목록 좌측이 트리거 좌측에 맞아 좁은 트리거에서도 어긋나 보이지 않음. 뷰포트의 `min-w-(--radix-select-trigger-width)`가 popper에서 목록 최소 너비를 트리거 폭 이상으로 보장.
- **토글 높이**: 기존 컨테이너(`border p-0.5` + `size="sm"` h-7 버튼)는 외곽 ~34px였음. 컨테이너에 `h-8`(border-box 32px)을 고정하고 버튼을 `h-full`로 padding 안쪽을 채워, 외곽 측정 높이가 정확히 32px가 되도록 함. 버튼의 sm 스타일(rounded/text/svg 크기)은 유지하고 높이만 override(twMerge로 h-7 → h-full 대체).

## 자체 검증 결과
- 실행 명령: `npm run build` (tsc -b && vite build) → **통과**. 타입 에러 0, 빌드 성공(3672 modules). 청크 크기 경고는 기존부터 존재하던 것으로 본 변경과 무관.
- 브라우저 E2E(드롭다운 위치·높이 픽셀 비교·375px 뷰포트): **/qa 위임** (구현 단계 역할 아님).

## 성공 기준 자가 체크
- [x] AC-1: `SelectContent` position이 popper(side=bottom 기본)로 바뀌어 드롭다운이 트리거 아래로 표시됨 — 코드 확인. 최종 픽셀 위치 확인은 /qa.
- [x] AC-2: `select.tsx`의 `SelectContent` 기본 `position = "popper"`로 설정, 어떤 사용처도 개별 수정 불필요(모든 사용처가 position 미지정) — 코드 확인 + `npm run build` 통과.
- [x] AC-3: 토글 컨테이너 `h-8`(32px) 고정 + 버튼 `h-full` → 외곽 높이가 MemberFilterSelect 트리거 h-8과 동일 — 코드 확인. 실측 비교는 /qa.
- [x] AC-4(모바일): 헤더 줄은 기존 `flex flex-wrap`로 줄바꿈 허용, 이번 변경은 높이/드롭다운 위치만 조정해 375px 레이아웃을 넓히지 않음 — 코드 확인. 브라우저 375px 확인은 /qa.
- [x] AC-5: Select 값 선택/표시/스크롤 버튼 구조는 미변경, position만 조정 — 코드 확인 + 빌드 통과. 실동작은 /qa.

## 보류/미완 항목
- 없음.
