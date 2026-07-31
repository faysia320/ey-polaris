# Implementation: 간편결제 연결 계정 — 기준정보 선택화 + 거래별 지정

- 날짜: 2026-07-31
- 기반 명세: `docs/tasks/2026-07-31-easy-pay-per-transaction-link/research.md`

## 변경 파일

### 백엔드

- `backend/app/schemas.py` — `AccountCreate.check_linked_account`에서 easy_pay 필수 조건 제거(비-easy_pay 금지 규칙은 유지), `TransactionCreate.linked_account_id` 추가, `TransactionOut.linked_account_name` 추가, `TransactionLinkPartner.linked_account_name` 추가(재작업), `ImportAccountMapping`의 easy_pay 생성 금지 분기 제거
- `backend/app/models.py` — `Transaction.linked_account_id` nullable FK(accounts.id, RESTRICT)와 `linked_account` relationship 추가, `Account.linked_account_id` 주석을 "선택"으로 갱신
- `backend/alembic/versions/0013_transaction_linked_account.py` — 신규. `transactions.linked_account_id` 컬럼 + FK 추가/제거
- `backend/app/routers/transactions.py` — `_validate_refs`에 건별 연결 검증(계정이 easy_pay일 것·대상은 card|bank·존재), `_settlement_account_name` 헬퍼 + `_to_out` 반영, `list_transactions`의 selectinload에 `linked_account`와 `account.linked_account` 추가. **(재작업)** `_partner_of`가 짝 다리의 귀속 계정 이름도 채우도록 하고, 짝 다리 eager load에 `account.linked_account`·`linked_account` 추가
- `backend/app/routers/accounts.py` — `_validate_linked_account`가 None을 통과시키도록 정리, `update_account`에서 easy_pay → 다른 유형 변경 시 건별 연결이 달린 거래가 있으면 422 거부
- `backend/app/routers/analytics.py` — `_route(account_id, override_id)`로 라우팅 우선순위(건별 > 계정 기본 > 없음) 구현. 현재 잔액·월별 추이 집계 모두 `linked_account_id`까지 그룹핑해 같은 규칙을 공유

### 프론트엔드

- `frontend/src/types.ts` — `Account.linked_account_id` 주석 갱신, `Transaction`에 `linked_account_id`·`linked_account_name`, `TransactionInput`에 `linked_account_id`, `TransactionLinkPartner`에 `linked_account_name`(재작업) 추가
- `frontend/src/stores/masterData.ts` — `AccountInput.linked_account_id` 주석 갱신
- `frontend/src/pages/SettingsPage.tsx` — 연결 계정 필수 검증 제거, `'none'` 센티넬 옵션("선택 안 함 (거래별 지정)") 추가, 라벨을 "기본 연결 계정 (선택)"으로 변경 + 안내 문구, 목록에 미지정 시 "→ 거래별 지정" 표시
- `frontend/src/pages/TransactionsPage.tsx` — `FormState.linked_account_id` 추가 및 `emptyForm`/`openEdit`/`submit` 반영, 선택된 계정이 easy_pay일 때만 "연결 계정 (선택)" Select 노출(후보 = 활성 card|bank), 계정 변경 시 값 초기화, 목록 계정 텍스트를 `accountText()` 공통 헬퍼로 통일(데스크톱 표·모바일 카드·캘린더 상세 3곳), `CREATABLE_ACCOUNT_TYPES` 제거하고 `ACCOUNT_TYPES` 직접 사용
- `frontend/src/pages/TransactionsPage.tsx` **(재작업)** — `BundleLeg`에 `linked_account_name` 추가, `payerText()`(중첩 표기)·`legAccountText()`(단일 계정 표기) 헬퍼 도입. 이체 행·이체 묶음 행은 `출금계정(→결제계정) → 입금계정`, 환불 묶음 행과 묶음 보기 모달의 각 다리는 `계정 → 결제계정`으로 표시
- `frontend/src/pages/AssetsPage.tsx` — `HIDDEN_GROUP_TYPES` → `PASSTHROUGH_GROUP_TYPES`. 무조건 숨김 대신 "그룹의 모든 계정 잔액이 0일 때만 숨김" (조기 반환 포맷은 /qa가 L-3으로 정리)

## 주요 결정

- **필드 이름을 `linked_account_id`로 통일** — Account의 동명 컬럼과 같은 개념이라 이름을 맞췄다. 표시용은 `counter_account_name` 선례를 따라 `linked_account_name`.
- **`linked_account_name`은 "최종 귀속 계정" 이름** — 건별 지정이 있으면 그것, 없으면 간편결제 계정의 기본 연결. 프런트가 두 소스를 조합하지 않고 서버가 준 값 하나만 그리면 되도록 했다(AC-9의 "어느 쪽으로 정해졌든" 요구를 한 필드로 충족).
- **`_route`와 `_settlement_account_name` 모두 계정이 easy_pay인지 먼저 확인** — 유형 변경을 422로 막긴 하지만, 데이터가 어떤 경로로든 어긋났을 때 집계와 표시가 서로 다른 답을 내지 않도록 두 곳의 판정 조건을 일치시켰다.
- **집계 그룹 키에 `linked_account_id`를 추가** — 건별 지정이 같은 계정의 거래를 서로 다른 대상으로 나누므로, `(account_id)` 단독 그룹핑으로는 표현할 수 없다. 현재 잔액과 월별 추이 두 쿼리 모두 동일하게 바꿔 잔액과 추이가 어긋나지 않게 했다.
- **AssetsPage의 노출 판정은 소계가 아니라 개별 잔액** — `+5000`과 `-5000`이 상쇄돼 소계가 0이어도 내역은 봐야 하므로 `group.every((a) => a.balance === 0)`로 판정한다.
- **`CREATABLE_ACCOUNT_TYPES` 상수를 남기지 않고 제거** — 필터가 사라져 `ACCOUNT_TYPES`와 동일해졌고, 의미 없는 별칭을 남기면 "여기엔 제약이 있다"는 오해를 준다. 사유는 사용처 주석으로 옮겼다.
- **(재작업) 이체 행은 괄호 중첩, 그 외는 단일 화살표** — 사용자 확인으로 `출금계정(→결제계정) → 입금계정` 형식을 택했다. 계정이 하나만 나오는 자리(환불 묶음·묶음 보기의 각 다리)는 화살표를 중첩할 이유가 없어 `계정 → 결제계정`으로 편다. 두 규칙을 `payerText`/`legAccountText` 두 헬퍼로 분리해 어느 자리에 어떤 형식을 쓰는지가 호출부에서 드러나게 했다.
- **(재작업) 귀속 계정 이름을 짝 다리 요약에도 실었다** — 병합 행의 앵커는 보통 지출 다리지만, 지출 다리가 현재 조회 범위 밖이면 수입 다리가 앵커가 된다(`displayRows`). 앵커 거래의 `linked_account_name`만 쓰면 그 경우 지출 다리의 귀속 계정을 그릴 수 없어, `TransactionLinkPartner`에도 같은 필드를 추가했다. 검증에서 양방향 모두 확인했다.
- research.md와 다르게 한 것: 없음.

## 자체 검증 결과

**(재작업 1회차) 해소한 QA 이슈: M-1 (Medium)** — 묶음 행·이체 행에서 간편결제 최종 귀속 계정이 표시되지 않아 목록 표시와 자산 집계가 다른 계정을 가리키던 문제. (L-3은 /qa가 직접 수정 완료, L-1·L-2·L-4는 QA가 의도적으로 남긴 잔여 Low)

- 재작업 검증 스크립트(TestClient, 일회용 DB) → **10개 검사 전부 통과, 실패 0**
  - 이체(출금 다리 = 간편결제 + 건별 연결) 응답 `linked_account_name = "M1가카드"` 확인
  - 환불 묶음: 지출 다리(앵커) 자신과, **수입 다리에서 본 짝 요약** 양쪽 모두 `linked_account_name = "M1가카드"` 확인(앵커가 어느 쪽이든 지출 다리의 귀속 계정을 그릴 수 있음). 간편결제가 아닌 다리는 null
  - 집계 정합성: 표시와 같은 계정으로 귀속됨 — 가카드 -20,000(이체 출금 -12,000 + 지출 -8,000), 나카드 +15,000, M1페이 0
- 기존 21개 검사 회귀 스크립트 재실행 → **전부 통과, 실패 0**
- `npm run build` → 통과 / `npm run lint` → 0 errors, 2 warnings(기존과 동일)

### 최초 구현 검증 (1차)

- `docker exec ... alembic upgrade head` (일회용 DB `polaris_migtest`) → **통과**. `0012 → 0013` 적용, `alembic current` = `0013 (head)`
- `alembic downgrade -1` → `0012` → `alembic upgrade head` → `0013 (head)` → **통과** (왕복 확인)
- 백엔드 API 검증 스크립트(TestClient, 일회용 DB) → **21개 검사 전부 통과, 실패 0**. AC-1/2/4/5/6/7/8/9/11과 계정 삭제 RESTRICT(409)를 실제 HTTP 호출로 확인
  - 실측: 간편결제 A페이의 지출 1만(→가카드)·3만(→나카드)·5천(미지정) → 가카드 -10,000 / 나카드 -30,000 / A페이 -5,000. 이후 A페이에 기본 연결(가카드)을 지정하니 가카드 -15,000 / A페이 0으로 이동
  - 총자산 = 계정 잔액 합, 추이 마지막 달 = 총자산 일치 확인
- `ImportAccountMapping(kind='ledger', action='create', type='easy_pay')` 생성 → **통과** (AC-10 백엔드 측)
- `cd frontend && npm run build` → **통과** (tsc -b + vite build, 3672 모듈)
- `cd frontend && npm run lint` → **통과** (0 errors, 2 warnings). 두 warning(`react-hooks/exhaustive-deps`의 openEdit, `react-hooks/incompatible-library`의 useReactTable)은 `git stash`로 변경 전 상태에서도 동일하게 발생함을 확인한 기존 경고다
- 브라우저 E2E(375px 모바일 확인 포함)는 `/qa` 위임

> 참고: 검증 중 `frontend/` 워킹트리에 이 작업과 무관한 SUIT 폰트 마이그레이션 변경(`package.json`, `index.css`, `docs/tasks/2026-07-31-suit-font-migration/`)이 함께 들어와 있었다. 건드리지 않았고, 첫 빌드 실패(`@fontsource-variable/geist` 미해결)는 그 작업의 과도기 상태 때문이었으며 이후 빌드는 정상 통과했다.

## 성공 기준 자가 체크

- [x] AC-1: `POST /accounts {"type":"easy_pay","linked_account_id":null}` → 201, 저장값 null 확인 (검증 스크립트). 설정 화면은 필수 검증 제거 + "선택 안 함" 옵션 추가 — 브라우저 확인은 /qa 위임
- [x] AC-2: card + `linked_account_id` → 422 확인 (검증 스크립트)
- [x] AC-3: `formAccountIsEasyPay`로 easy_pay 선택 시에만 Select 노출, 계정 변경 시 `'none'`으로 초기화, 미선택 저장 허용 — 브라우저 확인은 /qa 위임
- [x] AC-4: 같은 간편결제의 두 지출이 각각 가카드 -10,000 / 나카드 -30,000으로 귀속됨을 `/analytics/assets`로 확인
- [x] AC-5: 미지정 건이 기본 연결 없을 땐 A페이 -5,000으로 남고, 기본 연결 지정 후 가카드로 이동(-15,000)함을 확인
- [x] AC-6: 총자산 = 계정 잔액 합 확인. 그룹 노출 조건은 `group.every(balance === 0)`으로 구현 — 화면 소계 대조는 /qa 위임
- [x] AC-7: 현금 지정 → 422, 간편결제 아닌 계정에 지정 → 422, 없는 계정 → 404 확인
- [x] AC-8: 유형 변경 → 422 및 한국어 안내 메시지 확인
- [x] AC-9: 건별 지정 → "나카드", 미지정 → 기본 연결 "가카드", 간편결제 아닌 거래 → null 확인. 표·모바일 카드·캘린더 상세가 모두 `accountText()` 한 함수를 쓰도록 통일. **(재작업)** 묶음 행·이체 행·묶음 보기 모달까지 최종 귀속 계정을 표시하도록 확장 — 화면 확인은 /qa 위임
- [x] AC-10: 백엔드 스키마가 easy_pay create 매핑을 허용함을 확인. 프런트는 `ACCOUNT_TYPES` 전체 노출 — 마법사 확인은 /qa 위임
- [x] AC-11: 신규 컬럼이 전부 NULL이면 `_route(account_id, None)`이 종전과 동일한 결과를 내며, 추이 마지막 달 = 총자산 일치를 확인. 실데이터 변경 전후 수치 대조는 /qa 위임
- [x] AC-12: `alembic upgrade head` / `downgrade -1` / 재 `upgrade head` 모두 오류 없이 수행
- [x] AC-13: `npm run build`, `npm run lint` 통과
- [ ] AC-14 (모바일): 375px 뷰포트 확인은 /qa 단독 수행 항목 — 구현 측에서는 새 필드를 `col-span-2`로 폭 전체를 쓰게 하고 고정 px 너비를 쓰지 않았음

## 보류/미완 항목

- **잔여 Low (QA가 의도적으로 남긴 것)** — L-1: 건별 연결 대상 계정을 비-linkable 유형으로 바꾸는 역방향 검증이 없음(기존 `accounts.linked_account_id`와 동일한 공백). L-2: 건별 연결 검증이 `is_active`를 보지 않음(계정 기본 연결 검증과 동일). 둘 다 회귀·데이터 손상이 아니며 검증 로직 변경이라 이번 재작업 범위에서 제외했다.
- **작업 트리 오염 (L-4)** — SUIT 폰트 마이그레이션 변경(`index.css`, `EChart.tsx`, `package.json`, `package-lock.json`, `docs/tasks/2026-07-31-suit-font-migration/`)이 같은 트리에 섞여 있다. `/git-commit`에서 커밋 분리 필요.
- 이체(transfer)의 **입금 다리**(`counter_account_id`)가 간편결제인 경우는 건별 지정 대상이 아니며 계정 기본 연결만 적용된다. research.md의 [기술 결정]대로 의도된 한계이며 `models.py` 주석에 명시했다.
- 거래 목록에서 여러 건을 골라 연결 계정을 **일괄 지정**하는 기능은 사용자 결정에 따라 이번 범위에서 제외했다.
