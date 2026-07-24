# Implementation: 거래 시간(time) 추가 및 대출현황 엑셀 업로드

- 날짜: 2026-07-24
- 기반 명세: docs/tasks/2026-07-24-transaction-time-and-loan-import/research.md

## 변경 파일

### 백엔드
- `backend/app/models.py` — `Transaction`에 nullable `time`(sa.Time) 컬럼 추가. `datetime.time`/`Time` import 추가.
- `backend/alembic/versions/0011_transaction_time.py` — 신규 리비전(down_revision 0010): `transactions.time` 컬럼 추가/제거.
- `backend/app/excel_import.py` — `_to_time` 헬퍼 추가, `ParsedRow`/`ReviewRow`에 `time` 필드 추가, 파싱 루프에서 선택 컬럼 `시간` 적재. `parse_liabilities()` 신규: 뱅샐현황 부채 표(2번째 항목/상품명/금액 트리오)에서 대출을 loan 대상으로 추출.
- `backend/app/routers/transactions.py` — `_to_out`·import 거래 생성부(수입/지출·전환·이체)에 `time` 전달. `_effective_liabilities()` 신규(자산 정책 대칭). import 확정에 대출 음수 평가액 upsert 단계 추가, preview에 `liabilities` 반환, `ImportResult.loan_count` 채움.
- `backend/app/schemas.py` — `TransactionCreate`에 `time` optional 추가(Out 상속). `ImportLiabilityRow` 신규, `ImportPreview.liabilities`·`ImportResult.loan_count` 추가.

### 프론트엔드
- `frontend/src/types.ts` — `Transaction`/`TransactionInput`에 `time`, `ImportLiabilityRow` 신규, `ImportPreview.liabilities`·`ImportResult.loan_count` 추가.
- `frontend/src/pages/TransactionsPage.tsx` — `formatTime` 헬퍼. 폼 상태·초기값·편집채움·payload에 `time`. 테이블 날짜 컬럼 cell·모바일 리스트에 시간 표시. 폼에 시간 입력(`<Input type=time step=1>`, 미입력 허용). 업로드 미리보기에 대출 섹션, 결과에 대출 반영 건수, 자동커밋 가드에 `liabilities` 포함.

## 주요 결정

- **시간 저장**: research.md대로 `date`(Date)는 유지하고 `time`을 별도 nullable 컬럼으로 추가 — 월 필터·정렬 로직 불변, 하위호환. 엑셀 `시간`은 선택 컬럼(`REQUIRED_COLUMNS` 미포함)으로 없어도 파싱 실패 안 함.
- **시간 반영 범위**: 확정되는 income/expense뿐 아니라 이체 전환·이체 적재(ReviewRow)에도 time을 실어, 업로드된 모든 거래가 시각을 갖도록 함(AC-2 완전 충족).
- **폼 시간 입력**: `step="1"`로 초 단위까지 표시·왕복 — import된 초 정보가 편집 시 잘리지 않도록.
- **대출 반영**: 사용자 확인대로 `AssetValuation` 음수값(-대출원금)으로 오늘 날짜 upsert. `parse_liabilities`는 양수로 읽고 라우터에서 음수화. analytics 잔액/추이 공식이 그대로 차감·반영(집계 코드 변경 없음).
- **대출 정책**: 자산 평가(`_effective_valuations`)와 대칭인 `_effective_liabilities` — 상품명 dedupe, 0원 신규 미생성, 동명 비-loan 계정 제외, 없으면 loan 계정 자동 생성.
- **미리보기 값 표기**: 대출 미리보기는 원금(양수)을 `-금액`으로 붉게 표시해 "차감"임을 명시. 자동커밋 가드에 `liabilities`를 포함해 대출만 있는 파일도 미리보기가 뜨도록 함(AC-9).

## 자체 검증 결과

- 파서 스모크(참조 파일, openpyxl 독립 로드): `parse_ledger` 17건 전부 time 존재(예: 2026-06-10 19:11:27), review 행도 time 존재. `parse_liabilities` → `[('아낌e보금자리론','loan',243277183), ('카카오뱅크 마이너스 통장','loan',0)]` → **통과**.
- `python -m py_compile`(models/schemas/excel_import/transactions/0011) → **통과**(구문 오류 없음).
- `cd frontend && npm run build`(tsc -b && vite build) → **통과**(3672 modules, 빌드 성공. 청크 크기 경고는 기존과 동일한 무해 경고).
- 전체 백엔드 import(sqlalchemy 의존)는 로컬에 의존성 미설치로 미실행 — docker/CI 몫. 변경 파일은 py_compile로 구문 검증했고, `time` 어노테이션은 모듈 전역 `datetime.time`으로 해석됨을 확인.
- 브라우저 E2E(375px 모바일, 업로드→자산 반영 등)는 /qa 위임.

## 성공 기준 자가 체크

- [x] AC-1: `transactions.time`(sa.Time, nullable) + 0011 리비전 작성. `alembic upgrade head` 적용은 DB 필요 → /qa/docker에서 확인.
- [x] AC-2: 파싱 결과 17건 전부 time 채워짐, 라우터가 `time=row.time`/`r.time`/`base.time`로 적재. 시간 없는 행은 None.
- [x] AC-3: 테이블 cell·모바일 리스트에 `t.time` 있을 때만 `formatTime` 표시(없으면 날짜만).
- [x] AC-4: 폼에 시간 입력 추가, payload `time: form.time || null`(미입력 시 null). 편집 시 `t.time ?? ''`로 채움.
- [x] AC-5: `parse_liabilities`가 `아낌e보금자리론`(243277183)을 loan으로 추출(장기대출 carry-forward, 총부채 종료). 0원 마이너스통장은 `_effective_liabilities`에서 신규 미생성 필터.
- [x] AC-6: 동명 loan 계정에 오늘 날짜 `AssetValuation` 음수값 upsert, 재업로드 시 (account_id,date) 유니크로 갱신. (DB 검증은 /qa)
- [x] AC-7: 상품명 무매칭 시 loan 계정 자동 생성, 동명 비-loan 계정 제외. analytics 음수 평가액이 총자산 차감(코드 경로 확인).
- [x] AC-8: `parse_liabilities`는 시트/부채표 부재 시 `[]` 반환(거래 가져오기 무영향), 대출 반영은 커밋 트랜잭션 내 선택 단계.
- [x] AC-9: preview `liabilities`·result `loan_count` 반환, 프론트 미리보기/결과에 대출 항목·건수 표시.
- [x] AC-10(모바일): 시간 셀은 `whitespace-nowrap`, 폼 시간은 grid-cols-2 셀, 대출 섹션은 `truncate`+`justify-between` — 코드 수준 모바일 안전. 375px 실측은 /qa.
- [x] AC-11: `npm run build` 통과, 백엔드 변경 파일 py_compile 통과.

## 보류/미완 항목

- `alembic upgrade head` 실제 적용 및 전체 백엔드 런타임 import는 로컬 의존성 미설치로 미실행 — docker/`/qa` 환경에서 확인 필요.

## 재작업 (1회차) — QA FAIL 대응

- **해소한 QA 이슈 [High] 빌드 파손**: QA 스냅샷 시점에 **별개 병렬 작업 `transaction-link-ux-redesign`** 의 미완성 코드가 공유 파일(`TransactionsPage.tsx`)에 반쯤 적용돼 빌드가 25건+ TS 오류로 깨져 있었음(제거된 `linkOpen`/`selectedIncome` 등을 구 JSX가 참조). 이는 time/loan 작업 코드가 아니었음. 재검증 시점엔 해당 병렬 작업이 정리 완료되어 **`npm run build` EXIT=0 통과**, QA가 지목한 파손 심볼 전부 소거 확인. 내 time/loan 변경은 동시 편집에도 온전하며(오히려 link-ux UI가 `formatTime` 헬퍼를 재사용), 파서·py_compile 재검증 모두 통과.
- **[Medium] 범위 오염(두 작업 혼재)**: 여전히 유효 — 작업 트리가 time/loan과 link-ux-redesign을 같은 파일에서 공유. **커밋 분리는 `/git-commit` 단계·사용자 결정 사항**으로 인계(파괴적 분리는 병렬 작업을 훼손하므로 여기서 강행하지 않음).
- **[Medium] `_to_out` N+1 / [Low] `implementation.md` 보고 불일치 / [Low] 워크북 중복 파싱**: 첫 두 개는 link-ux 소관 코드(`_partner_of`)이거나 시점 차이로 인한 것으로 해소됨. 워크북 중복 파싱(자산·부채 각각 open)은 내 코드의 Low 항목이나 QA가 "무해"로 판정 — 최소 변경 원칙상 미수정.
- 재검증 로그: `npm run build` → EXIT=0 / `py_compile`(백엔드 5파일) → OK / `parse_ledger` 17/17 time / `parse_liabilities` `아낌e보금자리론(243277183)`.
