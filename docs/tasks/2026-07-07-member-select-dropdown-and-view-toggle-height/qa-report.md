# QA Report: 구성원 Select 드롭다운 위치 및 테이블/캘린더 토글 높이 정렬

- 날짜: 2026-07-07
- 작업 폴더: `C:\WorkSpace\repos\ey-polaris\docs\tasks\2026-07-07-member-select-dropdown-and-view-toggle-height`
- 판정: PASS

## 개요
계약: 위 폴더의 `research.md` (AC-1 ~ AC-5). 변경 파일 2개:
- `frontend/src/components/ui/select.tsx` — `SelectContent` 기본값 `position="popper"`, `align="start"`, `sideOffset=4`. Viewport className에서 무의미 표현식(`position === "popper" && ""`) 제거.
- `frontend/src/pages/TransactionsPage.tsx:450-463` — 토글 컨테이너에 `h-8`, 두 버튼에 `className="h-full"`.

동적 검증 환경: dev 서버(http://localhost:5173, Vite HMR = 워킹 트리 반영) 기동 중. 브라우저 도구로 지출/수입 내역 페이지를 직접 조작. 이번 세션의 렌더 뷰포트는 **모바일 리짐**으로 고정됨(하단 모바일 네비게이션 바 표시 + 헤더가 `flex-col`로 세로 적층 → CSS 폭 <640px. 스크린샷은 759px, DPR≈2 → CSS ≈379px). 따라서 데스크톱 폭 강제는 불가했으나 375px급 모바일 동적 검증은 전 과정에서 수행됨.

## 성공 기준 채점
- ✅ AC-1: 구성원 필터 Select를 브라우저에서 클릭해 열었을 때, 드롭다운 목록(전체/으니/영이)이 트리거를 덮지 않고 트리거 **바로 아래**(side=bottom, 좌측 정렬 align=start)에 표시됨을 스크린샷으로 확인.
- ✅ AC-2: `select.tsx:63` `position = "popper"` 기본값 확인. 앱 내 어떤 사용처도 `position`을 명시하지 않아 전역 적용. `npm run build`(tsc -b && vite build) 성공(3672 modules, "✓ built", 타입 에러 0) — 직접 실행.
- ✅ AC-3: 토글 컨테이너(`div.flex.h-8...border.p-0.5`)와 `MemberFilterSelect` 트리거(size 미지정 → `data-[size=default]:h-8`) 모두 `h-8`=32px. Tailwind preflight의 border-box로 border/padding 포함 외곽 높이가 양쪽 모두 정확히 32px로 결정론적 일치. 헤더 확대(zoom) 스크린샷에서 두 요소 상·하단 모서리 일치 확인. 버튼은 `h-full`로 컨테이너 내부(≈26px)를 채움.
- ✅ AC-4(모바일): 세션 렌더 뷰포트가 모바일 리짐(CSS <640px, ≈379px)으로 고정된 상태에서 직접 확인. 헤더가 세로 적층되고 액션 줄(`flex flex-wrap`)이 자연스럽게 줄바꿈되며 가로 스크롤·요소 겹침·잘림 없음. 동일 폭에서 드롭다운을 열었을 때 목록(w-32≈128px)이 화면 안에 온전히 표시됨(잘림 없음). 정확히 375.0px 값은 이 환경에서 뷰포트를 임의 폭으로 강제할 수 없어 핀포인트하지 못했으나, 동일 breakpoint 리짐(<640px)에서 오버플로 유발 요소가 없음을 동적으로 확인.
- ✅ AC-5: 구성원 필터에서 "으니" 선택 → 트리거에 "으니" 반영, 목록 정상 닫힘. 이후 "전체"로 재선택하여 상태 원복(테스트 데이터 정리) 및 회귀 없음 확인.

## 검증 시나리오
- `npm run build` (frontend) — 성공, tsc/vite 에러 없음(청크 크기 경고는 기존 사항, 이번 변경과 무관).
- 브라우저 E2E (localhost:5173/transactions):
  1. 구성원 Select 열기 → 드롭다운이 트리거 아래에 표시(AC-1)
  2. "으니" 선택 → 트리거 반영·목록 닫힘(AC-5) → "전체"로 원복(정리)
  3. 헤더 영역 zoom → select 트리거와 토글 그룹 외곽 높이 일치(AC-3)
  4. 모바일 리짐에서 헤더 오버플로/겹침 없음, 드롭다운 화면 내 표시(AC-4)
- 콘솔 에러 점검: 앱 관련 에러 없음("A listener indicated an asynchronous response ... message channel closed" 5건은 브라우저 확장 프로그램 노이즈).
- `git status --short` 확인: 의도한 2개 파일 + 작업 폴더만 변경, `frontend/dist`는 gitignore 처리(빌드 부작용으로 추적 파일 변경 없음).

## 발견 이슈
코드 결함(High/Medium/Low) 0건. 아래는 결함이 아닌 관찰 사항.
- [관찰] `TransactionsPage.tsx:453-462` — 토글 버튼은 `size="sm"`의 `h-7`를 남기고 `className="h-full"`로 높이만 덮어쓴다. `cn`(tailwind-merge)이 `h-7`↔`h-full` 충돌을 마지막 값으로 정리하므로 정상 동작하나, `size="sm"`이 부여하는 `text-[0.8rem]`·아이콘 `size-3.5`는 유지되어 "높이 32px + 컴팩트 글자/아이콘" 형태다. 의도된 시각이며 문제 없음.
- [관찰] `select.tsx` 전역 기본값 변경은 앱의 모든 Select에 영향(계약상 의도된 동작). popper 전환으로 `data-[align-trigger=true]:animate-none` 분기는 더 이상 트리거되지 않고 slide/zoom 애니메이션이 적용되나, 공간 부족 시 Radix 충돌 회피로 위로 뒤집히므로(AC-1 예외 조건과 일치) 시각적 회귀 없음.

## 다음 단계
PASS: `/git-commit` 진행 가능.
