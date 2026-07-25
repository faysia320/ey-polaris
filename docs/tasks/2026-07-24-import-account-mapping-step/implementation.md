# Implementation: 엑셀 업로드 스텝 분리 — 자산계정 매핑 선행 후 거래 검토

- 날짜: 2026-07-24 (재작업 2회차: 2026-07-25)
- 기반 명세: `docs/tasks/2026-07-24-import-account-mapping-step/research.md`
- 재작업 1회차 — `qa-report.md`(CONDITIONAL PASS)의 Medium 3건(M-1/M-2/M-3) 해소
- 재작업 2회차 — `qa-report.md`(FAIL)의 High 1건(H-1)·Medium 2건(M-4/M-5) 해소 + Low 1건(L-6)

## 변경 파일
- `backend/app/schemas.py` — 계정 소스/매핑 스키마 추가(`ImportAccountSource`, `ImportAccountMapping`, `ImportAccountMapRequest`, `ImportAccountResolved`, `ImportAccountMapResult`), `ImportPreview.account_sources` 필드 추가.
- `backend/app/routers/transactions.py` — `_account_sources()` 헬퍼로 preview에 계정 소스 반환, 매핑 확정 엔드포인트 `POST /transactions/import/accounts` 신설, `import_transactions`에 `account_mappings` Form 필드와 `resolve_source()` 해석 경로 추가(연결/신규/제외 + 미전달 시 종전 동작 폴백).
- `frontend/src/types.ts` — `ImportSourceKind`, `ImportMappingAction`, `ImportAccountSource`, `ImportAccountMapping`, `ImportAccountResolved`, `ImportAccountMapResult` 타입과 `ImportPreview.account_sources` 추가.
- `frontend/src/lib/format.ts` — `ACCOUNT_TYPES`(유형 목록·표시 순서)와 `accountTypeLabel()`을 공용 위치로 이동.
- `frontend/src/pages/SettingsPage.tsx` — 로컬 `ACCOUNT_TYPES` 정의 제거하고 `@/lib/format`에서 import (동작 무변경).
- `frontend/src/pages/TransactionsPage.tsx` — 업로드 다이얼로그를 `입력 → 자산계정 매핑 → 이체 검토 → 결과` 스텝으로 재구성, 매핑 스텝 UI(소스별 연결/신규/제외)와 매핑 확정 호출·재조회 배선, 확정 매핑을 최종 임포트 요청에 전달.

### 재작업 1회차 (QA Medium 해소)
- `backend/app/routers/transactions.py` — (M-1) 자동 페어 이체에서 출금·입금이 같은 계정이면 두 다리를 사유와 함께 건너뛴다. (M-2) 결제수단 제외 검사를 검토 루프 상단으로 올려 결정이 없어도 제외 사유로 기록하고, 행당 한 번만 기록하는 `add_skip()` 헬퍼 도입. (M-2) `_account_sources()`가 소스별 `importable_count`를 함께 집계.
- `backend/app/schemas.py` — (M-2) `ImportAccountSource.importable_count` 추가(검토 없이 적재되는 수입/지출 행 수).
- `frontend/src/types.ts` — (M-2) `ImportAccountSource.importable_count` 미러.
- `frontend/src/pages/TransactionsPage.tsx` — (M-2) 검토 스텝이 제외 매핑을 반영한 목록/건수(`previewValuations`/`previewLiabilities`/`previewReview`/`previewImportableCount`)를 사용. (M-3) `mappingCandidates`에서 `is_active` 필터 제거 + 비활성 계정 라벨 표시, `confirmAccounts`에 "선택 계정이 후보에 없으면 오류" 방어 추가.

### 재작업 2회차 (QA High/Medium 해소)
- `backend/app/routers/transactions.py` — (H-1) 계정을 만들지 않는 순수 검사 `is_excluded()`를 추가하고 검토 루프 상단의 제외 판정을 그것으로 교체. `ensure_account()` 호출은 실제로 거래를 적재하는 분기(income/expense·자동 페어 이체·수동 이체)로 되돌렸다. (M-5) 상단 판정이 페어 상대의 제외까지 함께 보므로, 상대 결정이 없어도 수동 이체 분기로 새지 않는다(422 제거). 검토 루프에서 중복 조회하던 `pair`를 상단 `pair_row` 재사용으로 정리.
- `frontend/src/pages/TransactionsPage.tsx` — (M-4) `previewReview` 필터를 "자기 계정 제외 **또는** 페어 상대 계정 제외"로 확장. (M-5) `commitImport`가 화면에 표시한 행 목록을 인자로 받아 그 기준으로만 `decisions`를 만든다(전송 목록 = 표시 목록). (L-6) 매핑 후보 라벨에 `accountTypeLabel`을 붙여 동명이형 계정을 구분.

## 주요 결정
- **매핑 확정은 별도 엔드포인트 1회 호출**(`POST /transactions/import/accounts`). 여러 계정 생성의 원자성과 소스 종류별 유형 제약 검증을 서버 한 곳에 모았다. 확정 시 계정이 즉시 생성되므로 이어지는 검토 스텝의 상대 계정 드롭다운에서 바로 선택된다(research 결정 그대로).
- **create 재확정 안전성**: 매핑 스텝을 오가며 여러 번 확정할 수 있으므로, `create`는 같은 `(이름·소유자·유형)` 계정이 이미 있으면 새로 만들지 않고 재사용한다. 프론트도 생성 이력을 누적해 결과 화면에 표시한다.
- **최종 임포트에도 확정 매핑 전달**: 확정 응답의 `resolved`를 `link`/`exclude` 매핑으로 굳혀 `account_mappings`로 보낸다. 이름 재매칭이 아니라 계정 id로 적재되므로 "다른 이름의 기존 계정에 연결"(AC-4)이 성립한다.
- **하위호환 폴백**: `account_mappings` 미전달(빈 배열 포함) 소스는 종전 동작(구성원 스코프 이름 일치 → 없으면 휴리스틱 유형 생성)을 그대로 탄다. 기존 API 호출 계약이 깨지지 않는다.
- **제외 처리**: ledger 소스 제외 시 해당 결제수단의 수입/지출 행과 이체 검토 행 모두 적재하지 않고 `skipped`에 `'<이름>' 계정을 이번 업로드에서 제외함` 사유를 남긴다. 자동 페어 이체는 한쪽 다리만 제외돼도 이체가 성립하지 않으므로 두 다리 모두 건너뛴다. valuation/liability 제외는 계정·평가액을 만들지 않는다.
- **`created_count` 계산 변경**: 제외로 건너뛴 행이 생기므로 `len(parsed)` 대신 실제 적재 카운터(`imported_count`)를 쓴다.
- **유형 제약 이중 검증**: `SOURCE_REQUIRED_TYPE`(valuation=real_estate, liability=loan)을 매핑 확정과 임포트 양쪽에서 검사한다. 임포트를 직접 호출해도 잘못된 유형은 422로 거부된다.
- **easy_pay 신규 생성 금지**: `AccountCreate`가 `linked_account_id`를 필수로 요구하므로 마법사에서는 만들지 않는다(스키마 validator에서 거부). 기존 easy_pay 계정에 **연결**하는 것은 허용하며, 프론트 유형 선택지에서도 제외했다.
- **매핑 스텝 표시 정책**: 계정 소스가 하나라도 있으면 항상 표시한다(전부 기존 계정에 일치해도 "기존 계정 연결" 상태로 확인). 소스가 0개일 때만 건너뛰며, 검토·평가액도 없으면 종전처럼 곧바로 확정한다.
- research.md와 다르게 한 것: 없음. `excel_import.py`는 변경하지 않았다 — 결제수단별 행 수는 라우터에서 `parsed`+`review`로 집계 가능해 파서 보강이 불필요했다(Action Item의 "불필요하면 하지 않는다" 조건대로).

### 재작업 1회차 결정
- **M-1은 422가 아니라 skip**: 같은 계정으로 합치는 것이 매핑 기능의 정상 사용 사례이므로, 자동 페어 이체가 자기 이체가 되면 업로드를 실패시키지 않고 두 다리를 `출금·입금이 같은 계정('<계정명>')이라 이체로 기록하지 않음` 사유로 건너뛴다. 수동 상대 계정 지정은 사용자가 직접 고른 명시적 오류이므로 기존 422를 유지했다(QA Action Item의 권고와 동일).
- **제외 검사를 검토 루프 상단으로 이동**: M-2로 제외 소스의 이체 행이 화면에서 사라지면 그 행의 결정이 프론트에서 오지 않는다. 종전 순서(결정 확인 → 계정 확인)로는 "검토 결정 없음"이라는 부정확한 사유가 남고, 기본 제안이 `transfer`인 채 결정이 전달되면 상대 계정 누락으로 422까지 났다. 계정 제외를 먼저 판정해 어느 경우든 제외 사유로 기록된다.
- **행당 1회 기록(`add_skip`)**: 페어 이체는 두 다리 양쪽에서 같은 행에 도달할 수 있어 사유가 중복될 수 있었다. 파서가 넘긴 skip 행 번호를 초기 집합에 넣어 중복을 원천 차단한다.
- **`importable_count`를 소스별로 내려보냄**: `row_count`는 이체 검토 행까지 포함하므로 "수입/지출 N건" 문구에서 제외분을 정확히 빼려면 부족했다. 프론트가 계산할 수 없는 값(수입/지출 행의 결제수단 분포)이라 백엔드 필드 추가가 최소 방법이다.
- **M-3은 (a)안 채택**: preview의 `matched_account_id`에서 비활성 계정을 빼는 (b)안은, 같은 이름·유형의 비활성 계정이 있을 때 기본값이 `create`가 되어 `(name, member_id, type)` 복합 유니크와 부딪히거나(백엔드가 재사용하므로 실제로는 비활성 계정에 조용히 붙는다) 사용자가 상황을 알 수 없게 만든다. 후보에 남기고 `(비활성)` 라벨로 드러내는 편이 관찰 가능하다. 이체 검토 스텝의 상대 계정 드롭다운은 기존대로 활성만 유지했다(범위 밖).

### 재작업 2회차 결정
- **제외 판정과 계정 실체화 분리**: 1회차에서 제외 판정을 검토 루프 상단으로 올릴 때 `ensure_account()`를 그대로 썼는데, 이 함수는 매핑이 없는 소스에 대해 계정을 **생성**한다. 그 결과 건너뛸 행의 결제수단까지 계정이 생겼다(H-1, AC-10 회귀). 제외 여부는 `mappings_by_source` 조회만으로 답할 수 있으므로 부작용 없는 `is_excluded()`로 분리하고, 계정 생성은 적재 분기에서만 하도록 되돌렸다.
- **"페어 한쪽 제외 → 두 다리 모두 제외"를 서버·프론트 공통 계약으로**: 상단 판정이 페어 상대의 제외까지 함께 보므로, 상대의 결정이 없어도 수동 이체 분기로 떨어져 422가 나는 경로가 사라진다(M-5). 프론트도 같은 기준으로 생존 다리를 숨긴다(M-4). 부작용으로, 페어링된 두 행을 각각 수입/지출로 전환하려는 경우 한쪽 계정을 제외하면 나머지도 등록되지 않는다 — 그 경우 제외 대신 다른 계정에 연결하면 된다.
- **`commitImport`가 표시 목록을 인자로 받음**: 전송하는 `decisions`와 화면에 보여준 행이 항상 같아지도록 호출부에서 목록을 넘긴다. 종전에는 `preview.review`(전체)를 써서, 숨긴 행의 결정이 함께 전송되는 바람에 서버의 422 경로가 우연히 가려져 있었다(QA 지적).
- **L-6은 포함, 나머지 Low는 보류**: 동명이형 계정이 같은 라벨로 두 번 나오면 실제로 선택이 불가능해 매핑 스텝의 기능 결함에 가깝다. 라벨 한 줄 변경으로 닫히므로 포함했다. L-7~L-9는 정책 결정이나 구조 변경이 필요해 보류했다.

## 자체 검증 결과

**(재작업 2회차)** 해소한 QA 이슈: H-1(매핑 미전달 임포트가 건너뛴 행의 계정을 생성 — AC-10 회귀), M-4(생존 다리가 등록될 것처럼 표시), M-5(제외 행 결정 생략 시 422), L-6(동명이형 계정 라벨). 검증은 **거래 0건인 2019-03**과 `IMPL2*` 임시 계정으로만 수행했고, 실행 전 0건을 확인했다.

- `python -m compileall backend/app/routers/transactions.py` → 통과.
- `npm run build` → 통과(`dist/static/index-Dt0nTrEu.js`). `npm run lint` → `0 errors, 2 warnings`(기존 `TransactionsPage.tsx:579,582` 경고, 이번 변경과 무관).
- `docker compose up -d --build` 후 스모크:
  - **H-1 회귀 검증**: `account_mappings` 생략 + `decisions=[]`로 임포트 → `created_accounts: ['IMPL2일반카드']`뿐. 이체 검토 행에만 등장하는 `IMPL2통장A`/`IMPL2통장B`/`IMPL2단독수단`은 **생성되지 않음**(모두 `검토 결정 없음 — 건너뜀`). 계정 총수도 25→26으로 실제 적재된 1개만 증가.
  - **M-5 검증**: `IMPL2통장A`를 제외하고 생존 다리(4행)의 결정을 **생략**한 채 임포트 → **HTTP 200**(종전 422), 3행·4행 모두 `'IMPL2통장A' 계정을 이번 업로드에서 제외함`으로 기록, 중복 없음. 제외된 두 다리의 계정도 생성되지 않음.
  - 정리 후 baseline 복원 확인 — accounts 25, categories 84, 2019-03 거래 0건, 2026-06 거래 129건, `IMPL%` 계정 0건.
- M-4(화면 표시)와 L-6(라벨)의 브라우저 확인은 `/qa` 위임. 컨테이너는 이번 변경으로 재빌드해 두었다.

### 1회차 검증 기록

**(재작업 1회차)** 해소한 QA 이슈: M-1(자기 이체 적재), M-2(제외 항목이 "반영될" 대상으로 표시), M-3(비활성 계정 매칭 불일치). 재검증은 QA와 동일하게 **거래 0건인 2019-03**과 `IMPL*` 임시 계정으로만 수행했고, 실행 전 대상 월 0건을 확인했다. 정리 후 baseline 복원 확인 — accounts 25, categories 84, 2019-03 거래 0건, 2026-06 거래 129건, `IMPL%` 계정 0건.

- `python -m compileall backend/app/routers/transactions.py backend/app/schemas.py` → 통과(재작업 후 재실행).
- `npm run build` → 통과(`✓ built`, `dist/static/index-C8kiZ6Ol.js`). `npm run lint` → `0 errors, 2 warnings`(기존 `TransactionsPage.tsx:577,580` 경고, 이번 변경과 무관).
- `docker compose up -d --build` 후 백엔드 스모크:
  - **M-2 필드**: preview가 소스별 `importable_count`를 정확히 분리 — `IMPL별칭A(row_count=2, importable_count=1)`, `IMPL별칭B(row_count=2, importable_count=1)`. 전체 `importable_count=2`와 합치가 일치.
  - **M-1 재현 → 해소**: 두 ledger 소스를 같은 계정(id 52)에 `link` + 자동 페어 이체 두 다리를 `transfer`로 임포트 → `transfer_count: 0`, 두 다리 모두 `출금·입금이 같은 계정('IMPLTMP통합계좌')이라 이체로 기록하지 않음` 사유로 skip. DB 조회 결과 해당 월 거래는 수입/지출 2건뿐이고 `counter_account_id`가 채워진 행 없음(자기 이체 미생성).
  - **제외 소스 + 빈 decisions**: `IMPL별칭A`를 제외하고 `decisions=[]`로 임포트 → 422 없이 200, 2행(지출)과 4행(이체) 모두 `'IMPL별칭A' 계정을 이번 업로드에서 제외함`, 5행은 `검토 결정 없음 — 건너뜀`. 행 중복 기록 없음(`add_skip` 동작 확인).
- **미수행(의도적)**: 2026-06 실데이터 월을 대상으로 한 임포트는 하지 않았다(delete-then-insert로 실데이터가 지워진다).

### 최초 구현 시 검증 (재작업 전)
- `python -m compileall backend/app/routers/transactions.py backend/app/schemas.py` → 통과(OK).
- `npm run build` (frontend, tsc + vite) → 통과. 빌드 성공, 타입 오류 없음.
- `npm run lint` (frontend, eslint) → 통과(0 errors). 경고 2건은 기존 `useReactTable`/`useMemo` 관련으로 이번 변경과 무관한 지점(`TransactionsPage.tsx:577,580`).
- `docker compose up -d --build` 후 백엔드 스모크(실제 DB, 데이터 변경 없는 경로만):
  - `GET /openapi.json` → `/api/v1/transactions/import/accounts` 노출, `ImportAccountSource` 등 5개 스키마 등록 확인.
  - `POST /transactions/import/preview` (openpyxl로 만든 샘플 .xlsx, 2026-06, member 2) → `account_sources` 5건 반환 확인:
    `ledger:롯데 카드(matched=null, card, 2건)`, `ledger:WON 통장(matched=2, bank, 2건)`, `ledger:새로운페이(matched=null, other, 1건)`, `valuation:우리아파트(real_estate, 5억)`, `liability:주택담보대출(loan, 2억)`.
  - `POST /transactions/import/accounts` 검증 경로: easy_pay 신규 → 422 / 대출 소스를 bank 계정에 연결 → 422 / 다른 구성원 계정 연결 → 422 / 없는 계정 → 404 / exclude만 → 200(생성 없음) / 정상 link → 200. 호출 전후 계정 수 25 그대로(테스트 잔재 없음).
- **미수행(의도적)**: 실제 `POST /transactions/import` 실행 검증. 이 엔드포인트는 대상 월·구성원의 기존 `source='import'` 거래를 삭제 후 재등록하므로, 사용자 운영 DB에서 임의 실행하면 실제 데이터가 지워진다. 제외·연결·유형 반영의 종단 확인은 `/qa`에서 안전한 월/데이터로 수행해야 한다.
- 브라우저 E2E(스텝 진행·모바일 375px)는 `/qa` 위임. 프론트·백엔드 컨테이너는 이번 변경으로 재빌드해 두어 `/qa`가 바로 확인할 수 있다(http://localhost:3000).

## QA 이슈 해소 (재작업 2회차)
- [x] **H-1** (AC-10 회귀): 제외 판정을 부작용 없는 `is_excluded()`로 바꾸고 계정 실체화를 적재 분기로 되돌렸다. 매핑 생략 임포트에서 거래 0건 계정이 만들어지지 않음을 실측.
- [x] **M-4**: `previewReview`가 페어 상대의 제외까지 반영해 생존 다리를 함께 감춘다 → 빈 이름 `자동 페어 ↔ (N행)` 렌더가 사라지고, `아래 이체 N건` 카운트가 서버 동작(두 다리 건너뜀)과 일치한다. 화면 확인은 /qa 위임.
- [x] **M-5**: 페어 상대의 계정 제외를 `pair_decision` 유무보다 먼저 판정한다. 제외 행의 결정을 생략한 요청이 422 대신 200으로 처리되고 두 다리 모두 제외 사유로 기록됨을 실측. 아울러 `commitImport`가 표시 목록 기준으로 decisions를 만들어 프론트 전송 목록과 서버 기대를 일치시켰다.
- [x] **L-6**(선택): 매핑 후보 라벨에 계정 유형을 붙여 동명이형 계정을 구분(`이름 · 유형`, 비활성이면 ` (비활성)`).
- L-7~L-9는 미처리 (아래 보류 항목 참조).

## QA 이슈 해소 (재작업 1회차)
- [x] **M-1** (`transactions.py` 자동 페어 이체 분기): `from_account.id == to_account.id`면 두 다리를 사유와 함께 `skipped`에 넣고 이체를 만들지 않는다. 재현 시나리오 재실행으로 `transfer_count: 0` + 자기 이체 미생성 실측.
- [x] **M-2** (검토 스텝 표시): `반영될 평가액`/`반영될 대출 잔액` 목록에서 제외 항목을 걸러 0건이면 섹션 자체가 사라지고, 제외된 결제수단의 이체 검토 행도 목록에서 빠진다. `수입/지출 N건` 문구는 새 `importable_count`로 제외분을 차감한다. 함께, 서버가 제외 소스 행을 결정 유무와 무관하게 제외 사유로 기록하도록 순서를 바로잡아 화면에서 사라진 행이 422를 유발하지 않게 했다(빈 `decisions` 임포트로 실측).
- [x] **M-3** (비활성 계정): `mappingCandidates`에서 `is_active` 필터를 제거해 preview의 매칭 스코프와 일치시키고, 비활성 계정은 `(비활성)` 라벨로 구분한다. `confirmAccounts`에 "선택 계정이 후보에 없으면 오류" 방어를 추가했다.
- Low 이슈: L-1은 QA가 이미 수정. L-2~L-5는 이번 재작업 범위에 넣지 않았다(아래 보류 항목 참조).

## 성공 기준 자가 체크
- [x] AC-1: preview가 결제수단·부동산·대출 소스를 모두 반환하고 matched_account_id·suggested_type·row_count/amount를 채운다 — 위 스모크 응답으로 실측 확인. 재작업으로 `importable_count`가 추가돼 소스별 수입/지출 행 수까지 내려온다(실측).
- [x] AC-2: 다이얼로그가 입력 → 매핑 → 검토 → 결과 순으로 진행되고, 소스가 있으면 매핑 스텝이 항상 표시된다(`TransactionsPage.tsx`의 `importStep` 분기; `runImport`는 소스 0개일 때만 건너뜀) — 브라우저 확인은 /qa 위임.
- [x] AC-3: 소스별 `기존 계정 연결 / 새로 만들기 / 이번엔 제외` Select와 기본값(matched면 link, 아니면 create+추정 유형) 구현 — `runImport`의 choices 초기화 및 매핑 스텝 렌더.
- [x] AC-4: link 매핑이 최종 임포트에 계정 id로 전달되어 이름이 달라도 기존 계정에 붙고 새 계정을 만들지 않는다 — `resolve_source`의 link 분기(ensure_named_account 미호출 → created_accounts 미기록). 종단 실행 확인은 /qa 위임(운영 DB 보호).
- [x] AC-5: 매핑 확정 시 계정이 즉시 생성되고 `fetchAll()`로 기준정보를 재조회해 검토 스텝 상대 계정 드롭다운에 반영된다 — `confirmAccounts` 구현. 화면 확인은 /qa 위임.
- [x] AC-6: exclude된 ledger 소스의 수입/지출·이체 행을 적재하지 않고 `skipped`에 사유를 남긴다 — 재작업으로 검토 루프 상단의 단일 지점에서 판정하도록 정리했고, 빈 `decisions`로도 제외 사유가 남는 것을 실측(2행·4행 제외 사유, 중복 기록 없음).
- [x] AC-7: exclude된 부동산·대출은 계정도 평가액도 만들지 않는다 — 평가액·부채 루프가 `resolve_source` None에서 continue.
- [x] AC-8: 유형이 맞는 계정만 후보로 보이고(프론트 `mappingCandidates` — 재작업 후에도 유형 필터는 유지, 활성 여부 필터만 제거), 서버도 잘못된 유형을 422로 거부 — 스모크에서 "대출 소스를 bank 계정에 연결" 422 실측.
- [x] AC-9: 매핑에서 고른 유형으로 계정이 생성된다 — 확정 엔드포인트의 create 분기가 `mapping.type`을 그대로 사용(휴리스틱 미적용). 화면 확인은 /qa 위임.
- [x] AC-10: `account_mappings` 미전달 임포트는 종전 동작 유지 — Form 기본값 `"[]"`, `resolve_source`가 매핑 없으면 `ensure_named_account` 폴백. 2회차에서 회귀(H-1)가 발견돼 계정 생성 시점을 적재 분기로 되돌렸고, 매핑 생략 임포트가 **실제로 적재되는 계정만** 만드는 것을 실측으로 재확인.
- [x] AC-11: 매핑 확정 실패 시 오류 메시지를 띄우고 매핑 스텝에 머문다(`confirmAccounts`의 catch — `setImportStep` 미호출), 확정은 단일 트랜잭션(`commit_or_conflict`)이며 임포트도 종전대로 단일 트랜잭션이다. 재작업으로 "후보에 없는 계정 선택" 클라이언트 방어가 추가돼 같은 스텝에서 오류로 잡힌다.
- [x] AC-12: 매핑 스텝 안내 문구에 "여기서 확정하면 계정이 바로 만들어져요 (업로드를 취소해도 계정은 남고, 설정에서 지울 수 있어요)" 노출.
- [ ] AC-13(모바일): 375px 검증은 `/qa` 담당. 구현 측 근거 — 매핑 카드는 세로 스택 + `flex-wrap`, Select는 `w-32`/`w-36`/`w-44`로 375px 다이얼로그 폭 안에서 줄바꿈되며 이름은 `truncate`, 고정 px 폭 미사용.
- [x] AC-14: `npm run build`·`npm run lint` 모두 통과(위 검증 결과).

## 보류/미완 항목
- `AssetsPage.tsx`의 `ACCOUNT_TYPE_LABEL`(Record 형태, 그룹 표시 순서용)은 이번 범위 밖이라 통합하지 않았다 — 용도·정렬 순서가 달라 통합 시 표시 순서가 바뀔 수 있다.
- 2회차 QA Low 이슈 중 미처리분:
  - **L-7** 검토 스텝의 상대 계정 드롭다운이 다른 구성원 계정까지 나열 — 이번 변경 이전부터의 동작이고, 좁히면 기존 사용 흐름(공동 사용 계좌를 상대로 지정)을 막을 수 있어 정책 결정이 필요하다.
  - **L-8** 매핑 확정과 임포트의 계정 생성 블록 중복(1회차 L-2와 동일) — 두 경로의 카운터·세션 수명이 달라 헬퍼 시그니처 설계가 필요하다. 동작 영향 없음.
  - **L-9** 매핑 스텝 Select 높이 30px — 같은 다이얼로그의 기존 컨트롤과 동일한 값이라, 바꾸려면 다이얼로그 전반의 터치 타깃 정책으로 다뤄야 한다.
- 1회차 QA Low 이슈 중 미처리분(권고 사항이며 이번 계약에는 없음):
  - **L-2** 매핑 확정과 임포트의 "찾고 없으면 생성" 블록 중복 — 공통 헬퍼로 뽑으려면 두 경로의 세션/카운터 수명이 달라 시그니처 설계가 필요하다. 동작에는 영향이 없어 별도 작업으로 남긴다.
  - **L-3** 제외 안내가 "재업로드 시 그 달의 기존 해당 계정 거래가 삭제된 채 복구되지 않는다"는 점을 알리지 않음 — 문구 추가는 쉬우나 delete-then-insert 정책 전반의 안내와 함께 다듬는 것이 맞다고 판단.
  - **L-4** 결제수단명과 부동산·대출 상품명이 같을 때 확정 매핑이 `_effective_*` 재계산에서 걸러질 수 있음 — 이번 변경 이전과 동일한 호출 순서이며 회귀가 아니다. 해소하려면 평가/부채 목록 계산을 preview 시점 값으로 고정하는 구조 변경이 필요해 범위를 벗어난다.
  - **L-5** `exclude` 분기 앞의 불필요한 `required_type` 계산 — 동작 영향 없음.
