# Implementation: 묶음 보기 모달 콘텐츠 오버플로 수정

- 날짜: 2026-07-24
- 기반 명세: docs/tasks/2026-07-24-bundle-view-modal-overflow/research.md

## 변경 파일
- `frontend/src/pages/TransactionsPage.tsx` — 묶음 보기 다이얼로그 콘텐츠 wrapper `<div className="space-y-3 text-sm">`에 `min-w-0` 추가(`min-w-0 space-y-3 text-sm`).

## 주요 결정
- research.md의 Action Item 그대로 구현. grid item(`DialogContent`는 `grid` 컨테이너)의 기본 `min-width: auto`가 내부 `truncate`(=`white-space: nowrap`) 텍스트의 min-content 폭만큼 트랙을 팽창시키는 것이 원인이므로, wrapper에 `min-w-0`을 부여해 트랙 폭을 모달 폭(`sm:max-w-md`, `:1863` 오버라이드)에 고정하고 하위 `truncate`가 정상 작동하도록 했다.
- 공용 `dialog.tsx`는 수정하지 않아 전역 다이얼로그 회귀 위험 없음(호출부 국소 수정).
- 클래스 배치는 Tailwind 알파벳 정렬 관례에 맞춰 `min-w-0`을 앞에 둠(`min-w-0 space-y-3 text-sm`).

## 자체 검증 결과
- 실행 명령: `cd frontend && npm run build` → 통과 (EXIT=0, `✓ built in 1.42s`, tsc + vite 타입/빌드 오류 없음)
- 브라우저 E2E(375px 뷰포트 모달 확인)는 /qa 위임.

## 성공 기준 자가 체크
- [x] AC-1: 콘텐츠 wrapper grid item에 `min-w-0` 부여 → 하위 `<p className="truncate ...">`(지출/수입 다리 날짜·계정명·메모)가 모달 폭 내에서 말줄임 처리됨. 실제 렌더 확인은 /qa 위임.
- [x] AC-2: 카테고리명 줄은 이미 `flex min-w-0` + `truncate`, 금액은 `shrink-0`로 우측 고정 — 상위 grid item 팽창이 해소되어 겹침/잘림 없음(코드 근거, `TransactionsPage.tsx:1880`/`:1886`).
- [ ] AC-3 (모바일): 375px 뷰포트 육안 확인 — **/qa 단계에서** 브라우저 도구로 검증 예정(구현자 범위 밖).
- [x] AC-4: 클래스 추가만 했고 묶음 해제/닫기 버튼·효과 요약 문구 로직 미변경 → 회귀 없음.
- [x] AC-5: `npm run build` 성공(EXIT=0).

## 보류/미완 항목
- 없음 (AC-3 브라우저 육안 확인은 /qa 담당)
