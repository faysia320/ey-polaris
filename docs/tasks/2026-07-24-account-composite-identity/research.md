# Research: 자산 계정 식별키 분리 — 이름 전역 유니크 → (이름·소유자·유형) 복합 유니크

- 날짜: 2026-07-24
- 요청 원문: 기준정보 자산계정이 이름이 그 자체가 key인거같은데 그러면 안돼. 별도의 시스템 키는 따로 있고 이름은 소유자, 유형까지 동일하지 않으면 중복이 아니야
- 보충(사용자): 영이도 롯데카드를 계정으로 가질 수 있어야 하고, 으니도 롯데카드를 계정으로 가질 수 있어야 한다. 엑셀 업로드 시엔 으니/영이를 명시적으로 지정해서 업로드하니 각자의 계정으로만 연결되면 된다.

## 요약
현재 `Account.name`에 전역 `unique=True` 제약이 걸려 있어(`models.py:43`, 마이그레이션 `0001_initial_schema.py:29`), 이름 자체가 사실상 유일 키로 동작한다. 그 결과 서로 다른 소유자(영이/으니)가 같은 이름의 계정("롯데카드")을 가질 수 없다. 시스템 키는 이미 `id`(PK)가 존재하므로, 이름의 전역 유니크를 제거하고 **(name, member_id, type) 복합 유니크**로 대체하면 된다 — 세 값이 모두 같을 때만 중복이다. 이름을 조회 키로 쓰는 유일한 지점은 **엑셀 업로드 매칭**(`transactions.py`의 `accounts = {a.name: a ...}` 및 `ensure_account`/평가액·부채 매칭)이며, 나머지(프론트 CRUD, 다른 라우터)는 모두 `id`를 쓴다. 업로드는 항상 한 구성원으로 지정되므로, 매칭·생성을 **업로드 구성원 소유 계정 범위로 스코프**하면 각자의 계정으로만 연결된다. 프론트 UI(설정>자산 계정)는 이미 소유자·유형을 함께 표시·정렬하므로 별도 UX 변경은 하지 않되, preview/import 평가액 건수 파리티 유지를 위해 preview에 `member_id`를 전달하는 최소 배선만 포함한다.

## 관련 파일 및 근거
- `backend/app/models.py:43` — `Account.name`에 `unique=True`. 제거하고 `__table_args__`에 복합 유니크를 추가할 대상.
- `backend/app/models.py:47,50` — 복합 키 구성요소인 `type`, `member_id` 컬럼 정의(둘 다 존재하므로 신규 컬럼 불필요).
- `backend/alembic/versions/0001_initial_schema.py:29` — `accounts.name`이 `unique=True`로 최초 생성됨(Postgres 자동 제약명 `accounts_name_key` 추정). 새 마이그레이션에서 drop 대상.
- `backend/app/routers/accounts.py:42,53` — create/update 시 유니크 위반을 409로 변환하는 메시지 `이미 존재하는 계정 이름입니다: {name}`. 복합 기준으로 문구 갱신 필요.
- `backend/app/routers/accounts.py:31-33` — 목록은 `id` 정렬. 이름 유니크에 의존하지 않음(영향 없음, 참고).
- `backend/app/routers/utils.py:13-19` — `commit_or_conflict`가 `IntegrityError`를 409로 변환. 복합 유니크 위반도 그대로 409로 처리됨(로직 변경 불필요).
- `backend/app/routers/transactions.py:516,531-545,549` — 임포트에서 `accounts = {a.name: a ...}`(전역), `ensure_account(name)`이 이름으로 조회·생성. **구성원 스코프로 변경 대상**.
- `backend/app/routers/transactions.py:346-407` — `_effective_valuations`/`_effective_liabilities`가 `accounts.get(product_name)`으로 이름 매칭 후 `type` 필터(real_estate/loan). 스코프된 accounts 딕셔너리를 그대로 사용하면 됨.
- `backend/app/routers/transactions.py:661-687,693-722` — 평가액·부채 반영 시 미매칭이면 신규 계정 생성(`member_id=member_id` 이미 지정). 스코프 accounts 딕셔너리와 자연히 정합.
- `backend/app/routers/transactions.py:410-459` — `preview_import`가 `member_id` 없이 전역 `accounts`로 평가액 미리보기 산출. import와 스코프를 맞추려면 `member_id` 파라미터 추가 필요(파리티).
- `frontend/src/pages/TransactionsPage.tsx:584,588-591` — `runImport`가 preview 호출 시 `member_id`를 보내지 않음(importMemberId는 이미 필수 입력·확보됨). preview에 `member_id`를 append하는 최소 배선 대상.
- `frontend/src/pages/SettingsPage.tsx:290-300,314-346` — 계정 목록은 소유자→유형→이름 순 정렬·표시, CRUD는 `id` 기반. 동명 계정도 소유자·유형이 함께 보여 구분됨 → UI 레이아웃 변경 불필요.
- `backend/app/routers/analytics.py:224` — `a.name`을 표시용으로만 사용(조회 키 아님). 영향 없음.

## 영향도
- **DB 스키마**: 기존 데이터는 전역 유니크 하에 이미 유일하므로 복합 유니크로 전환 시 위반 없음(무손실). 마이그레이션에서 기존 `name` 유니크 제약을 drop하고 복합 유니크를 add.
- **백엔드 API**: `POST /accounts`·`PUT /accounts/{id}` 성공/실패 계약 변화 — 동명이라도 소유자·유형이 다르면 성공, 셋 다 같으면 409. 라우터 로직은 유지하고 메시지만 갱신.
- **엑셀 임포트**: 계정 매칭·생성이 업로드 구성원 범위로 좁혀짐 — 다른 구성원의 동명 계정에 붙지 않게 됨(요청의 핵심). preview도 동일 스코프로 맞춰 평가액·부채 건수 파리티 유지.
- **프론트**: preview 요청 FormData에 `member_id` 추가(배선). 계정 관리 화면 로직·레이아웃 변경 없음.
- **영향 없음**: 프론트 계정 CRUD, analytics 표시, valuations 라우터(계정 id 기반) — 모두 `id`를 키로 사용.

## 성공 기준 (Acceptance Criteria)
- [ ] AC-1: `Account`에서 이름 전역 유니크가 제거되고 (name, member_id, type) 복합 유니크로 대체된다 — `alembic upgrade head` 후 DB 검사(`\d accounts` 또는 inspector)에서 기존 name 유니크 제약 부재 + 복합 유니크(예: `uq_accounts_name_member_type`) 존재로 확인.
- [ ] AC-2: 서로 다른 소유자가 같은 이름·유형 계정을 가질 수 있다 — 영이(member A) "롯데카드"(card)와 으니(member B) "롯데카드"(card)를 각각 `POST /accounts` 하면 둘 다 201 성공. API 호출로 확인.
- [ ] AC-3: 소유자·유형·이름이 모두 같은 계정을 다시 생성하면 409와 복합 기준을 알리는 메시지를 반환한다 — 동일 (name, member_id, type)로 `POST /accounts`(및 `PUT`으로 동일 조합화) 시 409 확인.
- [ ] AC-4: 같은 소유자·같은 이름이라도 유형이 다르면 생성이 허용된다 — 영이 "롯데카드"(card)와 영이 "롯데카드"(bank)를 `POST /accounts` 하면 둘 다 성공. API 호출로 확인.
- [ ] AC-5: 엑셀 업로드가 지정 구성원 범위 안에서만 계정을 매칭·생성한다 — 영이 소유 "롯데카드"가 이미 있는 상태에서 으니로 지정해 "롯데카드" 결제수단 거래를 임포트하면, 해당 거래가 영이 계정에 붙지 않고 으니 소유 "롯데카드"(기존 또는 신규 생성)에 연결된다. 임포트 후 연결 계정의 `member_id`가 으니인지로 확인.
- [ ] AC-6: preview와 import의 평가액·부채 반영 건수·목록이 동일 구성원 스코프에서 일치한다 — 동일 파일·월·구성원으로 preview와 import를 실행해 `valuations`/`liabilities` 건수·상품명 목록이 일치함으로 확인(파리티 유지).
- [ ] AC-7: 기존 데이터가 있는 DB에서 마이그레이션이 무손실 성공한다 — 기존 계정이 존재하는 상태에서 `alembic upgrade head` 성공, 이어 `alembic downgrade -1` → `upgrade head` 왕복 성공으로 확인.
- 모바일 AC: 해당 없음 — 프론트는 preview 요청에 `member_id`를 추가하는 배선만 있고 UI 레이아웃/컴포넌트 변경이 없음(설정>자산 계정 화면 무변경).

## Action Items
- [ ] `models.py`: `Account.name`의 `unique=True` 제거, `__table_args__`에 `UniqueConstraint("name", "member_id", "type", name="uq_accounts_name_member_type")` 추가. 주석의 "unique" 관련 문구도 정합화.
- [ ] 새 Alembic 마이그레이션(`0012_account_composite_identity`) 작성: 기존 `accounts.name` 유니크 제약 drop(실제 제약명은 DB inspect로 확인 — `accounts_name_key` 추정) + 복합 유니크 add. `downgrade`는 역순(복합 drop → name 유니크 재생성).
- [ ] `accounts.py`: create/update의 `commit_or_conflict` 메시지를 복합 기준으로 갱신(예: "같은 소유자·유형의 계정 이름이 이미 있습니다: {name}"). 로직 변경 없음.
- [ ] `transactions.py` import(`import_transactions`): `accounts` 딕셔너리를 업로드 `member_id` 소유 계정으로 스코프. `ensure_account`·평가액·부채 매칭이 동일 스코프 딕셔너리를 사용하도록 정리(신규 생성 시 `member_id` 지정은 기존 유지).
- [ ] `transactions.py` preview(`preview_import`): `member_id` 파라미터 추가, `accounts` 딕셔너리를 동일 구성원 스코프로 산출해 import와 파리티 유지.
- [ ] `frontend/src/pages/TransactionsPage.tsx` `runImport`: preview 호출 FormData에 `member_id`(importMemberId) append. UI 변경 없음.
- [ ] (필요 시) `schemas.py`: preview 요청/파라미터에 `member_id` 반영. 응답 스키마 변경은 없음.

## 결정 사항 및 출처
- [사용자 확인] 동명 계정 허용 범위 → 소유자(member_id)가 다르면 동명·동유형이라도 별개 계정(영이/으니 각자 "롯데카드") : 복합 유니크에 member_id 포함으로 반영.
- [사용자 확인] 엑셀 업로드 매칭 범위 → "구성원 스코프까지 함께" : 업로드 지정 구성원 소유 계정 안에서만 매칭·생성. import + preview 둘 다 스코프.
- [사용자 확인] 프론트 UX 손질 → "백엔드만" : 계정 관리 UI는 무변경. 단 preview 파리티용 `member_id` 전달은 UI가 아닌 기능 배선이므로 포함.
- [기술 결정] 복합 유니크 키 = (name, member_id, type), 제약명 `uq_accounts_name_member_type` : 요청의 "이름은 소유자·유형까지 같아야 중복" 정의 그대로. (내부 제약명은 구현 재량 — 표준 컨벤션 채택)
- [기술 결정] 별도 시스템 키는 신규 도입하지 않고 기존 `Account.id`(PK) 유지 : 이미 모든 조회·FK가 id 기반이므로 새 키 불필요.
- [기술 결정] preview도 구성원 스코프로 전환 : 전역 preview는 다른 구성원의 동명 계정 유형으로 평가액 필터 결과가 갈려 import와 건수 파리티가 깨질 수 있으므로 스코프 일치 필요.
- [기술 결정] 임포트 매칭은 구성원 내 "이름" 기준(유형 무관 첫 매칭) 유지 : 엑셀에는 이름 문자열만 있고 유형은 휴리스틱 추정이므로. 같은 구성원이 같은 이름을 두 유형으로 보유하는 경우 임의 매칭 가능성은 실사용상 드물어 한계로 수용(발생 시 계정 정리로 해소).

## 미해결 질문
- 없음
