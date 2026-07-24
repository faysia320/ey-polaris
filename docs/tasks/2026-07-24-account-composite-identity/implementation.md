# Implementation: 자산 계정 식별키 분리 — 이름 전역 유니크 → (이름·소유자·유형) 복합 유니크

- 날짜: 2026-07-24
- 기반 명세: docs/tasks/2026-07-24-account-composite-identity/research.md

## 변경 파일
- `backend/app/models.py` — `Account.name`의 `unique=True` 제거, `__table_args__`에 `UniqueConstraint("name", "member_id", "type", name="uq_accounts_name_member_type")` 추가 + 의도 주석.
- `backend/alembic/versions/0012_account_composite_identity.py` — 신규. 기존 `accounts_name_key`(name 전역 유니크) drop(`IF EXISTS`) + 복합 유니크 add. downgrade는 역순(복합 drop → name 유니크 복원).
- `backend/app/routers/accounts.py` — create/update의 409 메시지를 `같은 소유자·유형의 계정 이름이 이미 있습니다: {name}`로 갱신(로직 불변).
- `backend/app/routers/transactions.py` — import(`import_transactions`)의 `accounts` 딕셔너리를 업로드 `member_id` 소유 계정으로 스코프. preview(`preview_import`)에 `member_id: int = Form(...)` 추가하고 동일 스코프로 산출(평가액·부채 건수 파리티).
- `frontend/src/pages/TransactionsPage.tsx` — `runImport`의 preview 호출 FormData에 `member_id`(importMemberId) append. UI 레이아웃 변경 없음.

## 주요 결정
- 복합 유니크 키는 (name, member_id, type). research 명세 그대로. 제약명 `uq_accounts_name_member_type`.
- 시스템 키는 기존 `Account.id`(PK) 유지 — 신규 키 도입 없음(모든 FK·조회가 이미 id 기반).
- 마이그레이션 drop은 `ALTER TABLE ... DROP CONSTRAINT IF EXISTS accounts_name_key`로 안전 처리 — 인라인 `unique=True`가 Postgres에서 만든 자동 제약명이며, 이름 편차 대비. 실 DB 검증에서 실제 제약명이 `accounts_name_key`임을 확인함.
- import/preview 모두 `select(Account).where(member_id == 업로드 member)`로 스코프 — 이름이 겹칠 수 있으므로 다른 구성원의 동명 계정에 잘못 붙는 것을 방지. 두 엔드포인트가 동일 스코프라 평가액·부채 건수 파리티가 유지됨.
- 임포트 계정 매칭은 구성원 내 "이름" 기준(유형 무관 첫 매칭) 유지 — 엑셀에는 이름 문자열만 있고 유형은 휴리스틱. 같은 구성원이 같은 이름을 두 유형으로 보유하는 경우는 실사용상 드물어 한계로 수용(research 기술 결정과 동일).

## 자체 검증 결과
- `python -m ast` 파싱(models.py, accounts.py, transactions.py, 0012 마이그레이션) → **AST OK**.
- `cd frontend && npm run build`(tsc -b && vite build) → **EXIT=0, 통과**(3672 modules, 오류 없음. chunk-size 경고는 기존 정보성 경고).
- 백엔드는 로컬 Python 환경/테스트 스위트 없음(Docker 전용, `tests/` 부재) → 실행 중인 Docker 스택으로 통합 검증 수행:
  - **마이그레이션 왕복(AC-1, AC-7)**: `alembic upgrade head`(0011→0012) 성공. `pg_constraint` 조회 결과 `accounts_name_key` 부재 + `uq_accounts_name_member_type UNIQUE (name, member_id, type)` 존재, `accounts_pkey PRIMARY KEY (id)` 유지. `alembic downgrade -1` 시 `accounts_name_key UNIQUE (name)` 복원 확인, 재 `upgrade head` 성공(기존 계정 데이터 무손실).
  - **API 동작(AC-2/3/4)**: backend·frontend 이미지 재빌드 후 라이브 검증.
    - AC-2: 서로 다른 소유자(5,6)의 "롯데카드"/card → 둘 다 **201**.
    - AC-3: 동일 소유자·유형·이름 재생성 → **409** + `같은 소유자·유형의 계정 이름이 이미 있습니다: 롯데카드`.
    - AC-4: 같은 소유자·이름, 다른 유형(card vs bank) → **201**.
  - 검증용 임시 계정·구성원은 삭제 완료(실데이터 불변).
- 브라우저 E2E 및 실제 엑셀 업로드(AC-5/AC-6) 라이브 확인은 `/qa`에 위임 — 코드 수준에서 import/preview가 동일한 member 스코프 딕셔너리를 사용함을 확인함.

## 성공 기준 자가 체크
- [x] AC-1: 마이그레이션 후 name 전역 유니크 제거 + `uq_accounts_name_member_type (name, member_id, type)` 존재를 pg_constraint 조회로 확인.
- [x] AC-2: 서로 다른 소유자의 동명·동유형 계정 2건 모두 201(라이브 API 확인).
- [x] AC-3: 소유자·유형·이름 동일 재생성 시 409 + 복합 기준 메시지 확인.
- [x] AC-4: 같은 소유자·이름·다른 유형 계정 생성 201 확인.
- [x] AC-5: import의 `accounts` 딕셔너리를 `where(member_id == 업로드 member)`로 스코프하여, `ensure_account`·평가액·부채 매칭이 지정 구성원 계정으로만 매칭/생성. 신규 생성 시 `member_id` 지정 유지 — 코드 수준 확인. (라이브 엑셀 업로드는 /qa 위임)
- [x] AC-6: preview에 `member_id` 파라미터 추가 후 import와 동일 스코프 딕셔너리 사용, 프론트 `runImport`가 preview에도 member_id 전달 → 평가액·부채 건수 파리티 유지 — 코드 수준 확인. (라이브 파리티는 /qa 위임)
- [x] AC-7: upgrade→downgrade→upgrade 왕복 성공, 기존 계정 데이터 무손실(잔여 계정 25건 소유자 분포 정상) 확인.
- 모바일 AC: 해당 없음(UI 레이아웃/컴포넌트 변경 없음 — preview FormData 배선만).

## 보류/미완 항목
- 없음. (AC-5/AC-6의 실제 엑셀 업로드 기반 라이브 E2E는 파이프라인 규율상 /qa 단계에서 수행)
