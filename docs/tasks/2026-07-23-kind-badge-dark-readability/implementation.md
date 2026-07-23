# Implementation: 지출/수입 구분 뱃지 다크모드 가독성 개선

- 날짜: 2026-07-23
- 기반 명세: docs/tasks/2026-07-23-kind-badge-dark-readability/research.md

## 변경 파일
- `frontend/src/pages/TransactionsPage.tsx` — 무채색 변형 매핑 `KIND_BADGE_VARIANT`를 의미색 틴트 className 매핑 `KIND_BADGE_CLASS`로 교체하고, 세 call site(테이블/모바일 카드/요약 리스트)에서 `<Badge variant="outline" className={KIND_BADGE_CLASS[kind]}>`로 주입. (추가 요청분) 금액 테이블 컬럼 우측 정렬 + 지출/수입 내역 금액 3곳에서 "원" 접미사 제거(`formatKRW→formatNumber`).

## 추가 변경 (계약 외 — 사용자 직접 요청)
research.md의 AC 계약과 별개로, 구현 중 사용자가 직접 요청한 소규모 변경이 같은 파일에 함께 반영되어 있다. 추적성을 위해 명시한다.
- 요청 원문: "지출/수입내역 금액 컬럼값을 우측 정렬로 변경해주고 '원'표시 삭제"
- `TransactionsPage.tsx` — 금액 컬럼 헤더 버튼 `w-full justify-end`, 셀 span `block text-right tabular-nums` (데스크톱 테이블 우측 정렬). 지출/수입 내역 금액 3곳(테이블·모바일 카드·요약 리스트)의 `formatKRW`를 `formatNumber`로 교체해 "원" 제거. 부호(+/−)·의미색·자산평가/엑셀 프리뷰 금액은 불변.
- 이 변경은 위 AC-1~AC-6이 아니라 사용자 요청 자체를 계약으로 삼는다(검증: 육안 우측 정렬·"원" 미표기 + build/lint 통과).

## 주요 결정
- 색 매핑을 금액 텍스트(`kindAmountClass`)와 동일 계열로 통일: 수입=emerald, 지출=rose, 이체=sky. 색 언어 일관성 확보.
- 틴트 값: `bg-{color}-500/15 text-{color}-300 border-{color}-500/25`. 배경 opacity 15%(사용자 확정 "~15%"), 글자는 -300 셰이드로 다크 배경 위 가독성을 -400보다 높임(구현 재량 범위). 테두리는 동일 계열 25% 불투명도로 은은하게.
- base로 `variant="outline"`을 유지해 뱃지 형태(h-5·rounded·border 존재·w-fit)를 보존하고, tailwind-merge가 outline의 `border-border`/`text-foreground`를 새 색 유틸로 대체하도록 함. 배경(bg-*)은 outline에 없어 그대로 적용.
- 공용 `badge.tsx`는 미수정 — 다른 뱃지 사용처(Dashboard/Assets/Settings/import 프리뷰) 무영향.
- research.md AC와의 차이: 뱃지 색 작업은 차이 없음(셰이드/opacity만 구현 재량으로 확정). 단, "추가 변경" 섹션의 금액 우측 정렬·"원" 제거는 원래 AC에 없던 사용자 직접 요청분이다.
- "원" 제거 구현: 신규 헬퍼를 만들지 않고 기존 `format.ts`의 `formatNumber`(단위 없는 천단위 포맷)를 재사용한다. (QA 지적 반영 — 초기엔 중복 `formatAmount`를 추가했으나 `formatNumber`와 동일해 제거·통합.)

## 자체 검증 결과
- 실행 명령: `npm run build` (tsc + vite) → 통과 (3672 modules, built in 1.21s, 타입/컴파일 에러 0).
- 실행 명령: `npm run lint` (eslint) → 통과 (0 errors). 경고 2건은 `TransactionsPage.tsx:332`(useMemo deps)·`:335`(TanStack Table incompatible-library)로 이번 변경과 무관한 기존 경고(줄번호는 추가 변경 후 기준).
- 브라우저 E2E 확인은 /qa 위임 (AC-1~AC-5의 육안·375px 렌더 확인).

## 성공 기준 자가 체크
- [x] AC-1: 3종 뱃지가 emerald/rose/sky 의미색으로 매핑됨 (`KIND_BADGE_CLASS`). 금액 텍스트와 동일 계열 — 코드 근거 확보, 육안 확인은 /qa.
- [x] AC-2: 반투명 배경(`/15`) + 밝은 글자(`text-*-300`) + 약한 테두리(`/25`) 틴트 적용. 무채색 변형 제거, 지출도 배경색을 가져 동화되지 않음 — /qa 육안 확인.
- [x] AC-3: 세 call site 모두 동일 `KIND_BADGE_CLASS` 참조 → 동일 색. 코드상 단일 출처 확인.
- [x] AC-4: 라벨(`KIND_LABEL`) 미변경, base `variant="outline"` 유지로 h-5·rounded·w-fit 형태 보존.
- [x] AC-5(모바일): 색만 변경, 레이아웃 클래스 불변 → 375px 영향 없음. 브라우저 확인은 /qa 위임.
- [x] AC-6: build·lint 통과(에러 0) 확인.

## 보류/미완 항목
- 없음
