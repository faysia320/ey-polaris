# QA Report: 자산 계정·입출금 거래 전체 초기화 (1회성)

- 날짜: 2026-07-23
- 작업 폴더: `C:\WorkSpace\repos\ey-polaris\docs\tasks\2026-07-23-reset-accounts-transactions`
- 판정: **PASS**

## ⚠️ 데이터 영향 (QA 수행 관점)
- **QA로 인한 실데이터 손실 없음.** QA 시작 시점에 이미 `accounts`/`transactions`/`asset_valuations`는 0건이었다(초기화는 /implement가 사용자의 명시적 요청으로 QA 이전에 실행 완료). QA는 그 상태를 확인만 했다.
- AC-6 검증을 위해 **빈 상태의 과거 월(2019-03)** 에 테스트 계정 2건·거래 2건을 생성했고, 검증 후 `TRUNCATE accounts, transactions, asset_valuations RESTART IDENTITY CASCADE`로 **전량 정리**했다. 정리 후 카운트 재확인: accounts 0 / transactions 0 / asset_valuations 0, 시퀀스 `accounts_id_seq=1` 리셋. 보존 대상(members 2 / categories 83 / budgets 5 / goals 0 / app_settings 2)은 QA 전후 불변.
- 참고: /implement가 삭제한 원본 28 accounts / 184 transactions / 4 valuations는 사용자가 명시적으로 요청한 "완전 초기화"의 의도된 결과이며 결함이 아니다. 백업 없이 삭제 선택도 사용자 결정(implementation.md 기록).

## 성공 기준 채점
- ✅ **AC-1**: `accounts` = 0 — `SELECT count(*)` 직접 실행 결과 0. (QA 종료 시점 재확인 0)
- ✅ **AC-2**: `transactions` = 0 — 직접 쿼리 0.
- ✅ **AC-3**: `asset_valuations` = 0 — 직접 쿼리 0 (accounts CASCADE 결과).
- ✅ **AC-4**: `members`(2)·`categories`(83)·`budgets`(5)·`goals`(0)·`app_settings`(2) 보존 — 직접 쿼리로 확인. 나아가 QA가 직접 실행한 정리용 `TRUNCATE ... CASCADE`에서도 이 테이블들이 전혀 감소하지 않음을 관찰해, research의 "accounts/transactions를 FK로 참조하는 다른 테이블 없음" 분석을 교차 확인함(예상치 못한 CASCADE 전파 없음). 다만 초기화 **이전**의 원본 카운트는 QA 시작 전에 조작이 끝나 독립 재확인 불가 — implementation.md 기록(members 2/categories 83/budgets 5/goals 0)과 현재값 일치로만 확인.
- ✅ **AC-5**: FK 무결성 오류 없이 완료 — QA가 정리 단계에서 동일한 `TRUNCATE accounts, transactions, asset_valuations RESTART IDENTITY CASCADE`를 **직접 재실행**해 `TRUNCATE TABLE`, EXIT=0으로 완료(자기참조 `linked_account_id`·거래→계정 RESTRICT 무결성 오류 없음). 삭제 방식의 FK 안전성을 독립 재현으로 확인.
- ✅ **AC-6**: 엑셀 재업로드 시 계정 정상 재생성 — QA가 직접 픽스처를 만들어 `POST /api/v1/transactions/import`(month=2019-03, member_id=1) 호출. 응답 `created_accounts=["QA테스트카드","QA테스트통장"]`(비어있지 않음), `created_count=2`, `created_categories=[]`. DB 확인: accounts 2, transactions 2, categories 83(불변). 계정 유형은 휴리스틱대로 카드→card, 통장→bank로 생성, member_id=1 지정 확인.
- ✅ **AC-7**(문서 기록, QA 독립 검증 불가): 실행 전 사용자 고지·확인은 /implement의 대화 이벤트로 코드/DB 산출물이 없어 QA가 독립 검증할 수단이 없다. implementation.md에 "백업 없이 바로 삭제" 사용자 확인 획득이 기록되어 있고, 실제로 원본 데이터가 의도대로 삭제된 정황과 모순되지 않아 판정을 막지 않음. (자가 체크의 무비판적 인용이 아니라 "검증 불가한 프로세스 AC"로 명시)

## 검증 시나리오
- 실행 환경 확인: `docker compose ps` → db/backend/frontend 모두 Up. DB 포트 미게시로 `docker compose exec -T db psql -U polaris -d polaris`로 쿼리.
- 초기 상태 카운트: accounts 0 / transactions 0 / asset_valuations 0 / members 2 / categories 83 / budgets 5 / goals 0 / app_settings 2, `accounts_id_seq=1`.
- 파서 사전 확인: `backend/app/excel_import.py`의 `_to_date`(문자열 날짜 미지원 → datetime 사용), 필수 컬럼, `guess_account_type` 휴리스틱을 읽고 픽스처를 앱이 파싱 가능한 형식(`가계부 내역` 시트, datetime 날짜, 지출=음수/수입=양수, KRW)으로 제작. 픽스처 경로: 레포 밖 scratchpad `qa_fixture.xlsx`.
- 파괴 전 안전 확인: 업로드 대상 월(2019-03) 기존 거래 0건 확인(전체 테이블이 0건) → delete-then-insert가 지울 실데이터 없음.
- AC-6 업로드 실행 → 위 응답 → DB 카운트 확인 → 정리 TRUNCATE → 정리 후 0건·보존 테이블 불변 재확인.
- 빈 상태 안정성(엣지: 완전 빈 데이터셋): 백엔드 엔드포인트 직접 호출로 500 없음 확인 —
  - `/api/v1/accounts`, `/transactions`, `/goals` → 200 `[]`
  - `/api/v1/analytics/dashboard?month=2026-07` → 200 `{income_total:0, expense_total:0, budgets:[], expense_by_category:[]}`
  - `/api/v1/analytics/assets` → 200 `{accounts:[], total:0, grand_total:0, trend:[...0...]}`
  - `month` 누락 시 `/analytics/dashboard` → 422(정상 검증).
- 브라우저 375px 실측(레시피 A): **미수행**. 이 작업은 frontend 코드 변경이 전혀 없어(코드 산출물 없음) 모바일 UI AC가 계약에 없고 적용 대상 아님. 부수적으로 시도한 브라우저 접근도 Chrome 도구의 네트워크 컨텍스트에서 `http://localhost:3000`이 3회 연속 `ERR_CONNECTION_REFUSED`(호스트 curl은 200) — 브라우저 샌드박스의 localhost 도달 불가. 프론트 HTML(200)·API(200)는 호스트에서 서빙 정상 확인. UI 코드 무변경이라 판정에 영향 없음.

## 발견 이슈
- [Low] `docs/tasks/2026-07-23-reset-accounts-transactions/implementation.md:15,19,21,27` — AC-4는 research에서 `app_settings` 보존을 명시(research.md:32)하나, implementation.md의 범위/자가 검증 기록은 `members·categories·budgets·goals`만 나열하고 `app_settings`를 빠뜨림. 기능상 `app_settings`(2건)는 TRUNCATE 대상이 아니어서 보존되며 QA가 직접 확인함 → 사용자 영향 없음. 문서-명세 검증 커버리지 누락(Low).
- High: 없음. Medium: 없음.

이슈를 못 찾은 게 아니라, 파괴적 운영 작업의 성격상 다음을 적극 시도해 확인했다: (1) 정리용 TRUNCATE를 직접 재실행해 FK 안전성을 독립 재현, (2) CASCADE가 보존 대상 테이블을 건드리지 않는지 전/후 카운트로 관찰, (3) 실제 엑셀 업로드로 AC-6 재생성을 재현, (4) 빈 데이터셋에서 집계 엔드포인트 500 여부를 직접 호출. 그 결과 기능 결함은 발견되지 않았고 문서 커버리지 Low 1건만 남았다.

## QA 중 적용한 수정 (Low 한정)
- 없음. 위 Low(implementation.md의 app_settings 누락)는 "누락된 검증 기록 보완"에 해당하며, 정확히 보완하려면 초기화 **이전** app_settings 카운트가 필요하나 그 시점은 QA 시작 전에 지나 재구성 불가하다. 사실을 확정할 수 없어 자동 수정하지 않고 이슈 보고로만 남긴다(가이드: 판단이 애매하면 수정하지 않음). 빌드/린트 재실행 대상 변경 없음(코드 무변경).

## 수정 Action Items (FAIL/CONDITIONAL 시)
- 해당 없음 (PASS). Medium/High 이슈 없음.

## 다음 단계
- PASS — 코드 산출물이 없는 1회성 운영 작업이므로 `/git-commit`으로 커밋할 diff는 없다(research.md:26, implementation.md:7 명시). 파이프라인상 커밋 단계는 생략 가능.
- 사용자 후속: DB는 의도된 빈 상태로 정리되어 있으니 사용자의 실제 엑셀 재업로드를 진행하면 된다. 재업로드된 계정은 업로드 시 선택한 단일 구성원 소유·이름 휴리스틱 유형으로 생성되므로, 소유자/유형 보정이 필요하면 기준정보관리에서 별도 조치(research 보류 항목).
