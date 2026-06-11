# Research: 뱅크샐러드 엑셀 월별 거래 업로드 (가져오기)

- 날짜: 2026-06-11
- 요청 원문: @2025-06-11~2026-06-11.xlsx 매달 한번씩 이 파일을 업로드 하고 싶어. 가계부 내역 탭을 보면 1년간 사용 내역이 있는데 이걸 업로드 시점에 설정한 달만 업로드 하는거지. 기존 업로드 내역이 이미 있다면 삭제후 업로드 하면 돼. 그리고 대분류/소분류에 대응하는 기준정보를 어떻게 할지, 결제수단에 대응하는 기준정보를 어떻게할지, 내용 등 각 항목을 어떻게 업로드할지 고민해서 설계해줘

## 요약

업로드 대상 파일은 뱅크샐러드 내보내기 형식의 xlsx로, "가계부 내역" 시트에 1년치(928행) 거래가 들어 있다(컬럼: 날짜·시간·타입·대분류·소분류·내용·금액·화폐·결제수단·메모). 현재 앱에는 파일 업로드 기능과 거래 일괄 삭제 기능이 없고, 거래는 단건 CRUD만 지원한다(`backend/app/routers/transactions.py:40-104`). 따라서 **월 단위 가져오기 전용 엔드포인트** `POST /api/v1/transactions/import`(multipart 파일 + `month=YYYY-MM`)를 신설하고, 백엔드에서 openpyxl로 파싱 → 지정 월 행만 추출 → **기존 '가져오기 출처' 거래만 삭제 후 일괄 삽입**을 단일 DB 트랜잭션으로 처리하는 설계를 제안한다. 수동 입력 거래를 보호하기 위해 `transactions.source` 컬럼('manual'|'import')을 추가한다. 기준정보는 **대분류 → Category(name+kind로 get-or-create)**, **결제수단 → Account(name으로 get-or-create)** 전략으로 자동 생성하고, 소분류·내용은 memo 필드에 보존한다. 엑셀의 '이체' 타입(157건)과 모순 행(지출인데 양수 48건, 0원 1건)은 앱의 income/expense 모델에 맞지 않으므로 스킵하고 응답 요약에 사유·건수를 보고한다.

## 엑셀 파일 분석 (직접 파싱 결과)

파일: `2025-06-11~2026-06-11.xlsx` (저장소 루트). 시트 2개: "뱅샐현황", **"가계부 내역"**(헤더 1행 + 데이터 928행).

| 컬럼 | 내용 | 비고 |
|---|---|---|
| A 날짜 | 엑셀 날짜 시리얼(예: 46183) | date 변환 필요 (기준 1899-12-30) |
| B 시간 | 하루 비율 소수 | 거래 모델에 시간 없음 → 버림 |
| C 타입 | 지출 752 / 이체 157 / 수입 19 | 앱 kind는 income\|expense뿐 |
| D 대분류 | 약 25종 (식비, 교통, 자동차, 여행/숙박, 미분류 등) | 카테고리 매핑 대상 |
| E 소분류 | 미분류 비중 높음 (예: 식비>미분류 83건) | 별도 기준정보 없음 |
| F 내용 | 가맹점/적요. 빈 행 0건 | memo 후보 |
| G 금액 | 지출은 음수, 수입은 양수가 원칙 | 예외: 지출+양수 48건(환불), 지출 0원 1건 |
| H 화폐 | 전부 KRW | 검증만 |
| I 결제수단 | 11종 (ALL 우리카드 Infinite 562, WON 통장 175, 네이버페이 간편결제 52 등) | Account 매핑 대상 |
| J 메모 | 전부 빈 값 | 비어 있으면 무시 |

- 월별 분포: 2025-06(45) ~ 2026-06(20). 매월 45~149건.
- (날짜, 금액, 내용, 결제수단)이 완전히 같은 중복 키 11건 존재(예: 2026-04-08 −50,000 카카오페이 ×3) — 실거래이므로 dedup 없이 그대로 삽입해야 함.
- 이체 행의 대분류: 내계좌이체 36, 이체 62, 카드대금 18, 투자 17, 저축 14, 미분류 7, 현금 3. 카드 지출과 카드대금 출금이 모두 기록되어 있어 이체를 수입/지출로 넣으면 **이중 계산**이 발생한다 → 스킵이 안전.

## 관련 파일 및 근거

- `backend/app/models.py:49-68` — Transaction 모델. 필드: date, amount(BigInteger, 항상 양수), kind('income'|'expense'), category_id(RESTRICT), account_id(RESTRICT), member_id(nullable), memo(String(255)). **시간·출처(source) 필드 없음** → source 컬럼 추가 필요.
- `backend/app/models.py:35-46` — Category 모델. 단일 계층(name, kind, nature). `(name, kind)` 유니크 제약 → 대분류 get-or-create의 자연 키.
- `backend/app/models.py:21-32` — Account 모델. name 유니크, type('bank'|'cash'|'card'|...), opening_balance, is_active. 결제수단 매핑 대상.
- `backend/app/schemas.py:65-72` — TransactionCreate. `amount: int = Field(gt=0)` → 0원·음수 그대로는 불가. 가져오기 시 절대값 변환 + 0원 스킵 필요.
- `backend/app/schemas.py:6` — `YEAR_MONTH_PATTERN` — month 파라미터 검증에 재사용.
- `backend/app/routers/transactions.py:28-37` — `_validate_refs`: 카테고리 kind와 거래 kind 일치 검증. 가져오기 로직도 동일 불변식을 지켜야 함(환불 행을 income으로 뒤집으면 expense 카테고리와 충돌).
- `backend/app/routers/transactions.py:58-64` — month 필터의 날짜 범위 계산 로직. 삭제 범위 계산에 동일 패턴 재사용 가능.
- `backend/app/routers/utils.py` — `get_or_404`, `commit_or_conflict` 공용 유틸. 신규 라우터에서 재사용.
- `backend/app/main.py:29-37` — `/api/v1` 라우터 등록 지점. import 라우트는 transactions 라우터에 추가하면 별도 등록 불필요.
- `backend/requirements.txt:1-6` — openpyxl 없음 → 의존성 추가 필요.
- `backend/alembic/versions/0002_seed_master_data.py:57-78` — 시드 카테고리 16종. 엑셀 대분류와 이름이 일치하는 것: 식비, 카페/간식, 교통, 의료/건강, 문화/여가 (5종) → get-or-create 시 자연 재사용됨. 나머지(자동차, 여행/숙박, 생활, 금융, 미분류 등)는 신규 생성됨.
- `backend/alembic/versions/0003_asset_valuations_and_goals.py` — 최신 마이그레이션 head(0003) → 신규 마이그레이션은 0004.
- `frontend/src/lib/api.ts:3-7` — fetch 래퍼가 `Content-Type: application/json`을 항상 강제 → multipart 업로드용 별도 메서드(`api.upload` 등) 필요(FormData는 브라우저가 boundary 포함 헤더를 자동 설정해야 함).
- `frontend/src/stores/transactions.ts` — 거래 목록 fetch/필터 스토어. 업로드 성공 후 재조회 트리거 지점.
- `frontend/src/pages/TransactionsPage.tsx` — 거래 페이지(테이블/캘린더 뷰, 필터, 추가 다이얼로그). 업로드 버튼·다이얼로그를 둘 자연스러운 위치. 단, 현재 미커밋 변경(캘린더 필터 안내 문구) 있음 — 충돌 주의.
- `frontend/src/types.ts` — Transaction/Category/Account 타입 정의. ImportResult 타입 추가 지점.

## 영향도

- **DB 스키마**: `transactions`에 `source` 컬럼 추가(마이그레이션 0004). 기존 행은 'manual' 기본값으로 backfill — 기존 조회/생성 코드에는 영향 없음(스키마 Out에 노출하지 않으면 API 계약 불변).
- **잔액·대시보드 집계**: Account 잔액은 opening_balance + 거래 합산(`backend/app/models.py:22` 주석), 대시보드는 월별 income/expense 합계(`backend/app/routers/analytics.py`). 가져온 거래가 즉시 반영되므로 별도 수정 불필요. 단, 이체를 스킵하므로 계좌별 잔액은 실제 은행 잔액과 다를 수 있음(앱의 기존 모델 한계이며 이번 변경으로 악화되지 않음).
- **기준정보 자동 생성**: 카테고리·계정이 업로드로 늘어나면 SettingsPage 목록과 거래 폼 셀렉트에 그대로 노출됨(`frontend/src/stores/masterData.ts`) — 의도된 동작.
- **거래 폼/필터**: TransactionCreate 스키마에 source를 추가하지 않으면(서버에서만 부여) 프론트 거래 폼은 무변경.
- `frontend/src/pages/TransactionsPage.tsx`의 미커밋 변경(캘린더 필터 안내)과 같은 파일을 수정하게 됨 — 구현 시 기존 변경 보존 필요.

## 설계 (고수준)

### 1. API 계약
- `POST /api/v1/transactions/import` — multipart/form-data: `file`(xlsx), `month`(YYYY-MM, `YEAR_MONTH_PATTERN` 검증).
- 동작(단일 DB 트랜잭션, 실패 시 전체 롤백):
  1. xlsx에서 "가계부 내역" 시트를 읽음. 시트 부재·헤더 불일치(필수 컬럼: 날짜·타입·대분류·금액·결제수단) 시 422 + 한국어 메시지.
  2. 날짜가 지정 월에 속하는 행만 추출. 0건이면 422("해당 월 데이터가 없습니다") — 실수로 빈 월을 골라 기존 데이터만 날리는 사고 방지.
  3. 해당 월의 `source='import'` 거래를 일괄 삭제.
  4. 행별 변환·검증 후 일괄 삽입. 변환 불가 행은 중단이 아니라 **스킵 + 사유 수집** (단, 스킵된 행 때문에 전체가 실패하지는 않음).
- 응답(ImportResult): 월, 삭제 건수, 생성 건수, 스킵 목록(행 번호 + 사유), 신규 생성된 카테고리/계정 이름 목록. (필드명·구조는 구현 재량)

### 2. 행 → 거래 변환 규칙
- **날짜**: 엑셀 시리얼 → date (1899-12-30 기준). 시간 컬럼은 버림.
- **타입 → kind**: 지출→expense, 수입→income. **이체→스킵**(사유: "이체는 지원하지 않음"). 금액 부호가 타입과 모순(지출+양수=환불, 수입+음수)이거나 0원인 행도 스킵 + 사유 보고.
- **금액**: 절대값 정수로 저장(모델 불변식: 항상 양수, 방향은 kind — `backend/app/models.py:50`).
- **대분류 → Category**: `(name=대분류, kind=행의 kind)`로 조회, 없으면 `nature='variable'`로 자동 생성. 같은 업로드 내 중복 생성 방지(메모리 캐시).
- **소분류**: 별도 기준정보를 만들지 않음. '미분류'가 아닌 경우 memo에 보존(보존 포맷은 구현 재량).
- **내용 → memo**: 내용(F)을 memo에 저장(255자 절단). 엑셀 메모(J)는 전부 빈 값이므로 값이 있으면 함께 보존(포맷 재량).
- **결제수단 → Account**: name으로 조회, 없으면 자동 생성. type은 이름 기반 휴리스틱(예: '카드'/'Check' 포함→card, '통장' 포함→bank, 그 외→other — 세부 규칙은 구현 재량), opening_balance=0, is_active=True.
- **화폐**: KRW가 아니면 스킵 + 사유 보고.
- **member_id**: null (누구의 거래인지 파일에 없음).
- **source**: 'import' 고정.
- 완전 중복 행도 dedup 없이 모두 삽입(실데이터에 정당한 중복 11건 존재).

### 3. 프론트엔드
- TransactionsPage에 "엑셀 업로드" 버튼 + 다이얼로그: 파일 선택, 월 선택(기본값: 전월 — 재량), "해당 월의 기존 업로드 내역은 삭제 후 다시 등록됩니다" 경고 문구, 업로드 후 결과 요약(생성/삭제/스킵 건수, 스킵 사유) 표시.
- `api.ts`에 multipart 전송 메서드 추가(Content-Type 수동 지정 금지).
- 업로드 성공 시 거래 스토어 재조회 + masterData 스토어 재조회(신규 카테고리/계정 반영).

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: `POST /api/v1/transactions/import`에 첨부 파일과 `month=2026-05`를 전송하면 해당 월의 유효 행(지출·수입, 부호 정상, KRW)만 거래로 등록된다 — 업로드 후 `GET /api/v1/transactions?month=2026-05` 건수가 엑셀의 2026-05 유효 행 수와 일치함을 확인.
- [ ] AC-2: 같은 월을 두 번 업로드해도 거래가 중복 누적되지 않는다 — 동일 파일·동일 월 2회 업로드 후 `GET ?month=` 건수가 1회 때와 동일함을 확인.
- [ ] AC-3: 수동 입력 거래는 재업로드 시 보존된다 — 해당 월에 수동으로 거래 1건 추가 → 재업로드 → 수동 거래가 목록에 남아 있음을 확인.
- [ ] AC-4: 파일에만 있는 대분류·결제수단은 기준정보로 자동 생성되어 거래에 연결된다 — 업로드 후 `GET /api/v1/categories`, `GET /api/v1/accounts`에 신규 항목이 있고, 거래 응답의 category_name/account_name이 엑셀 값과 일치함을 확인.
- [ ] AC-5: 이체·0원·부호 모순 행은 등록되지 않고, 응답 요약에 스킵 건수와 사유가 포함된다 — 이체가 포함된 월 업로드 후 응답 본문으로 확인(예: 2026-05는 이체 포함 92행이므로 생성+스킵=92).
- [ ] AC-6: 응답에 삭제/생성/스킵 건수 요약이 반환된다 — Swagger(`/docs`) 또는 curl 응답 본문으로 확인.
- [ ] AC-7: "가계부 내역" 시트가 없거나 필수 컬럼이 없는 파일, 지정 월 데이터가 0건인 경우 422와 한국어 에러 메시지를 반환하고 기존 거래는 변하지 않는다 — 임의 xlsx 업로드 후 응답 코드·메시지와 `GET ?month=` 건수 불변 확인.
- [ ] AC-8: 거래 페이지에서 파일·월을 선택해 업로드할 수 있고, 완료 후 결과 요약이 표시되며 거래 목록·카테고리/계정 목록이 자동 갱신된다 — `docker compose up` 후 브라우저에서 실제 파일로 확인.
- [ ] AC-9: 마이그레이션 후 기존 거래 CRUD가 회귀 없이 동작한다 — `alembic upgrade head` 성공 + 기존 거래 생성/수정/삭제를 Swagger로 확인.

## Action Items

- [ ] `backend/requirements.txt`에 openpyxl 추가.
- [ ] 마이그레이션 0004: `transactions.source` 컬럼(String, 기본 'manual', 인덱스 여부 재량) 추가. 모델(`models.py`) 반영.
- [ ] `schemas.py`에 ImportResult(요약 응답) 스키마 추가.
- [ ] 엑셀 파서 + 행 변환 로직 구현(별도 모듈 권장: 시트 검증, 시리얼 날짜 변환, 타입/부호 판정, 스킵 사유 수집).
- [ ] `routers/transactions.py`(또는 신규 라우터)에 import 엔드포인트 추가: month 검증 → 파싱 → 기존 import 거래 삭제 → 카테고리/계정 get-or-create → 일괄 삽입 → 요약 반환. 전 과정 단일 트랜잭션.
- [ ] `frontend/src/lib/api.ts`에 multipart 업로드 메서드 추가.
- [ ] `frontend/src/types.ts`에 ImportResult 타입 추가.
- [ ] TransactionsPage에 업로드 버튼·다이얼로그·결과 요약 UI 추가, 성공 시 transactions/masterData 스토어 재조회. (기존 미커밋 변경 보존 주의)
- [ ] 검증: `docker compose up --build` 후 실제 파일로 AC 전체 확인, `npm run build`/`npm run lint` 통과.

## 미해결 질문

- **이체(157건) 처리**: 이번 설계는 스킵+보고. 계좌 간 이동까지 추적하려면 Transfer 모델 신설이 필요한데 이는 별도 과제 규모. 스킵으로 충분한지 사용자 확인 필요.
- **환불 행(지출+양수, 48건)**: 스킵+보고로 설계. 수입('환불' 카테고리)으로 반영하길 원하면 변환 규칙 1줄 추가로 가능 — 사용자 선택.
- **기존 시드 카테고리로의 의미 매핑**: 엑셀 대분류를 그대로 카테고리명으로 쓰는 자동 생성 방식이라, 시드의 '생활용품'과 엑셀의 '생활', '주거/관리비'·'통신비'와 '주거/통신'이 별개 카테고리로 공존하게 됨. 이름 매핑 테이블(예: '주거/통신'→'주거/관리비')을 원하는지, 아니면 SettingsPage에서 직접 정리할지 사용자 결정 필요.
- **삭제 범위**: "기존 업로드 내역 삭제"를 import 출처 거래로 한정함(수동 입력 보호). 해당 월 거래 전체 삭제를 원한다면 source 구분 없이 지우도록 변경 가능 — 기본은 안전한 쪽으로 설계.
- **월 선택 기본값**(전월 vs 파일 내 최신 월)과 memo 보존 포맷(소분류 표기 방식), 계정 type 휴리스틱 세부 규칙은 구현 재량.
