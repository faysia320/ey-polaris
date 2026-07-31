# Research: 간편결제 연결 계정 — 기준정보 선택화 + 거래별 지정

- 날짜: 2026-07-31
- 요청 원문: 기준정보관리의 자산계정에서 간편결제는 연결되는 카드나 은행 계정을 지정하도록 되어있는데 이게 필수가 아니었으면 좋겠어. 기준정보로 고정할수있는 간편결제가 있는가하면 어떤건 지출/수입 내역에서 건건 별로 지정해야할게 있어. 즉 A라는 간편결제가 어떤 거래건은 연결계정이 "가" 카드고 어떤건 "나"카드 일 수 있다는거야. 이게 가능하게 해줘

## 요약

현재 간편결제(`easy_pay`) 계정은 계정 단위로 연결 계정 1개(`accounts.linked_account_id`)를 **필수**로 갖는다 — 스키마 검증(`backend/app/schemas.py:53-62`)과 프론트 폼 검증(`frontend/src/pages/SettingsPage.tsx:317`) 양쪽에서 강제된다. 자산 집계는 이 계정 단위 연결만 보고 easy_pay 거래의 net을 연결 계정으로 귀속시키는 패스스루 라우팅을 수행한다(`backend/app/routers/analytics.py:160-188`, `240-257`). 그래서 "같은 간편결제인데 거래마다 결제 카드가 다르다"를 표현할 방법이 없다.

해결 방향은 두 축이다. (1) 계정 단위 연결을 **선택**으로 완화한다 — DB 컬럼은 이미 nullable이므로 스키마·프론트 검증만 푼다. (2) 거래에 **건별 연결 계정** 컬럼을 새로 추가하고(`transactions.linked_account_id`, nullable FK), 자산 집계 라우팅 우선순위를 `거래 건별 지정 > 계정 기본 연결 > 라우팅 없음`으로 바꾼다. 라우팅되지 않은 거래의 net은 간편결제 계정 자체에 남아 잔액이 0이 아니게 되므로, 자산 상태 페이지가 easy_pay 그룹을 무조건 숨기던 규칙(`frontend/src/pages/AssetsPage.tsx:48,477`)도 "잔액 0이 아니면 노출"로 완화해야 총자산과 그룹 카드 합계가 계속 일치한다.

부수적으로, 연결 계정이 선택이 되면서 엑셀 업로드 매핑 스텝의 "간편결제 계정 생성 금지" 제약(`backend/app/schemas.py:390-394`, `frontend/src/pages/TransactionsPage.tsx:146`)의 근거가 사라지므로 함께 해제한다.

## 관련 파일 및 근거

### 백엔드

- `backend/app/models.py:56-68` — `Account.linked_account_id` 자기참조 FK(RESTRICT, nullable)와 relationship. 컬럼 자체는 이미 nullable이라 완화에 DDL 변경 불필요
- `backend/app/models.py:120-157` — `Transaction` 모델. 건별 연결 계정 컬럼을 추가할 위치. `counter_account_id`가 이체 전용 FK의 선례(RESTRICT, nullable)
- `backend/app/schemas.py:53-62` — `AccountCreate.check_linked_account` — easy_pay일 때 `linked_account_id` **필수** 강제. 이 규칙의 필수 절만 제거 대상 (비-easy_pay는 연결 금지 유지)
- `backend/app/schemas.py:97-112` — `TransactionCreate` — 건별 연결 계정 필드를 추가할 스키마. `TransactionUpdate`가 이를 상속
- `backend/app/schemas.py:134-146` — `TransactionOut` — 목록 표시용 연결 계정 이름을 실어야 함(`counter_account_name`이 선례)
- `backend/app/schemas.py:374-395` — `ImportAccountMapping.check_action` — `type == "easy_pay"`면 업로드 생성 거부. 해제 대상
- `backend/app/routers/accounts.py:11-28` — `LINKABLE_TYPES = ("card", "bank")`와 `_validate_linked_account` (존재·유형·자기참조 DB 검증). 거래별 연결 검증도 이 상수를 공유해야 함
- `backend/app/routers/accounts.py:46-54` — `update_account` — 계정 유형을 easy_pay에서 다른 유형으로 바꾸는 경로. 건별 연결이 달린 거래가 남아 있으면 무효 상태가 생기는 지점
- `backend/app/routers/accounts.py:57-61` — `delete_account` — RESTRICT FK가 삭제를 막고 "거래에서 참조 중인 계정은 삭제할 수 없습니다"로 안내. 새 FK도 여기에 자연 편입
- `backend/app/routers/transactions.py:42-61` — `_to_out` — `TransactionOut` 조립부. 연결 계정 이름을 채울 위치
- `backend/app/routers/transactions.py:64-87` — `_validate_refs` — 거래 참조 정합성 검증(계정 존재, 이체 다리 규칙, 카테고리 kind 일치). 건별 연결 계정 검증이 들어갈 자리
- `backend/app/routers/transactions.py:120-148` — `list_transactions` — `selectinload`로 N+1을 피하는 구조. 연결 계정 relationship도 eager load 대상
- `backend/app/routers/analytics.py:160-188` — 패스스루 라우팅 핵심. `link_target` 맵(계정→연결계정)과 `_route()`, 그리고 `account_id`별 net 집계 + 이체 입금 다리 보정. **거래 단위 오버라이드를 반영하려면 여기 집계 키가 바뀌어야 함**
- `backend/app/routers/analytics.py:215-233` — 계정별 잔액 산출(`opening_balance + net`) 및 `grand_total`. 라우팅되지 않은 easy_pay 잔액이 여기서 0이 아니게 됨
- `backend/app/routers/analytics.py:238-257` — 월별 추이용 `(account_id, month)` net 집계. 현재 잔액과 **동일한 라우팅**을 써야 추이와 잔액이 어긋나지 않음
- `backend/alembic/versions/0008_easy_pay_linked_account.py:26-40` — 자기참조 FK 마이그레이션 선례(RESTRICT + downgrade). 신규 마이그레이션(0013)의 본보기
- `backend/alembic/versions/0012_account_composite_identity.py` — 현재 head. 신규 리비전의 `down_revision`

### 프론트엔드

- `frontend/src/types.ts:40-50` — `Account.linked_account_id` 타입·주석 (필수 뉘앙스 수정 필요)
- `frontend/src/types.ts:62-99` — `Transaction` / `TransactionInput` — 건별 연결 계정 필드 추가 대상
- `frontend/src/stores/masterData.ts:11-19` — `AccountInput.linked_account_id` (그대로 nullable, 주석만 갱신)
- `frontend/src/pages/SettingsPage.tsx:271-274` — `linkableAccounts` (card|bank + 자기 자신 제외) — 그대로 재사용
- `frontend/src/pages/SettingsPage.tsx:317,325` — 연결 계정 **필수** 프론트 검증과 payload 조립. 완화 대상
- `frontend/src/pages/SettingsPage.tsx:412-433` — 연결 계정 Select. "선택 안 함" 옵션이 필요한 곳 (Radix Select는 빈 문자열 value 불가 — 같은 파일/`TransactionsPage`의 `'none'` 센티넬 패턴 참조: `frontend/src/pages/TransactionsPage.tsx:1532`)
- `frontend/src/pages/SettingsPage.tsx:364-369` — 계정 목록의 "간편결제 → 연결계정명" 표시. 미지정 상태 표기 필요
- `frontend/src/pages/TransactionsPage.tsx:90-117` — `FormState` / `emptyForm` — 건별 연결 계정 폼 상태 추가 위치
- `frontend/src/pages/TransactionsPage.tsx:331-347` — `openEdit` — 기존 거래 값 로드
- `frontend/src/pages/TransactionsPage.tsx:349-384` — `submit` — 검증 및 payload 조립
- `frontend/src/pages/TransactionsPage.tsx:1479-1521` — 거래 다이얼로그의 계정 Select(`grid grid-cols-2 gap-3`). 건별 연결 Select를 넣을 위치
- `frontend/src/pages/TransactionsPage.tsx:513-524` — 데스크톱 표 '계정' 컬럼 렌더
- `frontend/src/pages/TransactionsPage.tsx:1140-1192` — 모바일(sm 미만) 전용 카드 목록 — 계정 텍스트를 **표와 별도로** 조립하므로 두 곳 모두 수정해야 표시가 일치
- `frontend/src/pages/TransactionsPage.tsx:146` — `CREATABLE_ACCOUNT_TYPES`가 업로드 매핑에서 easy_pay를 제외. 해제 대상
- `frontend/src/pages/AssetsPage.tsx:46-48,473-480` — `HIDDEN_GROUP_TYPES`로 easy_pay 그룹 카드를 항상 숨김. 잔액이 남을 수 있게 되므로 조건부 노출로 변경 대상
- `frontend/src/lib/format.ts:12-28` — `ACCOUNT_TYPES` / `accountTypeLabel` — 연결 계정 후보를 유형과 함께 표시할 때 사용

## 영향도

- **자산 상태 페이지 총액 정합성** — `analytics.assets`의 `total`/`grand_total`은 모든 계정 잔액의 합(`analytics.py:232-233`)이다. 라우팅되지 않은 easy_pay 잔액이 생기면 총자산에는 들어가지만 그룹 카드에는 안 보여 "카드 합계 ≠ 총자산"이 된다 → easy_pay 그룹 조건부 노출로 해소
- **월별 자산 추이** — `analytics.py:238-257`의 라우팅이 현재 잔액과 같은 규칙이어야 한다. 한쪽만 고치면 추이 그래프 마지막 점과 총자산이 어긋난다
- **거래 목록 성능** — `list_transactions`는 `selectinload`로 N+1을 막고 있다(`transactions.py:130-144`). 연결 계정 이름을 내보내려면 eager load 대상에 포함해야 한다
- **계정 삭제** — `transactions.linked_account_id`가 RESTRICT FK면 건별로 참조된 카드/은행 계정도 삭제가 막힌다. 기존 안내 메시지(`accounts.py:61`)가 그대로 유효하므로 추가 작업 없음
- **계정 유형 변경** — easy_pay 계정을 card 등으로 바꾸면, 그 계정을 결제수단으로 쓰면서 건별 연결이 지정된 기존 거래가 "간편결제가 아닌데 연결 계정이 있는" 무효 상태로 남는다 → 유형 변경 시 거부 처리 필요
- **엑셀 업로드 적재 경로** — 업로드가 만드는 거래는 건별 연결 계정을 채우지 않는다(NULL) → 계정 기본 연결로 폴백되므로 기존 동작과 동일. 코드 변경 불필요
- **묶기(link) 기능** — `_check_link_pair`(`transactions.py:176-200`)는 kind·금액·`account_id`만 본다. 건별 연결 계정은 묶음 규칙에 영향 없음
- **기존 데이터** — 신규 컬럼은 전부 NULL이고 기존 easy_pay 계정의 `linked_account_id`는 그대로 남으므로, 마이그레이션 후 모든 집계 결과가 현재와 동일해야 한다(회귀 없음 확인 대상)
- **대시보드/예산 집계** — 수입/지출 카테고리 집계는 계정 라우팅과 무관(`analytics.py:120-143`) → 영향 없음

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: 설정 > 자산 계정에서 유형을 "간편결제"로 고르고 **연결 계정을 비운 채** 저장하면 계정이 생성된다 — 브라우저에서 저장 성공 및 목록에 표시됨으로 확인. 동일하게 `POST /accounts` 에 `{"type":"easy_pay","linked_account_id":null}` 을 보내면 201을 받는다 — OpenAPI 문서(`/docs`) 또는 curl로 확인
- [ ] AC-2: 간편결제가 아닌 유형(예: card)에 `linked_account_id`를 지정해 API를 호출하면 여전히 422로 거부된다 — curl로 확인 (기존 규칙 회귀 없음)
- [ ] AC-3: 거래 추가/수정 다이얼로그에서 **자산 계정으로 간편결제 계정을 고르면** "연결 계정" 선택 필드가 나타나고, 선택하지 않아도 저장된다. 다른 유형 계정을 고르면 이 필드가 사라진다 — 브라우저에서 확인
- [ ] AC-4: 같은 간편결제 계정 A로 지출 2건을 만들되 1건은 연결 계정 "가 카드", 다른 1건은 "나 카드"로 지정하면, 자산 상태 페이지에서 가 카드 잔액이 첫 건 금액만큼, 나 카드 잔액이 둘째 건 금액만큼 각각 감소한다 — 브라우저에서 금액 대조로 확인
- [ ] AC-5: 건별 연결 계정을 지정하지 않은 간편결제 거래는 그 계정의 기본 연결 계정(`accounts.linked_account_id`)으로 귀속된다. 기본 연결도 없으면 어느 계정으로도 귀속되지 않고 간편결제 계정 자체 잔액에 남는다 — 자산 상태 페이지 잔액으로 확인
- [ ] AC-6: 간편결제 계정 중 잔액이 0이 아닌 계정이 하나라도 있으면 자산 상태 페이지에 "간편결제" 그룹 카드가 나타나고, 모두 0이면 나타나지 않는다. 어느 경우에도 **화면에 보이는 그룹 카드 소계의 합 = 상단 총자산** 이다 — 브라우저에서 숫자 대조로 확인
- [ ] AC-7: 건별 연결 계정에 카드/은행이 아닌 계정(예: 현금, 다른 간편결제)을 지정하거나, 자산 계정이 간편결제가 아닌 거래에 건별 연결 계정을 지정하면 422로 거부된다 — curl로 확인
- [ ] AC-8: 건별 연결이 지정된 거래가 있는 간편결제 계정의 유형을 다른 유형으로 바꾸려 하면 422로 거부되고, 원인을 설명하는 한국어 메시지가 반환된다 — curl 또는 설정 화면에서 확인
- [ ] AC-9: 거래 목록의 '계정' 표시가 간편결제 거래에서 실제 결제 계정을 함께 보여준다(예: `네이버페이 → 신한카드`). 건별·계정 기본 어느 쪽으로 정해졌든 최종 귀속 계정을 보여주며, 어디에도 지정이 없으면 계정명만 표시한다. **데스크톱 표와 모바일 카드 목록 양쪽** 모두 동일하게 표시된다 — 브라우저에서 확인
- [ ] AC-10: 엑셀 업로드의 자산계정 매핑 스텝에서 유형 "간편결제"로 새 계정을 만들 수 있다(연결 계정 없이 생성됨) — 브라우저에서 업로드 마법사로 확인. 백엔드도 `type: "easy_pay"` 매핑을 더 이상 거부하지 않는다 — API 응답으로 확인
- [ ] AC-11: 마이그레이션 직후(기존 데이터에 건별 연결이 하나도 없는 상태) 자산 상태 페이지의 총자산·계정별 잔액·월별 추이가 변경 전과 동일하다 — 변경 전후 값 비교로 확인
- [ ] AC-12: `alembic upgrade head` 와 `alembic downgrade -1` 이 모두 오류 없이 수행된다 — 명령 실행으로 확인
- [ ] AC-13: `cd frontend && npm run build` 와 `npm run lint` 가 오류 없이 통과한다 — 명령 실행으로 확인
- [ ] AC-14 (모바일): 375px 뷰포트에서 거래 추가/수정 다이얼로그(연결 계정 필드 포함), 설정의 계정 추가/수정 다이얼로그, 거래 목록 모바일 카드, 자산 상태 페이지의 간편결제 그룹 카드 모두 가로 스크롤·요소 겹침·텍스트 잘림이 없다 — **/qa 단계에서** 브라우저 도구로 뷰포트를 375px로 맞춰 확인

## Action Items

- [ ] `backend/app/schemas.py` — `AccountCreate.check_linked_account`에서 easy_pay의 연결 계정 **필수** 조건을 제거한다 (비-easy_pay가 연결 계정을 가질 수 없다는 규칙은 유지)
- [ ] `backend/app/models.py` — `Transaction`에 건별 연결 계정 FK(자산 계정 참조, nullable, ondelete RESTRICT)와 relationship을 추가하고, "간편결제 결제수단 거래에서만 채워진다 / 계정 기본 연결보다 우선한다"는 의도를 주석으로 남긴다
- [ ] `backend/alembic/versions/0013_*.py` — 위 컬럼·FK 추가 마이그레이션 신규 작성 (`down_revision = "0012"`). downgrade는 FK·컬럼 제거 (건별 연결 정보가 소실되는 파괴적 동작임을 docstring에 명시)
- [ ] `backend/app/schemas.py` — `TransactionCreate`에 건별 연결 계정 필드(nullable), `TransactionOut`에 표시용 연결 계정 이름을 추가한다
- [ ] `backend/app/routers/transactions.py` — `_validate_refs`에 건별 연결 계정 검증을 추가한다: ① 지정 시 거래의 자산 계정이 easy_pay 유형이어야 함 ② 연결 대상은 `accounts.LINKABLE_TYPES`(card|bank) ③ 존재하지 않으면 404. `_to_out`과 `list_transactions`의 eager load에 연결 계정을 포함시킨다
- [ ] `backend/app/routers/accounts.py` — `update_account`에서 계정 유형이 easy_pay → 다른 유형으로 바뀔 때, 그 계정을 자산 계정으로 쓰면서 건별 연결이 지정된 거래가 존재하면 422로 거부한다 (해소 방법을 안내하는 한국어 메시지)
- [ ] `backend/app/routers/accounts.py` — 연결 계정 검증 함수가 `linked_account_id`가 None인 easy_pay를 정상 통과시키도록 정리한다
- [ ] `backend/app/routers/analytics.py` — 패스스루 라우팅 우선순위를 `거래 건별 연결 > 계정 기본 연결 > 라우팅 없음`으로 바꾼다. 현재 잔액 집계와 월별 추이 집계 **양쪽** 모두 동일 규칙을 쓰도록 라우팅 결정 로직을 한 곳에서 공유한다 (집계 그룹 키를 거래 단위 오버라이드까지 반영하도록 조정 — 세부 쿼리 구성은 구현 재량)
- [ ] `backend/app/schemas.py` — `ImportAccountMapping.check_action`의 easy_pay 생성 금지 분기를 제거한다
- [ ] `frontend/src/types.ts`, `frontend/src/stores/masterData.ts` — `Account.linked_account_id` 주석을 "선택"으로 갱신하고, `Transaction`/`TransactionInput`에 건별 연결 계정 필드와 표시용 이름을 반영한다
- [ ] `frontend/src/pages/SettingsPage.tsx` — 연결 계정 필수 검증을 제거하고, Select에 "선택 안 함" 옵션(`'none'` 센티넬)을 추가한다. 라벨/설명을 "연결 계정 (선택)"으로 바꾸고, 미지정 시 거래별로 지정할 수 있음을 짧게 안내한다. 목록의 연결 계정 표시가 미지정 상태를 자연스럽게 렌더하도록 정리한다
- [ ] `frontend/src/pages/TransactionsPage.tsx` — `FormState`/`emptyForm`/`openEdit`/`submit`에 건별 연결 계정을 반영한다. 다이얼로그에서 선택된 자산 계정이 easy_pay일 때만 "연결 계정 (선택)" Select를 노출하고 후보는 활성 card|bank로 제한한다. 자산 계정을 easy_pay가 아닌 것으로 바꾸면 값을 비운다
- [ ] `frontend/src/pages/TransactionsPage.tsx` — 데스크톱 표 '계정' 셀과 모바일 카드 목록의 계정 텍스트가 최종 귀속 계정을 함께 표시하도록 **공통 헬퍼로 뽑아** 양쪽에서 쓴다
- [ ] `frontend/src/pages/TransactionsPage.tsx` — `CREATABLE_ACCOUNT_TYPES`에서 easy_pay 제외를 해제하고 관련 주석을 갱신한다
- [ ] `frontend/src/pages/AssetsPage.tsx` — easy_pay 그룹을 무조건 숨기는 대신 "해당 유형 계정 잔액이 모두 0일 때만 숨김"으로 바꾸고, 주석을 새 규칙에 맞게 갱신한다

## 결정 사항 및 출처

- [사용자 확인] 어디에도 연결이 지정되지 않은 간편결제 거래의 자산 페이지 표시 → **잔액 0이 아닐 때만 간편결제 그룹 노출** : AC-6과 `AssetsPage.tsx` Action Item에 반영
- [사용자 확인] 엑셀 업로드 매핑 스텝에서 간편결제 계정 생성 허용 여부 → **허용** : AC-10, `schemas.py`/`TransactionsPage.tsx` Action Item에 반영
- [사용자 확인] 건별 지정 UI 범위 → **거래 추가/수정 폼만** (목록 일괄 지정은 이번 범위 제외) : AC-3에 반영하고 목록 선택 UI 작업은 Action Item에서 제외
- [사용자 확인] 거래 목록 '계정' 컬럼에 연결 계정 표시 → **표시** : AC-9에 반영 (데스크톱 표 + 모바일 카드 양쪽)
- [기술 결정] 건별 연결을 새 컬럼으로 둘지 기존 `counter_account_id` 재사용할지 → **`transactions`에 별도 nullable FK 신설** : `counter_account_id`는 이체 전용 의미가 코드 전반에 박혀 있고(`transactions.py:67-79`, `analytics.py:182-188`) 수입/지출에는 지정 자체가 금지돼 있어 재사용하면 이체 검증·집계와 충돌한다
- [기술 결정] 필드 이름 → **`linked_account_id`** (Account의 동명 컬럼과 같은 개념·같은 이름으로 통일). 응답 표시용 이름은 `counter_account_name` 선례를 따른다
- [기술 결정] FK 삭제 정책 → **RESTRICT** : `account_id`·`counter_account_id`·`accounts.linked_account_id`와 동일. 참조 중인 계정 삭제를 막는 기존 안내 메시지(`accounts.py:61`)가 그대로 유효하다
- [기술 결정] 라우팅 우선순위 → **거래 건별 > 계정 기본 > 없음** : 요청의 "어떤 건은 가 카드, 어떤 건은 나 카드"를 만족하면서, 건별 미지정 거래에 대한 기존 동작(계정 기본 연결)을 그대로 보존한다
- [기술 결정] 이체(transfer) 거래의 처리 → **건별 연결은 `account_id`(출금) 다리에만 적용**. 입금 다리(`counter_account_id`)가 간편결제인 경우는 계정 기본 연결만 적용한다 : 입금 다리용 오버라이드 컬럼을 하나 더 두는 비용 대비 실효가 낮다. 알려진 한계로 코드 주석에 남긴다
- [기술 결정] 계정 유형을 easy_pay에서 바꿀 때 → **건별 연결이 달린 거래가 있으면 422 거부** : 건별 연결을 조용히 NULL로 지우면 사용자가 입력한 귀속 정보가 소리 없이 사라지고, 그대로 두면 "간편결제가 아닌데 연결 계정이 있는" 무효 상태가 남는다

## 미해결 질문

- 없음
