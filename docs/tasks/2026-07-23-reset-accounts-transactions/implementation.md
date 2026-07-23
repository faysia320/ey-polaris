# Implementation: 자산 계정·입출금 거래 전체 초기화 (1회성)

- 날짜: 2026-07-23
- 기반 명세: docs/tasks/2026-07-23-reset-accounts-transactions/research.md

## 변경 파일
- (코드 변경 없음) — 실행 중 DB에 대한 1회성 파괴적 운영 작업. 커밋할 diff 없음.

## 주요 결정
- **삭제 방식**: `TRUNCATE accounts, transactions, asset_valuations RESTART IDENTITY CASCADE;` 단일 문장으로 실행. research.md 권장안 채택.
  - 이유: 계정 자기참조 `linked_account_id`(easy_pay, RESTRICT)와 거래→계정 RESTRICT를 명시적 삭제 순서 없이 한 번에 회피. `RESTART IDENTITY`로 시퀀스도 리셋해 재업로드 시 id가 1부터 시작.
  - `asset_valuations`는 별도 명시 없이 `accounts` CASCADE로 함께 비워짐(`models.py:134`).
- **실행 수단**: DB 포트(5432)가 호스트에 게시되지 않아 `docker compose exec -T db psql -U polaris -d polaris`로 컨테이너 내부에서 실행.
- **백업**: 사용자가 "백업 없이 바로 삭제" 선택 → pg_dump 생략.
- **범위 준수**: `members`·`categories`·`budgets`·`goals`는 손대지 않음(TRUNCATE 대상에서 제외).
- **작업 추적 도구**: 이 세션에 TodoWrite/TaskCreate 미제공 → 도구 등록 생략(2단계 규모의 운영 작업).

## 자체 검증 결과
- 실행 전 카운트: `docker compose exec -T db psql ... "SELECT count(*) ..."` → accounts 28, transactions 184, asset_valuations 4, members 2, categories 83, budgets 5, goals 0.
- 삭제 실행: `docker compose exec -T db psql ... "TRUNCATE accounts, transactions, asset_valuations RESTART IDENTITY CASCADE;"` → `TRUNCATE TABLE`, **EXIT=0** (FK 오류 없음).
- 실행 후 카운트: accounts **0**, transactions **0**, asset_valuations **0** / members **2**, categories **83**, budgets **5**, goals **0**. **EXIT=0**.

## 성공 기준 자가 체크
- [x] AC-1: `accounts` = 0 (검증 쿼리 확인).
- [x] AC-2: `transactions` = 0 (검증 쿼리 확인).
- [x] AC-3: `asset_valuations` = 0 (계정 CASCADE 결과, 검증 쿼리 확인).
- [x] AC-4: members(2)·categories(83)·budgets(5)·goals(0) 전/후 동일 — 감소 없음.
- [x] AC-5: TRUNCATE가 FK 무결성 오류 없이 EXIT=0으로 완료.
- [ ] AC-6: 엑셀 재업로드 후 계정 재생성 검증 — **사용자의 재업로드 이후 수행**(/qa 또는 사용자). 현재 미수행.
- [x] AC-7: 실행 전 파괴적·비가역 고지 + 삭제/유지 대상 명시 후 사용자의 명시적 확인("백업 없이 바로 삭제") 획득.

## 보류/미완 항목
- AC-6(재업로드 후 계정 재생성 검증): 사용자가 엑셀을 다시 업로드해야 확인 가능 — /qa 또는 사용자 단계로 이관.
- 당초 요청의 "소유자별 정렬 / 유형·소유자 재정리"는 이번 초기화 범위 밖(보류). 재업로드 후 필요 시 별도 요청.
