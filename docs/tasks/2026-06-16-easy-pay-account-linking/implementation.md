# Implementation: 간편결제(easy_pay) 계정 유형 추가 및 연결 카드/계좌 기반 자산 집계 구분

- 날짜: 2026-06-16
- 기반 명세: docs/tasks/2026-06-16-easy-pay-account-linking/research.md

## 변경 파일

### 백엔드
- `backend/app/models.py` — `Account`에 `linked_account_id`(자기참조 FK, RESTRICT, nullable)와 `linked_account` self relationship(`remote_side=[id]`) 추가. `type` 주석에 easy_pay 반영.
- `backend/app/schemas.py` — `AccountType`에 `"easy_pay"` 추가. `AccountCreate`에 `linked_account_id` 필드 + `model_validator`(easy_pay면 필수, 그 외 유형이면 None 강제). `UsageSource` 모델 추가, `AccountBalance`에 `usage_breakdown: list[UsageSource]` 추가.
- `backend/alembic/versions/0008_easy_pay_linked_account.py` — 신규. `accounts.linked_account_id` 컬럼 + 자기참조 FK(`fk_accounts_linked_account_id_accounts`) 추가/제거. `down_revision="0007"`.
- `backend/app/routers/accounts.py` — `LINKABLE_TYPES=("card","bank")`, `_validate_linked_account()` 추가(존재·유형·자기참조 DB 검증). create/update에서 호출.
- `backend/app/routers/analytics.py` — `assets()`에 easy_pay 패스스루: `link_target` 맵 + `_route()`로 net·월별 net을 연결 계정으로 귀속. `expense_by_account`·`easy_by_target`로 카드/은행별 `usage_breakdown`(직접 사용 + 채널별) 산출.

### 프론트엔드
- `frontend/src/types.ts` — `AccountType`에 `'easy_pay'`, `Account.linked_account_id`, `UsageSource` 인터페이스, `AccountBalance.usage_breakdown` 추가.
- `frontend/src/stores/masterData.ts` — `AccountInput.linked_account_id` 추가.
- `frontend/src/pages/SettingsPage.tsx` — `ACCOUNT_TYPES`에 간편결제, `LINKABLE_TYPES`. `AccountsTab`에 연결 계정 상태/Select(easy_pay일 때만, card|bank·자기 제외 필터), 제출 검증, 테이블에 연결 계정명 표시.
- `frontend/src/pages/AssetsPage.tsx` — `ACCOUNT_TYPE_LABEL`에 easy_pay, `HIDDEN_GROUP_TYPES`로 easy_pay 그룹 비노출, 계정 카드 내부에 `usage_breakdown` 분해 렌더.

## 주요 결정

- **패스스루 라우팅 위치**: 거래 데이터는 불변. 집계 시점(`analytics.assets`)에만 `_route()`로 easy_pay 거래 net을 연결 계정으로 옮긴다. 이로써 easy_pay 계정 잔액은 `opening_balance`로 수렴하고 총합(grand_total/total/trend)은 금액 이동만 발생해 보존된다 (AC-7).
- **분해 = 부호 있는 '잔액 구성'(QA 후 사용자 피드백 반영, 2026-06-16)**: 최초엔 '지출 합계(절대값)'로 구현했으나, 상단 잔액과 분해 합이 달라 혼란을 준다는 피드백에 따라 **합이 정확히 balance와 일치하는 부호 있는 잔액 구성**으로 변경. `balance = 개설 잔액 + 직접 사용(net) + Σ 간편결제 채널(net) + 입금·이체(net)`. 각 항목은 라우팅 전 원본 `account_id`의 `_signed_amount` 부호합(`signed_by_account`)·이체 입금 다리(`bridge_by_account`)·`opening_balance`로 구성한다. 0인 개설잔액/입금·이체 항목은 생략하되 합은 그대로 유지. 평가액 기반 계정(`history` 존재)은 net과 무관하므로 분해를 만들지 않는다(카드/은행은 통상 해당 없음). 프론트 헤더는 '잔액 구성', 음수 항목은 rose 색으로 표시.
- **transfer 엣지케이스**: research 권장대로 단순·일관 우선 — `_route()`를 net/counter/월별 모든 경로에 동일 적용. easy_pay 계정이 이체에 쓰이는 비정상 케이스도 연결 계정으로 동일 귀속된다.
- **AC-5(비-easy_pay + linked)**: '무시'가 아닌 '거부'(422)를 택함 — 스키마 `model_validator`가 강제. 프론트는 easy_pay가 아닐 때 항상 `linked_account_id=null`로 전송해 정상 흐름에서는 위반이 발생하지 않는다.
- **easy_pay 자산 페이지 비노출**: 패스스루로 잔액 0이 되어 별도 그룹 노출이 혼란스러우므로 `HIDDEN_GROUP_TYPES`로 그룹 렌더에서 제외(AC-10). 설정 탭에서는 정상 관리 가능.

## 자체 검증 결과

- `cd frontend && npm run build` (tsc + vite) → **통과** (기존 chunk-size 경고만, 오류 없음)
- `cd frontend && npm run lint` → **통과** (0 errors; `TransactionsPage.tsx`의 사전 존재 경고 2건은 변경과 무관)
- `python -m py_compile` (models/schemas/accounts/analytics/0008 마이그레이션) → **통과** (구문 오류 없음)
- 백엔드 런타임 import/API 동작: 로컬에 backend 의존성(fastapi 등) 미설치(Docker 전제)로 실행 불가. 마이그레이션 적용·API 응답·DB FK 동작 검증은 **/qa 단계로 위임**.
- 브라우저 E2E(설정 폼·자산 페이지 분해·375px 모바일): implement 단계 역할이 아니므로 **/qa 위임**.

## 성공 기준 자가 체크

- [x] AC-1: `0008` 마이그레이션이 `linked_account_id` 컬럼 + 자기참조 FK(RESTRICT) 추가, downgrade에서 제거. (실제 `upgrade head` 적용 확인은 /qa)
- [x] AC-2: `easy_pay`가 백엔드 `AccountType`·프론트 `AccountType` 양쪽에 존재. tsc 빌드 통과로 타입 정합 확인.
- [x] AC-3: easy_pay에 `linked_account_id` 없으면 `model_validator`가 ValueError → 422.
- [x] AC-4: 라우터 `_validate_linked_account`가 존재(404)·유형 card|bank(422)·자기참조(422) 거부.
- [x] AC-5: 비-easy_pay + linked는 `model_validator`가 422로 거부.
- [x] AC-6: `_route()`가 easy_pay net을 연결 계정으로 귀속, easy_pay 잔액은 opening_balance 유지. (수치 확인 /qa)
- [x] AC-7: 라우팅은 금액 '이동'만 하므로 총합 보존(이중계상·누락 없음). 코드상 모든 net 경로에 동일 `_route` 적용.
- [x] AC-8: `AssetsOut.accounts[].usage_breakdown`이 직접/채널별 지출을 구분 제공.
- [x] AC-9: AssetsPage 카드 내부에 '사용 출처' 분해 라인 렌더. (브라우저 확인 /qa)
- [x] AC-10: `HIDDEN_GROUP_TYPES`로 easy_pay 그룹 비노출. (브라우저 확인 /qa)
- [x] AC-11: easy_pay 선택 시 연결 Select 노출, 후보 card|bank 필터. (브라우저 확인 /qa)
- [x] AC-12: 연결 미선택 시 submit에서 폼 에러 반환. (브라우저 확인 /qa)
- [x] AC-13: build·lint 통과, 백엔드 py_compile 통과.
- [x] AC-14(모바일): 분해 라인은 `flex justify-between` + `truncate`/`shrink-0`, Select는 `w-full` — 375px 가로 오버플로 방지 설계. (375px 실측 /qa)

## 보류/미완 항목

- 백엔드 런타임/마이그레이션/모바일 실측은 로컬 환경 제약으로 /qa에 위임(위 자체 검증 참조). 코드 수준 근거는 모두 확보.
