# Implementation: 자산 계정 유형 추가 — 전자금융자산 · 대출 · 보증금

- 날짜: 2026-07-23
- 기반 명세: docs/tasks/2026-07-23-account-types-efinance-loan-deposit/research.md

## 변경 파일
- `backend/app/schemas.py` — `AccountType` Literal에 `e_money`·`deposit`·`loan` 3개 값 추가(한 줄 포맷 → 값별 줄바꿈).
- `backend/app/models.py` — `Account.type` 허용 값 목록 주석 갱신 + 신규 3종 성격 설명 주석 추가.
- `frontend/src/types.ts` — `AccountType` 유니온에 동일 3개 값 추가(각 값에 성격 설명 JSDoc).
- `frontend/src/pages/SettingsPage.tsx` — `ACCOUNT_TYPES` 폼 옵션에 3개 `{value,label}` 추가(전자금융자산/보증금/대출).
- `frontend/src/pages/AssetsPage.tsx` — `ACCOUNT_TYPE_LABEL` 맵에 3개 라벨 추가. 그룹 순서 = 키 순서이므로 대출(부채)을 맨 끝에 배치, 순서 의도 주석 추가.

## 주요 결정
- 내부 값: 전자금융자산=`e_money`, 대출=`loan`, 보증금=`deposit`(research.md의 기술 결정 그대로). 기존 스네이크 컨벤션(`easy_pay`, `real_estate`)과 일치.
- 세 유형 모두 `LINKABLE_TYPES`·`VALUATION_TYPES`·`HIDDEN_GROUP_TYPES`에 **추가하지 않음** → `cash`/`bank`와 동일한 단순 잔액 유형으로 동작(잔액=개설잔액+거래 순증감). 별도 렌더/집계 코드 변경 불필요(AssetsPage 그룹 렌더는 `ACCOUNT_TYPE_LABEL` 키를 순회하므로 자동으로 그룹 카드 생성).
- 대출은 라우터·집계 로직 변경 없이 **음수 개설잔액**만으로 총자산에서 차감됨(`analytics.py` grand_total 단순 합산, `formatKRW`가 음수 정상 출력). research.md 방침대로 자산/부채 분리 UI는 구현하지 않음(최소 변경).
- 그룹 표시 순서: 전자금융자산은 간편결제 뒤, 보증금은 부동산 뒤, 대출은 맨 끝(자산 그룹 아래 부채로 노출). 순서는 구현 재량 항목.
- Alembic 마이그레이션 없음(`type`이 `String(20)`, DB 제약 없음 — 0008 선례). research.md와 동일.

## 자체 검증 결과
- 실행 명령: `cd frontend && npm run build` (tsc -b + vite build) → **통과** (EXIT=0, 3672 modules transformed, 타입 오류 없음). AC-6의 tsc 통과 요건 충족.
- 실행 명령: 백엔드 로컬 env에 `pydantic` 미설치로 앱 임포트 불가 → **AST 정적 검증으로 대체**. `schemas.py`의 `AccountType` Literal 값과 `types.ts` 유니온 값을 파싱해 대조: 양쪽 집합 완전 일치, `{e_money, deposit, loan}` 3개 모두 포함 확인(EXIT=0). 백엔드 런타임 기동은 Docker 환경 필요 → /qa 단계에서 브라우저 E2E와 함께 확인 위임.
- 브라우저 E2E(설정 폼 드롭다운 노출·계정 생성·자산 페이지 그룹·대출 음수 표시·375px 모바일): **/qa 위임** (구현자 자가 E2E는 독립 평가를 대체하지 않음).

## 성공 기준 자가 체크
- [x] AC-1: `ACCOUNT_TYPES`(SettingsPage)에 전자금융자산/보증금/대출 3종 한글 라벨 옵션 추가됨. 실제 폼 노출·저장은 /qa 브라우저 확인.
- [x] AC-2: `AccountType` Literal에 3개 값 추가 → `POST /accounts` 페이로드 검증 통과. 라우터는 easy_pay 외 화이트리스트가 없어 `linked_account_id`는 null 저장. 런타임 201 확인은 /qa 위임.
- [x] AC-3: `e_money`를 VALUATION_TYPES·linked 대상에서 제외 → `analytics.py` 기본 경로(개설잔액+net)로 계산, easy_pay 패스스루 아님. 코드 근거 충족, 실제 잔액 반영은 /qa 확인.
- [x] AC-4: `loan`을 단순 잔액 유형으로 두어 음수 개설잔액이 grand_total에서 차감. AssetsPage에 '대출' 그룹(맨 끝) 추가, formatKRW 음수 출력. 총자산 감소·음수 표시 수치 확인은 /qa 위임.
- [x] AC-5: `deposit`을 비-VALUATION_TYPES로 유지 → 평가액 입력 UI 없이 개설잔액=보증금액으로 가산, '보증금' 그룹(부동산 뒤) 분리 표시. /qa 확인.
- [x] AC-6: 백엔드 Literal == 프론트 유니온(AST 대조 일치), `npm run build`(tsc) 통과.
- [x] AC-7: easy_pay/stock/real_estate/HIDDEN_GROUP_TYPES·LINKABLE_TYPES·VALUATION_TYPES 기존 배열 미변경 → 회귀 없음(코드 diff상 기존 항목 불변). 동작 확인은 /qa 위임.
- [~] AC-8 (모바일): 코드 변경은 라벨/유니온 추가뿐이라 레이아웃 구조 변화 없음(기존 반응형 그룹 카드 재사용). 375px 실측은 /qa 브라우저 위임.

## 보류/미완 항목
- 없음. (백엔드 런타임 기동·브라우저 E2E·375px 모바일 실측은 파이프라인 설계상 /qa 단독 수행 영역)
