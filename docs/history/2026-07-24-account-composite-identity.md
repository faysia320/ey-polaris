# 작업 이력: 자산 계정 식별키 분리 — 이름 전역 유니크 → (이름·소유자·유형) 복합 유니크

- **날짜**: 2026-07-24
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
자산 계정에서 이름이 사실상 유일 키로 동작하던 문제를 해소했다. 시스템 키는 기존 `id`(PK)를 유지하고, 이름 중복은 **소유자(member_id)·유형(type)까지 모두 같을 때만** 성립하도록 (name, member_id, type) 복합 유니크로 전환했다. 이에 따라 서로 다른 구성원이 같은 이름의 계정("롯데카드" 등)을 각자 가질 수 있다. 이름이 겹칠 수 있게 되므로 엑셀 업로드의 계정 매칭도 업로드 지정 구성원 범위로 스코프해, 다른 구성원의 동명 계정에 거래가 잘못 붙지 않게 했다.

## 변경 파일 목록
- `backend/app/models.py` - `Account.name`의 `unique=True` 제거, `__table_args__`에 `UniqueConstraint("name", "member_id", "type")` 추가
- `backend/alembic/versions/0012_account_composite_identity.py` - 신규 마이그레이션. 기존 `accounts_name_key` drop + 복합 유니크 add, downgrade 역순
- `backend/app/routers/accounts.py` - create/update의 409 메시지를 복합 기준으로 갱신
- `backend/app/routers/transactions.py` - import·preview의 계정 매칭을 업로드 구성원으로 스코프, preview에 `member_id` 파라미터 추가
- `frontend/src/pages/TransactionsPage.tsx` - preview 호출 FormData에 `member_id` 전달(건수 파리티 유지). **주의: 이 한 줄은 동시 진행된 다른 작업 커밋 `61d3495 Fix: 묶음 보기 모달 콘텐츠 오버플로 해결`에 함께 포함되어 커밋되었다** (스테이징 혼입). 코드상 본 작업의 일부이므로 여기에 기록해 둔다.

## 상세 변경 내용
상세: [docs/tasks/2026-07-24-account-composite-identity](../tasks/2026-07-24-account-composite-identity/) 참조 (research / implementation / qa-report)

## 테스트 방법
- 마이그레이션: `cd backend && alembic upgrade head` → `accounts` 테이블에 `uq_accounts_name_member_type (name, member_id, type)` 존재, 기존 `accounts_name_key` 부재 확인. `alembic downgrade -1` 시 이름 유니크 복원.
- 계정 API: 서로 다른 구성원에게 같은 이름·유형 계정 생성 → 둘 다 201. 소유자·유형·이름이 모두 같은 계정 재생성 → 409. 같은 소유자·이름이라도 유형이 다르면 → 201.
- 엑셀 업로드: 특정 구성원(예: 영이) 소유의 동명 계정이 있는 상태에서 다른 구성원(으니)으로 업로드 → 거래가 업로드 구성원 소유 계정에 연결되는지 확인. preview와 확정의 평가액·부채 건수 일치 확인.
