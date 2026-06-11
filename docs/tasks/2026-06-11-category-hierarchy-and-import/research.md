# Research: 카테고리 대/소분류 개편 + 뱅크샐러드 엑셀 월별 업로드

- 날짜: 2026-06-11
- 요청 원문: 이체는 우선 스킵하자. 환불은 수입으로 반영해줘. 카테고리 이름은 엑셀 기준으로 우리 앱의 기준정보를 재정리 하자. 시드 값을 엑셀 카테고리 내역으로 모두 정리해줘. 그리고 기준정보 카테고리를 대/소분류로 변경해서 엑셀과 완전 일치하게 해줘
- 선행 조사: `docs/tasks/2026-06-11-monthly-excel-import/research.md` (월별 업로드 설계 — 본 문서가 결정 사항을 반영해 대체·확장함)

## 요약

선행 조사의 미해결 질문 3건이 모두 결정되었다: **이체는 스킵**, **환불(지출+양수)은 수입으로 반영**, **카테고리 기준정보를 엑셀의 대/소분류 2단계 체계로 전면 개편**. 현재 Category는 단일 레벨(name, kind, nature)이고(`backend/app/models.py:35-46`) 시드 16종(`backend/alembic/versions/0002_seed_master_data.py:57-78`)은 엑셀 분류와 어긋난다. 본 작업은 (1) categories 테이블을 대분류(major)+소분류(minor) 구조로 바꾸는 마이그레이션과 엑셀 전수(지출 56쌍 + 수입 3쌍) 재시드, (2) 기존 시드 카테고리를 참조하는 거래·예산의 재매핑, (3) 카테고리 CRUD API·프론트(설정/거래/예산/대시보드) 2단계 대응, (4) 월별 엑셀 업로드 엔드포인트 구현으로 구성된다. 환불 행은 카테고리 kind 검증(`backend/app/routers/transactions.py:33-37`)과 충돌하므로 앱 자체 수입 카테고리 '환불 > 미분류' 1건을 추가 시드하고 원래 분류는 memo에 보존하는 방식을 제안한다.

## 엑셀 카테고리 전수 (시드 원천 데이터)

파일 `2025-06-11~2026-06-11.xlsx`의 "가계부 내역" 시트 928행을 직접 파싱한 결과. **이체 전용 대분류(내계좌이체·이체·카드대금·투자·저축·현금 및 이체의 미분류)는 이체 스킵 결정에 따라 시드에서 제외**한다.

### 지출(expense) — 15개 대분류, 56쌍
| 대분류 | 소분류 |
|---|---|
| 경조/선물 | 선물 |
| 교육/학습 | 학원/강의 |
| 교통 | 대중교통, 철도, 택시 |
| 구독 | 서비스구독 |
| 금융 | 보험, 세금/과태료, 은행, 이자/대출, 증권/투자, 카드 |
| 문화/여가 | 게임, 도서, 미분류, 영화, 음악, 전시/관람, 취미/체험 |
| 미분류 | 미분류 |
| 생활 | 가전/가구, 마트, 미분류, 생필품, 편의점 |
| 식비 | 미분류, 배달, 식재료 |
| 여행/숙박 | 관광, 미분류, 숙박비, 여행, 항공권, 해외결제 |
| 의료/건강 | 건강용품, 미분류, 보조식품, 약국, 운동, 한의원 |
| 자동차 | 대리운전, 세차, 정비/수리, 주유, 주차, 차량보험, 통행료 |
| 주거/통신 | 관리비, 미분류, 인터넷, 휴대폰 |
| 카페/간식 | 기타간식, 미분류, 커피/음료 |
| 패션/뷰티 | 패션, 헤어 |

### 수입(income) — 3쌍 + 앱 자체 추가 1쌍
| 대분류 | 소분류 | 비고 |
|---|---|---|
| 금융수입 | 미분류 | |
| 급여 | 미분류 | |
| 기타수입 | 미분류 | |
| 환불 | 미분류 | **엑셀에 없는 앱 자체 추가** — 환불 행(지출+양수 48건)의 수입 반영용 |

### nature(fixed/variable) 제안 기본값
엑셀에는 성격 정보가 없으므로 다음만 fixed, 나머지는 variable (세부는 구현 재량):
- expense: 구독>서비스구독, 주거/통신 전체, 금융>보험, 금융>이자/대출, 자동차>차량보험
- income: 급여>미분류

## 관련 파일 및 근거

### 백엔드 — 카테고리 구조
- `backend/app/models.py:35-46` — Category 모델. 단일 name + `(name, kind)` 유니크. **대분류/소분류 컬럼 구조로 변경 대상**.
- `backend/app/models.py:49-68` — Transaction. category_id FK(RESTRICT) — 카테고리 행 단위 참조는 유지 가능(소분류 행을 참조). source 컬럼 부재 → 추가 대상.
- `backend/app/models.py:101-114` — Budget. category_id FK(RESTRICT), `(year_month, category_id)` 유니크 — 재매핑 시 충돌 가능성 검토 필요.
- `backend/app/schemas.py:44-61` — CategoryCreate/Update/Out. major/minor 필드 추가 대상.
- `backend/app/schemas.py:79-84` — TransactionOut.category_name — 표시명 합성 규칙 변경 지점.
- `backend/app/schemas.py:134-137, 141-144` — BudgetOut.category_name, CategoryAmount — 동일.
- `backend/app/routers/categories.py:12-41` — 카테고리 CRUD. 생성/수정 시 (major, minor, kind) 중복 409, 삭제 시 참조 중 409(기존 동작 유지).
- `backend/app/routers/transactions.py:28-37` — kind 일치 검증. 환불을 income으로 넣을 때 expense 카테고리와 충돌 → '환불' income 카테고리로 우회.
- `backend/app/routers/budgets.py:37-39` — 예산은 expense 카테고리 한정 검증. 소분류 행 단위 예산으로 그대로 유지.
- `backend/app/routers/analytics.py:44-55, 91-94` — 대시보드 expense_by_category가 카테고리 행 단위 group by. **56개 소분류가 도넛 차트에 그대로 나가면 과밀 → 대분류 기준 집계로 변경 필요**.
- `backend/alembic/versions/0002_seed_master_data.py:57-78` — 기존 시드 16종. alembic 이력은 불변으로 두고 **신규 마이그레이션에서 구조 변환 + 재시드 + 재매핑** 수행.
- `backend/alembic/versions/0003_asset_valuations_and_goals.py` — 현재 head=0003 → 신규는 0004.
- `backend/requirements.txt:1-6` — openpyxl 없음 → 추가.

### 프론트엔드 — 카테고리 사용처 (Explore 조사 + 직접 확인)
- `frontend/src/types.ts:26-31` — Category 인터페이스(id, name, kind, nature) → major/minor 반영.
- `frontend/src/stores/masterData.ts:27, 82-92` — categories 상태 + CRUD 액션. 입력 스키마 변경.
- `frontend/src/pages/SettingsPage.tsx:46-172` — 카테고리 탭: 테이블(이름/구분/성격)과 생성 다이얼로그(이름/구분/성격) → 대분류/소분류 입력·표시로 개편.
- `frontend/src/pages/TransactionsPage.tsx:58, 259, 325-346, 533-548` — 거래 폼 카테고리 셀렉트(kind로 필터), 목록 카테고리 필터 → 2단계(대분류 선택 → 소분류) 셀렉트로 개편. **이 파일에는 미커밋 변경(캘린더 필터 안내, 426-437행)이 있으므로 보존 주의**.
- `frontend/src/pages/BudgetsPage.tsx:30-32, 110-155` — 지출 카테고리별 예산 테이블 → 소분류 단위 유지하되 대분류로 묶어 표시(표시 방식은 구현 재량).
- `frontend/src/pages/DashboardPage.tsx:34, 45, 153, 184` — 도넛 차트(category_name), 예산 진행, 최근 거래 표시 — API 응답 형식 변경 추종.
- `frontend/src/lib/api.ts:3-7` — JSON 헤더 강제 → multipart 업로드 메서드 추가 필요.

## 설계 (고수준)

### 1. 카테고리 2단계 구조 (단일 테이블 권장)
- categories 테이블을 **단일 테이블 + 2개 이름 컬럼**으로 변경: 대분류(major), 소분류(minor), kind, nature. 유니크 제약 `(major, minor, kind)`.
- 근거: 거래·예산의 category_id FK를 그대로 유지할 수 있어(소분류 행 참조) 변경 반경이 최소이고, 엑셀 가져오기의 자연 키 (대분류, 소분류, kind) get-or-create와 1:1 대응한다. 별도 대분류 테이블(2-테이블) 안은 대분류 일괄 개명에 유리하나 FK·API·UI 변경 반경이 훨씬 커서 채택하지 않음.
- 표시명: "대분류 > 소분류" 합성(소분류가 '미분류'일 때 축약 여부는 구현 재량). TransactionOut/BudgetOut의 category_name 계약은 유지하되 값만 합성명으로.
- 컬럼명·API 필드명(major/minor vs group/name 등)은 구현 재량.

### 2. 마이그레이션 0004 (구조 변환 + 재시드 + 재매핑)
1. 소분류 컬럼 추가 → 기존 행 backfill(기존 name=대분류, 소분류='미분류') → 유니크 제약 교체.
2. 위 "엑셀 카테고리 전수" 표의 59쌍 + '환불>미분류'를 시드(이미 존재하는 쌍은 건너뜀 — 기존 시드 중 식비·카페/간식·교통·의료/건강·문화/여가·급여는 backfill 결과 '대분류>미분류' 형태로 이미 존재하게 됨. 단 교통>미분류는 엑셀에 없는 쌍이므로 아래 재매핑과 함께 처리).
3. 엑셀 체계에 없는 기존 시드를 재매핑 후 삭제. 매핑(거래·예산의 category_id를 대상 행으로 UPDATE 후 원본 행 DELETE):
   - 주거/관리비→주거/통신>관리비, 통신비→주거/통신>미분류, 보험→금융>보험, 구독 서비스→구독>서비스구독, 생활용품→생활>생필품, 경조사/선물→경조/선물>선물, 기타 지출→미분류>미분류, 식비→식비>미분류, 카페/간식→카페/간식>미분류, 의료/건강→의료/건강>미분류, 문화/여가→문화/여가>미분류, 급여→급여>미분류, 상여→기타수입>미분류, 이자/투자수익→금융수입>미분류, 기타 수입→기타수입>미분류
   - 교통: 엑셀에 정확한 대응 소분류가 없음 — 참조 거래/예산이 있을 때만 '교통>미분류' 행을 예외적으로 유지하고, 참조가 없으면 행 삭제(구현 재량으로 단순화 가능).
   - 예산 재매핑 시 `(year_month, category_id)` 유니크 충돌 가능성: 현 매핑은 대상이 모두 달라 충돌 없음. 방어 로직 여부는 구현 재량.
4. `transactions.source` 컬럼(기본 'manual') 추가 — 같은 0004에 포함하거나 분리(재량).

### 3. 월별 엑셀 업로드 (선행 조사 설계 승계 + 결정 반영)
`POST /api/v1/transactions/import` (multipart: file + month=YYYY-MM). 단일 DB 트랜잭션, 시트/헤더/월 0건 검증과 422 한국어 에러, 해당 월 `source='import'` 거래 삭제 후 삽입, ImportResult(삭제/생성/스킵 건수·사유, 신규 기준정보 목록) 반환 — 상세는 선행 research.md와 동일. 변경·확정 사항:
- **이체(157건) → 스킵** + 사유 보고 (확정).
- **환불(지출+양수, 48건) → 수입 거래로 등록**: kind='income', 카테고리는 '환불>미분류', memo에 원래 대분류/소분류와 내용을 보존(포맷 재량). 수입+음수 행은 데이터에 없으나 방어적으로 스킵 처리.
- **카테고리 매칭**: (대분류, 소분류, kind)로 조회, 없으면 nature='variable'로 자동 생성. 시드가 엑셀 전수와 일치하므로 이 파일 범위에서는 전부 매칭되고, 자동 생성은 미래 데이터 대비.
- **결제수단 → Account** name get-or-create(type 휴리스틱 재량), **0원·KRW 외 통화 스킵**, member_id=null, 완전 중복 행 dedup 없이 삽입 — 선행 설계 그대로.

### 4. 프론트엔드
- types/스토어: Category에 대분류/소분류 반영, ImportResult 타입 추가.
- SettingsPage 카테고리 탭: 대분류/소분류 컬럼 표시(대분류 그룹핑 재량), 생성/수정 다이얼로그에 대분류(기존 값 선택 또는 신규 입력)+소분류 입력.
- TransactionsPage: 거래 폼을 대분류→소분류 2단계 셀렉트로, 목록 필터도 동일하게(필터는 소분류 단위 category_id 유지). 업로드 버튼+다이얼로그(파일·월 선택, 교체 경고, 결과 요약) 추가, 성공 시 transactions+masterData 재조회.
- BudgetsPage: 소분류 단위 예산 유지, 대분류 그룹 표시(재량).
- DashboardPage: 도넛 차트는 **대분류 집계** 데이터 표시(백엔드 expense_by_category 변경 추종).

## 영향도

- **DB**: categories 구조 변경 + 재시드 + 거래/예산 category_id 재매핑(데이터 마이그레이션). transactions.source 추가. 다른 테이블 무영향.
- **API 계약 변경(파괴적)**: GET/POST/PUT /categories의 필드 구조, DashboardOut.expense_by_category 집계 단위(소분류→대분류). 프론트가 유일한 소비자이므로 동시 수정으로 흡수.
- **API 계약 유지**: transactions/budgets의 category_id 의미(카테고리 행 참조)와 category_name 필드명 유지(값은 합성명으로 변경).
- **analytics**: expense_by_category 쿼리 group by 변경(`backend/app/routers/analytics.py:44-55`). 예산 진행(BudgetProgress)은 소분류 단위 그대로.
- **프론트 6파일**(types, masterData, SettingsPage, TransactionsPage, BudgetsPage, DashboardPage) + api.ts. TransactionsPage·AssetsPage의 기존 미커밋 변경 보존 필요.
- **기존 데이터**: 마이그레이션이 기존 거래·예산을 새 카테고리로 재매핑하므로 데이터 손실 없음(매핑 표 적용).

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: `alembic upgrade head` 후 `GET /api/v1/categories`가 대/소분류 구조로 지출 56쌍(+교통>미분류 유지 시 57)·수입 4쌍('환불' 포함)을 반환하고, 본 문서의 엑셀 전수 표와 일치한다 — curl 응답을 표와 대조해 확인.
- [ ] AC-2: 마이그레이션 전 존재하던 거래·예산이 마이그레이션 후에도 조회되고 새 카테고리 표시명으로 나타난다 — 마이그레이션 전 수동 거래·예산 1건씩 생성 → upgrade → `GET /transactions`, `GET /budgets`로 잔존·표시명 확인.
- [ ] AC-3: 카테고리 CRUD가 2단계로 동작한다: (대분류, 소분류, 구분) 중복 생성 시 409, 거래가 참조 중인 카테고리 삭제 시 409 — Swagger로 확인.
- [ ] AC-4: 엑셀 업로드(`month=2026-05`) 시 해당 월의 지출·수입 행만 등록되고 이체 행은 스킵되어 응답 요약에 사유·건수가 보고된다(2026-05는 생성+스킵=92행) — 업로드 응답과 `GET /transactions?month=2026-05` 건수로 확인.
- [ ] AC-5: 환불 행(지출+양수)이 kind=income 거래로 등록되고 카테고리가 '환불'이며 memo에 원래 분류·내용이 보존된다 — 환불 16건이 있는 `month=2026-04` 업로드 후 거래 응답으로 확인.
- [ ] AC-6: 동일 월 2회 업로드 시 거래가 중복 누적되지 않고, 해당 월의 수동 입력 거래는 보존된다 — 수동 1건 추가 → 동일 파일 2회 업로드 → 건수 비교로 확인.
- [ ] AC-7: 파일에만 있는 결제수단이 Account로 자동 생성되어 거래에 연결된다(엑셀 11종) — 업로드 후 `GET /accounts`와 거래의 account_name으로 확인.
- [ ] AC-8: 시트 부재·필수 컬럼 누락·지정 월 0건이면 422 한국어 에러를 반환하고 기존 거래가 변하지 않는다 — 임의 xlsx와 빈 월로 확인.
- [ ] AC-9: 거래 페이지에서 대분류→소분류 2단계 셀렉트로 거래를 생성·수정·필터할 수 있다 — `docker compose up` 후 브라우저로 확인.
- [ ] AC-10: 설정 페이지에서 대/소분류 카테고리를 생성·수정·삭제할 수 있다 — 브라우저로 확인.
- [ ] AC-11: 거래 페이지에서 파일·월을 선택해 업로드하면 결과 요약이 표시되고 거래·기준정보 목록이 자동 갱신된다 — 실제 파일로 브라우저 확인.
- [ ] AC-12: 대시보드 도넛 차트가 대분류 기준으로 집계 표시되고, 예산 페이지·예산 진행이 회귀 없이 동작한다 — 업로드된 데이터로 브라우저 확인.
- [ ] AC-13: `npm run build`, `npm run lint`가 통과하고 backend가 기동된다 — 명령 실행으로 확인.

## Action Items

- [ ] `backend/requirements.txt`에 openpyxl 추가.
- [ ] models.py: Category 대/소분류 컬럼·유니크 제약 변경, Transaction.source 추가.
- [ ] 마이그레이션 0004: 구조 변환(backfill 포함) → 엑셀 전수 재시드 → 기존 시드 재매핑·정리(본 문서 매핑 표) → source 컬럼. downgrade는 best-effort(재량).
- [ ] schemas.py: Category 계열 필드 변경, ImportResult 추가, category_name 합성 규칙 반영.
- [ ] routers/categories.py: 2단계 CRUD(중복 409 메시지 포함).
- [ ] routers/analytics.py: expense_by_category 대분류 집계로 변경.
- [ ] 엑셀 파서·행 변환 모듈 + routers의 import 엔드포인트(이체 스킵, 환불→수입/'환불' 카테고리, get-or-create, source='import' 교체 업로드, ImportResult).
- [ ] frontend: types.ts·masterData.ts 갱신, SettingsPage 카테고리 탭 2단계 개편, TransactionsPage 폼·필터 2단계화 + 업로드 다이얼로그, BudgetsPage 표시 정리, DashboardPage 차트 추종, api.ts multipart 메서드.
- [ ] 검증: alembic upgrade, 실제 파일로 AC 전수 확인, build/lint.

## 미해결 질문

- '환불 > 미분류' 수입 카테고리는 엑셀에 없는 앱 자체 추가다("완전 일치"의 유일한 예외). 환불 거래를 담을 곳이 필요해 불가피하며, 대안(원래 지출 카테고리와 동명의 income 카테고리 자동 생성)은 카테고리 목록을 오염시켜 비채택 — 이 예외가 싫으면 구현 전에 알려줄 것.
- 기존 '교통' 카테고리(엑셀에 '교통>미분류' 쌍 없음)는 참조 데이터가 있으면 '교통>미분류'로 유지하는 절충안 — 참조가 없으면 깨끗이 삭제되며, 어느 쪽이든 동작에는 영향 없음.
- 컬럼·필드 명명(major/minor 등), 표시명 합성 규칙('미분류' 축약 여부), 예산·설정 페이지의 대분류 그룹핑 표현, nature fixed 지정 목록 세부는 구현 재량.
