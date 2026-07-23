# Research: 자산 계정·입출금 거래 전체 초기화 (1회성)

- 날짜: 2026-07-23
- 요청 원문: (당초) "기준정보관리의 자산계정을 소유자별로 정렬해줘. 그리고 자산 이름과 유형 소유자를 6월 수입/지출 내역을 기준으로 다시 정리해줘" → (조사 중 사용자 방향 전환) **"그냥 자산 내역과 입출금 내역을 완전 초기화 해줘. 그런 뒤 내가 다시 엑셀 업로드를 하면 그걸 기반으로 자산내역을 다시 추가할거아냐"**

## 요약
사용자는 조사 도중 요청을 전환했다. 당초의 "소유자별 정렬 + 6월 기준 자산 재정리"는 보류하고, 대신 **자산 계정과 입출금 거래를 전부 삭제(초기화)한 뒤, 엑셀을 다시 업로드해 자산 계정을 재생성**하는 흐름을 원한다. 엑셀 업로드 확정 엔드포인트는 결제수단명으로 없는 계정을 자동 생성하므로(`transactions.py:341-355`) 이 계획은 코드상 성립한다. 삭제 대상은 `accounts`·`transactions`이며, `asset_valuations`는 `accounts` 삭제 시 CASCADE로 함께 지워진다(`models.py:134`). `members`(으니·영이)·`categories`·`budgets`·`goals`·`app_settings`는 **유지**한다. 계정 자기참조(easy_pay `linked_account_id`)와 거래→계정 참조가 모두 `RESTRICT`이므로 삭제 순서 또는 `TRUNCATE ... CASCADE`로 무결성 오류를 회피해야 한다. 이 작업은 **실행 중 DB에 대한 1회성 파괴적 운영 작업**이며 코드 산출물(diff)이 없다.

## 관련 파일 및 근거
- `backend/app/models.py:88-125` — `Transaction` 모델. `account_id`(102)·`counter_account_id`(105)가 모두 `accounts`를 `ondelete="RESTRICT"`로 참조 → 계정보다 거래를 **먼저** 지워야 함.
- `backend/app/models.py:32-59` — `Account` 모델. `linked_account_id`(49-51)가 `accounts`를 자기참조(`RESTRICT`) → 전체 계정 단일 `DELETE`는 RESTRICT로 실패할 수 있음(선 NULL 처리 또는 TRUNCATE 필요).
- `backend/app/models.py:128-138` — `AssetValuation`(`asset_valuations`). `account_id`가 `ondelete="CASCADE"`(134) → 계정 삭제 시 자동 삭제.
- `backend/app/models.py:46` — `Account.member_id`가 `members`를 `RESTRICT` 참조. **계정을 지우므로 구성원 삭제 제약과는 무관**(구성원은 유지).
- `backend/app/models.py:108` — `Transaction.member_id`는 `SET NULL`. 초기화와 무관.
- `backend/app/routers/transactions.py:341-355` — 엑셀 업로드 확정 시 `ensure_account`: 결제수단명으로 없는 계정을 `type=guess_account_type(name)`, `opening_balance=0`, `is_active=True`, `member_id=(업로드 시 선택한 구성원)`으로 **자동 생성**. → 재업로드로 자산 재생성이 성립함을 확인.
- `backend/app/excel_import.py:234-243` — `guess_account_type`: 이름 휴리스틱(카드/은행/현금/other). 재생성 계정의 유형은 이 추정값.
- `backend/app/routers/settings.py:1-31` — settings 라우터는 AI 설정 전용. **기존 초기화 엔드포인트 없음** → 1회성 삭제는 별도 실행 수단 필요.
- `backend/app/routers/transactions.py:120-142` — 기존 월 단위 대량 삭제 패턴(참고용). 전체 초기화용은 아님.
- `backend/app/config.py` — `DATABASE_URL` (실행 수단이 DB에 접속하는 데 필요).
- FK로 `accounts`/`transactions`를 참조하는 그 외 테이블: **없음**(`goals`·`budgets`·`app_settings`·`ai_reports`는 계정/거래를 FK로 참조하지 않음 — `models.py`의 ForeignKey 정의 46·50·101·102·105·108·134 전수 확인).

## 영향도
- **런타임 데이터(파괴적·비가역)**: `accounts`·`transactions` 전체 행 삭제, `asset_valuations`는 CASCADE 삭제. 삭제된 데이터는 백업 없이는 복구 불가.
- **프론트 캐시**: `masterData`/`transactions`/`analytics` store가 이전 데이터를 캐싱 중이면 초기화 후 새로고침(재조회) 필요. 코드 변경 아님, 사용자 조치.
- **재업로드 후 상태(사용자 인지 필요)**: 재생성되는 계정은 **모두 업로드 시 선택한 단일 구성원 소유**이며 유형은 이름 휴리스틱 추정값이다. 즉 당초 요청의 "소유자별 구분/유형 정리"는 재업로드만으로 자동 충족되지 않으며, 이후 기준정보관리에서 수동 보정이 필요할 수 있다.
- **코드 산출물 없음**: 재사용 기능을 만들지 않기로 했으므로 커밋할 diff가 없다. `/git-commit` 단계는 생략될 수 있다.

## 성공 기준 (Acceptance Criteria)
- [ ] AC-1: 초기화 실행 후 `accounts` 테이블 행 수 = 0 — `SELECT count(*) FROM accounts;`로 확인.
- [ ] AC-2: 초기화 실행 후 `transactions` 테이블 행 수 = 0 — `SELECT count(*) FROM transactions;`로 확인.
- [ ] AC-3: 초기화 실행 후 `asset_valuations` 테이블 행 수 = 0 — `SELECT count(*) FROM asset_valuations;`로 확인(계정 CASCADE 결과).
- [ ] AC-4: `members`·`categories`·`budgets`·`goals`·`app_settings` 행 수가 초기화 **전과 동일**(감소 없음) — 각 테이블 `count(*)` 전/후 비교로 확인.
- [ ] AC-5: 초기화 과정에서 FK 무결성 오류(자기참조 `linked_account_id`, 거래→계정 RESTRICT)가 발생하지 않고 완료된다 — 실행 로그/명령 종료코드로 확인.
- [ ] AC-6: 초기화 후 엑셀 재업로드(임의 1개월) 시 계정이 정상 재생성되고 거래가 반영된다 — 업로드 확정 응답의 `created_accounts`가 비어 있지 않고, `SELECT count(*) FROM accounts;` > 0으로 확인. (수행 주체: 사용자의 재업로드 이후 검증 — /qa 또는 사용자)
- [ ] AC-7: 실행 전 사용자에게 파괴적·비가역임을 고지하고 명시적 확인을 받는다 — /implement가 실행 직전 확인 절차를 거쳤음을 기록.

## Action Items
- [ ] 실행 중 DB 접속 수단 확정(구현 재량): `docker compose exec db psql` / 로컬 `psql` / 앱 세션 기반 1회성 Python 스크립트 중 환경에 맞는 것 선택. DB가 기동되어 있어야 함(`docker compose up` 또는 로컬 Postgres).
- [ ] 초기화 실행: FK-안전 방식으로 `accounts`·`transactions`·`asset_valuations` 비우기. 권장: `TRUNCATE accounts, transactions, asset_valuations RESTART IDENTITY CASCADE;` (자기참조 RESTRICT 회피 + CASCADE로 참조 정리 + 시퀀스 리셋). 대안(명시적 순서): `DELETE FROM transactions;` → `UPDATE accounts SET linked_account_id = NULL;` → `DELETE FROM accounts;`(valuations는 CASCADE).
- [ ] 실행 전 백업 권고: 파괴적 작업이므로 `pg_dump` 등으로 사전 백업 여부를 사용자에게 확인.
- [ ] 실행 후 AC-1~AC-5 카운트 검증 쿼리 수행.
- [ ] (사용자 단계) 엑셀 재업로드로 자산 재생성 후 AC-6 확인.

## 결정 사항 및 출처
- [사용자 확인] Part 2 성격(당초 질문) → "실제 계정 데이터 정리" 선택했으나, 직후 방향 전환으로 **"계정+거래 완전 초기화 후 재업로드"** 로 대체됨.
- [사용자 확인] 제공 방식 → **1회성 즉시 삭제**(재사용 초기화 기능/엔드포인트 만들지 않음). : 코드 산출물 없는 운영 작업으로 명세.
- [사용자 확인] 초기화 범위 → **계정+거래만**(구성원·카테고리·예산·목표 유지). : AC-4로 유지 대상 보존을 강제.
- [사용자 확인] 대상 월(당초) → "2026-06" 선택했으나, 전환된 요청(초기화)에서는 특정 월에 의존하지 않음 → **무관**.
- [기술 결정] 삭제 방식 → `TRUNCATE ... CASCADE` 권장(자기참조 easy_pay `linked_account_id` RESTRICT와 거래→계정 RESTRICT를 단일 문장으로 회피). 근거: `models.py:49-51,102,134`.
- [기술 결정] `asset_valuations`는 명시 삭제 불필요 — `accounts` 삭제 시 CASCADE(`models.py:134`).
- [보류] 당초 Part 1 "소유자별 정렬"·Part 2 "유형/소유자 재정리"는 이번 초기화 범위에서 제외. 재업로드 후 필요 시 별도 요청으로 진행.

## 미해결 질문
- 실행 전 DB 백업(`pg_dump`)을 받을지 여부 — /implement 실행 직전 사용자 확인 대상(AC-7과 함께).
- 재생성 계정의 소유자·유형 사후 보정을 이번 작업에 포함할지 — 현재 범위 밖(보류). 사용자가 재업로드 결과를 보고 별도 요청 시 진행.
