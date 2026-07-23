# Research: 지출/수입 구분 뱃지 다크모드 가독성 개선

- 날짜: 2026-07-23
- 요청 원문: 지출/수입 내역의 구분 뱃지가 다크모드 테마인 지금 앱에서 보기에 가독성이 좋지 않아. 색상을 다시 고민해줘

## 요약
거래 내역의 구분 뱃지(수입/지출/이체)는 `secondary`/`outline`/`default` shadcn 변형에 매핑되어 있는데(`TransactionsPage.tsx:96-100`), 앱 테마가 채도 0의 완전 회색조(`index.css:86-118`)라 세 뱃지가 모두 회색 계열로 렌더되어 서로 구별이 어렵다. 특히 지출의 `outline` 변형은 다크모드에서 테두리가 흰색 10% 불투명도(`badge.tsx:17-18`, `--border: oklch(1 0 0 / 10%)`)라 배경과 거의 동화되어 가독성이 가장 나쁘다. 반면 같은 행의 금액 텍스트는 이미 의미색(수입=emerald, 지출=rose, 이체=sky)을 사용하고 있어(`TransactionsPage.tsx:107-108`) 뱃지만 이 색 언어와 어긋난다. 해결 방향은 구분 뱃지를 금액 텍스트와 동일한 의미색으로 통일하되, 다크모드에서 은은한 틴트(반투명 색상 배경 + 밝은 동일 계열 글자) 스타일을 적용하는 것이다. 앱은 다크 전용(`index.html:2` `class="dark"`, `main.tsx:8` 강제)이므로 라이트모드는 고려 대상이 아니다.

## 관련 파일 및 근거
- `frontend/src/pages/TransactionsPage.tsx:96-100` — `KIND_BADGE_VARIANT` 정의. 구분 뱃지 색의 단일 출처(single source of truth). income→secondary, expense→outline, transfer→default.
- `frontend/src/pages/TransactionsPage.tsx:266-268` — 데스크톱 테이블 '구분' 컬럼 뱃지 렌더 (call site 1).
- `frontend/src/pages/TransactionsPage.tsx:693` — 모바일 카드 리스트 뱃지 렌더 (call site 2).
- `frontend/src/pages/TransactionsPage.tsx:809` — 필터/요약 하단 리스트 뱃지 렌더 (call site 3). 세 곳 모두 `KIND_BADGE_VARIANT[kind]` + `KIND_LABEL[kind]`를 읽으므로 매핑만 바꾸면 일괄 반영된다.
- `frontend/src/pages/TransactionsPage.tsx:107-108` — `kindAmountClass`: 수입=`text-emerald-400`, 지출=`text-rose-400`, 이체=`text-sky-400`. 뱃지 색이 맞춰야 할 기존 색 언어.
- `frontend/src/components/ui/badge.tsx:7-28` — `badgeVariants` cva 정의. Badge는 `className`을 `cn()`으로 병합(`:43`)하므로 변형 대신 색 유틸 클래스를 직접 주입할 수 있다.
- `frontend/src/index.css:86-118` — `.dark` 토큰. 전부 채도 0(회색조)이라 무채색 변형끼리 구별 불가한 근본 원인.
- `frontend/src/lib/format.ts:6-10` — `KIND_LABEL`(수입/지출/이체). 라벨은 변경 없음.
- `frontend/index.html:2`, `frontend/src/main.tsx:8` — 다크 전용 강제. 라이트모드 미고려 근거.

## 영향도
- 변경은 `TransactionsPage.tsx`의 뱃지 색 매핑 1곳에 국한된다. 세 call site가 동일 매핑을 참조하므로 부작용 없이 일괄 반영.
- `KIND_BADGE_VARIANT`는 `TransactionsPage.tsx` 외부에서 import되지 않음(grep 확인) — 다른 페이지 영향 없음.
- `badge.tsx`(공용 컴포넌트)는 **수정하지 않는다**. className 주입 방식이면 공용 변형에 손대지 않아 다른 뱃지 사용처(Dashboard/Assets/Settings/import 프리뷰)에 영향 없음.
- `TransactionCalendar.tsx`는 구분 뱃지를 렌더하지 않음(kind 값은 집계에만 사용, `:33-35`) — 영향 없음.
- 금액 텍스트 색(`kindAmountClass`)은 그대로 두어 뱃지와 색 언어가 일치하게 한다.

## 성공 기준 (Acceptance Criteria)
- [ ] AC-1: 구분 뱃지 3종이 각각 의미색으로 렌더된다 — 수입=녹색(emerald) 계열, 지출=적색(rose) 계열, 이체=청색(sky) 계열. 확인: `/qa`에서 거래 내역 화면을 브라우저로 열어 세 뱃지의 색이 서로 다르고 금액 텍스트 색과 같은 계열임을 확인.
- [ ] AC-2: 각 뱃지는 반투명 색상 배경 + 동일 계열 밝은 글자(은은한 틴트) 스타일이며, 다크 배경에서 글자가 명확히 읽힌다(무채색 회색 뱃지 잔존 없음, 지출 뱃지가 배경과 동화되지 않음). 확인: `/qa`에서 세 뱃지를 육안 확인하고, 특히 지출 뱃지가 이전처럼 테두리만 남아 흐릿하지 않은지 확인.
- [ ] AC-3: 세 call site(테이블 `:266`, 모바일 카드 `:693`, 요약 리스트 `:809`) 모두 동일한 새 색으로 표시된다. 확인: 데스크톱 테이블 뷰와 모바일 카드 뷰 각각에서 동일 kind의 뱃지 색이 일치함을 확인.
- [ ] AC-4: 뱃지 라벨(수입/지출/이체)과 기존 뱃지 크기·모양(높이 h-5, 라운드, 폭 w-fit)은 변경되지 않는다. 확인: 렌더 결과에서 라벨 텍스트와 뱃지 형태가 이전과 동일한지 확인.
- [ ] AC-5 (모바일): 375px 뷰포트에서 구분 뱃지 3종이 가로 스크롤·요소 겹침·잘림 없이 표시되고 글자가 읽힌다 — `/qa` 단계에서 브라우저 도구로 확인.
- [ ] AC-6: `npm run build`(tsc + vite)와 `npm run lint`가 통과한다. 확인: 두 명령 실행 결과 에러 0.

## Action Items
- [ ] `TransactionsPage.tsx:96-100`의 `KIND_BADGE_VARIANT`(shadcn 변형 매핑)를, kind별 의미색 유틸 클래스 매핑으로 대체한다 (예: 수입=emerald/지출=rose/이체=sky 계열의 반투명 배경 + 밝은 글자 + 약한 동일 계열 테두리).
- [ ] 세 call site(`:266`, `:693`, `:809`)에서 Badge에 새 매핑의 className을 주입한다. 기존 `variant` 대신 색 className을 전달하되, 배경을 직접 지정하므로 형태 유지를 위해 필요한 base 변형(예: `outline`) 선택은 구현 재량.
- [ ] 공용 `badge.tsx`는 수정하지 않는다(다른 사용처 무영향 보장).
- [ ] `npm run build` / `npm run lint`로 검증.

## 결정 사항 및 출처
- [사용자 확인] 채우기 스타일 → "은은한 틴트": 반투명 색상 배경(opacity ~15% 수준) + 동일 계열 밝은 글자 + 약한 테두리. → AC-2에 반영.
- [기술 결정] 색상 매핑 → 수입=emerald, 지출=rose, 이체=sky: 기존 금액 텍스트 색(`TransactionsPage.tsx:107-108`)과 동일 계열로 통일해 색 언어 일관성 확보. → AC-1에 반영.
- [기술 결정] 라이트모드 미지원: 앱이 다크 전용(`index.html:2`, `main.tsx:8`)이므로 다크 기준으로만 색을 튜닝. `.dark:` 변형 없이 다크 화면에 맞는 값 직접 지정 가능.
- [기술 결정] 구현 방식 → 공용 `badge.tsx` 변형 추가 대신 `TransactionsPage` 로컬 className 매핑 주입: 사용처가 이 페이지로 국한되어 공용 컴포넌트에 손대지 않는 편이 부작용이 적다. 정확한 Tailwind 셰이드(예: text-300 vs 400, 배경 opacity 정확값, 테두리 유무)는 다크 가독성 목표를 만족하는 선에서 구현 재량.

## 미해결 질문
- 없음
