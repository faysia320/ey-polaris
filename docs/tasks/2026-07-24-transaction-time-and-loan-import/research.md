# Research: 거래 시간(time) 추가 및 대출현황 엑셀 업로드

- 날짜: 2026-07-24
- 요청 원문:
  1. 지출/수입 내역에 시간 추가. excel 업로드 시 시간도 같이 업로드 되어야 함
  2. 대출 계정이 추가 되었어. 엑셀 업로드 시 "뱅샐현황" 시트에 대출현황도 가져다 업로드/갱신 되도록 수정

## 요약

두 요청 모두 기존 엑셀 업로드 파이프라인의 자연스러운 확장이다.

**(1) 시간**: 뱅크샐러드 엑셀 "가계부 내역" 시트는 이미 `날짜`(2열은 아님) 옆에 `시간` 컬럼(`datetime.time`)을 별도로 내보낸다(참조 파일 헤더: `날짜, 시간, 타입, …`). 현재 `Transaction`은 `date`(Date)만 저장하고 시간을 버린다(`models.py:119`, `excel_import.py:129`). `transactions`에 nullable `time` 컬럼을 추가하고, 파서가 `시간` 셀을 읽어 적재하며, 목록·수동 폼에 시간을 노출한다. `date`는 Date로 유지해 월 필터·정렬 로직(`transactions.py:15-19,83,118`)을 건드리지 않는다.

**(2) 대출**: "뱅샐현황" "3.재무현황" 표는 자산 표(열 B/C/E)와 **부채 표**(열 F/G/I = 항목/상품명/금액)가 나란히 있다(참조 파일 행 38 헤더, 행 39 `장기대출 | 아낌e보금자리론 | 243277183`). 기존 `parse_valuations`는 자산 측(첫 번째 항목/상품명/금액 트리오)만 읽어 부동산→`real_estate` 평가액으로 반영한다(`excel_import.py:253-318`). 이를 대칭 확장해 **부채 측**을 읽어, 상품명과 같은 이름의 `loan` 계정에 **오늘 날짜 `AssetValuation`을 음수값(-대출금액)으로 upsert**한다(사용자 확인). 음수 평가액은 잔액을 최신 평가액 단독으로 계산하는 기존 규칙(`analytics.py:217-221`)을 통해 총자산에서 자동 차감되고, 월별 추이에도 상환 이력이 반영된다(`analytics.py:287-300`).

## 관련 파일 및 근거

### 시간
- `backend/app/models.py:109-144` — `Transaction` 모델. `date: Mapped[date_type]`(Date)만 있고 시간 컬럼 없음. `time` 컬럼 추가 대상.
- `backend/app/excel_import.py:20` — `REQUIRED_COLUMNS`에 `시간` 없음. `:33-42` `ParsedRow`에 시간 필드 없음. `:77-84` `_to_date`. `:124-201` 파싱 루프에서 `시간` 셀 미사용 — 여기서 시간을 읽어 `ParsedRow`에 싣는다.
- `backend/app/schemas.py:96-127` — `TransactionCreate`/`TransactionUpdate`/`TransactionOut`. `time` 필드 추가 대상.
- `backend/app/routers/transactions.py:22-39` — `_to_out`(응답 매핑, time 추가), `:484-498`·`:519-531` import 시 `Transaction(...)` 생성부(time 전달), `:175-182` `create_transaction`(`payload.model_dump()` 그대로 → time 자동 포함).
- `frontend/src/types.ts:50-81` — `Transaction`/`TransactionInput`에 time 추가 대상.
- `frontend/src/pages/TransactionsPage.tsx:300-311`(테이블 날짜 컬럼, 커스텀 cell 없음 → 시간 표시 추가), `:849-851`(모바일 리스트 뷰 `{t.date}` 표시), `:87,219,247`(폼 상태·초기값·payload), `:1050-1055`(날짜 DatePicker — 시간 입력 필드 추가 위치).
- `frontend/src/components/ui/date-picker.tsx`(추정) 및 `todayISO`(`TransactionsPage.tsx:87`) — 폼 기본값. 시간 입력 컴포넌트 방식은 구현 재량.

### 대출
- `backend/app/excel_import.py:246-318` — `VALUATION_SHEET="뱅샐현황"`, `parse_valuations`. 자산 표 헤더(`항목/상품명/금액`)를 첫 번째로 탐지(`:280-289`)하므로 부채 측은 무시된다(`:276` 주석 "부채 측 동명 컬럼은 무시"). 부채 파서를 대칭 추가할 위치.
- `backend/app/routers/transactions.py:318-348` — `_effective_valuations`(미리보기·적재 공유 정책: dedupe, 0원 신규 미생성, 동명 비대상 계정 제외). 대출도 같은 패턴으로 처리.
- `backend/app/routers/transactions.py:589-621` — `POST /import` 평가 적재 단계. 대출 upsert 단계를 같은 트랜잭션 내에 추가.
- `backend/app/routers/transactions.py:370-396` — `preview_import`의 `valuations` 반환. 대출 목록 반환 추가.
- `backend/app/models.py:147-164` — `AssetValuation`. `value: BigInteger`(DB 제약 없음 → 음수 저장 가능). `(account_id, date)` 유니크로 upsert.
- `backend/app/routers/analytics.py:190-221` — 평가액 있는 계정 잔액 = 최신 평가액 단독. `:287-300` 월별 추이도 평가액 우선. 음수값이면 그대로 차감/추이 반영됨(코드 변경 불필요).
- `backend/app/schemas.py:305-350` — `ImportValuationRow`(`account_type: Literal["real_estate"]`, `value: ge=0`), `ImportPreview.valuations`, `ImportResult.valuation_count`. 대출 노출용 확장 대상.
- `frontend/src/types.ts:194-231` — `ImportValuationRow`/`ImportPreview`/`ImportResult` 타입. `frontend/src/pages/TransactionsPage.tsx:349-390` 업로드 다이얼로그의 평가 미리보기/결과 섹션(대출 항목 표시 추가).
- `docs/tasks/2026-07-23-account-types-efinance-loan-deposit/` — `loan` 유형은 최근 추가됨. 현재는 음수 개설잔액으로만 차감(라우터/집계 변경 없음).

### 참조 파일 실측 (`2025-06-11~2026-06-11.xlsx`, 읽기 전용 확인)
- "가계부 내역" 헤더: `('날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '화폐', '결제수단', '메모')`. 예: `날짜=2026-06-10, 시간=19:11:27`.
- "뱅샐현황" 행 38 헤더: 자산 `B=항목, C=상품명, E=금액` / 부채 `F=항목, G=상품명, I=금액`.
- 부채 데이터: 행 39 `장기대출 | 아낌e보금자리론 | 243277183`, 행 40 `(병합 빈 항목) | 카카오뱅크 마이너스 통장 | 0`, 행 63 `총부채`(F열, 집계 — 종료). 항목 셀은 자산 표와 동일하게 병합되어 carry-forward 필요.

## 영향도

- **`models.py`**: `Transaction.time` 컬럼 추가(nullable). 신규 마이그레이션 필요.
- **Alembic**: 신규 리비전 `0011`(down_revision `0010`) — `transactions.time` 컬럼(sa.Time, nullable) 추가. 수동 작성(기존 0001~0010 방식).
- **`excel_import.py`**: `ParsedRow`에 time 필드 추가(파싱 루프 확장), 부채 파서 신규 추가. `parse_valuations`(자산)는 미변경 — 부작용 낮음.
- **`transactions.py`**: `_to_out`·import 생성부에 time 전달, `_effective_valuations`/import/preview에 대출 처리 추가. 전 과정 단일 트랜잭션 유지(실패 시 롤백 보장 불변).
- **`schemas.py`/`types.ts`**: time 필드, 대출 미리보기/결과 필드 추가(하위호환 — 기존 필드 유지, 신규는 optional/default).
- **`analytics.py`**: 변경 없음 — 음수 평가액이 기존 잔액/추이 공식으로 자동 반영됨(잔액=최신 평가액, 추이=평가액 우선).
- **`AssetsPage.tsx`**: 코드 변경 없이 업로드 후 재조회로 대출 계정 잔액(음수)·평가 기준일이 반영됨. `VALUATION_TYPES`에 loan은 없으므로 대출은 수동 "평가액 갱신" 버튼 없이 엑셀로만 갱신(의도된 동작).
- **기존 데이터**: time NULL 허용 → 과거 거래·수동 거래는 시간 없이 정상 표시. 대출 계정에 음수 평가액이 생기면 그 계정 잔액은 거래 기반→평가 기반으로 전환(평가 있는 계정 규칙). 대출 계정은 통상 거래가 없어 부작용 낮음.

## 성공 기준 (Acceptance Criteria)

### 시간
- [ ] AC-1: `transactions`에 nullable `time` 컬럼이 추가되고 `alembic upgrade head`가 오류 없이 적용된다 — 마이그레이션 실행 후 `\d transactions`(또는 스키마 조회)에 `time` 컬럼 존재로 확인.
- [ ] AC-2: 참조 파일 `POST /transactions/import` 확정 시, 적재된 각 수입/지출 거래의 `time`이 엑셀 `시간` 컬럼 값과 일치한다 — 확정 후 `GET /transactions?month=...` 응답에서 특정 행의 시간이 엑셀 값(예: `19:11:27`)과 같음으로 확인. 엑셀에 시간이 없는 행은 time=null.
- [ ] AC-3: 거래 목록(테이블·모바일 리스트)에 날짜와 함께 시간이 표시된다(시간 없는 거래는 시간 부분 생략) — 화면에서 import된 거래에 시간이 보이고, 수동 입력한 과거 거래는 시간 없이 날짜만 보임으로 확인.
- [ ] AC-4: 거래 추가/수정 폼에서 시간을 입력·수정할 수 있고, 시간을 비워도 저장된다(time=null) — 폼에서 시간 지정 저장 후 목록에 반영되고, 시간 미입력 저장도 성공함으로 확인.

### 대출
- [ ] AC-5: 부채 파서가 참조 파일 "뱅샐현황" 부채 표에서 `아낌e보금자리론`(243277183)을 loan 대상으로 추출한다(`장기대출` 항목 병합 carry-forward, `총부채`/다음 섹션에서 종료, 0원 항목 정책 적용) — 파서 함수에 파일 바이트를 넣어 반환 목록으로 확인.
- [ ] AC-6: 참조 파일 확정 시, 상품명과 같은 이름의 `loan` 계정에 **오늘 날짜 `AssetValuation`이 음수값(-대출금액)** 으로 기록된다 — 확정 후 `GET /accounts/{id}/valuations`에 오늘 날짜·음수 금액 존재로 확인. 재업로드 시 중복 없이 갱신(upsert)됨.
- [ ] AC-7: 상품명과 일치하는 계정이 없으면 `loan` 유형 계정을 자동 생성하고 음수 평가액을 기록한다. 동명 계정이 loan이 아니면 매칭하지 않는다(자산 평가와 동일 정책) — 빈/부분 DB에서 업로드 후 `GET /accounts`에 loan 계정 생성 확인, `GET /analytics/assets`의 해당 잔액이 음수 평가액과 같고 총자산에서 차감됨으로 확인.
- [ ] AC-8: 대출 반영이 실패해도 거래 가져오기 전체를 막지 않으며, "뱅샐현황"/부채 표가 없는 파일도 정상 성공한다(대출 0건 처리) — 부채 표 없는 파일 업로드가 2xx로 성공하고 대출 0건임으로 확인.
- [ ] AC-9: 업로드 미리보기(`POST /import/preview`)와 확정 결과(`POST /import`)에 반영될/반영된 대출 항목(상품명·금액)과 건수가 표시된다 — 미리보기에 대출 항목이 나오고 결과 요약에 대출 반영 건수가 포함됨으로 확인.

### 공통
- [ ] AC-10 (모바일): 거래 목록의 시간 표시, 폼의 시간 입력, 업로드 다이얼로그의 대출 미리보기/결과 섹션을 추가한 뒤에도 **375px 뷰포트에서 가로 스크롤·요소 겹침·잘림이 없다** — **/qa 단계에서** 브라우저 도구로 375px 확인.
- [ ] AC-11: `cd frontend && npm run build`(tsc+vite)가 통과하고 백엔드 모듈이 오류 없이 로드된다 — 빌드 성공·백엔드 import 확인.

## Action Items

- [ ] `models.py`: `Transaction`에 `time: Mapped[time | None]`(sa.Time, nullable) 추가.
- [ ] Alembic `0011` 리비전 수동 작성: `transactions.time` 컬럼 추가/제거(down_revision `0010`).
- [ ] `excel_import.py`:
  - `REQUIRED_COLUMNS`는 유지하되 `시간`은 선택 컬럼으로 취급(없어도 파싱 성공, time=null). `_to_time` 헬퍼 추가, `ParsedRow`에 time 필드 추가, 파싱 루프에서 `시간` 셀 적재. 이체 검토 행(ReviewRow)의 시간 반영 여부는 구현 재량(1차 범위는 확정되는 income/expense/transfer 거래에 time 반영).
  - 부채 파서 추가: "뱅샐현황"에서 **두 번째** `항목/상품명/금액` 트리오(부채 측)를 탐지해 항목 carry-forward, `총부채`/다음 섹션 헤더에서 종료. 상품명·금액(양수) 행을 loan 대상으로 반환(값은 반영 단계에서 음수화).
- [ ] `transactions.py`:
  - `_to_out`과 import 거래 생성부(수입/지출·이체 검토)에 time 전달.
  - `_effective_valuations`에 대칭되는 대출 반영 정책(상품명 dedupe, 0원 신규 미생성, 동명 비-loan 계정 제외) 추가. `POST /import`에 대출 음수 평가액 upsert 단계 추가(같은 트랜잭션, `ensure_account` 유형 loan). `preview`에 대출 목록 반환.
- [ ] `schemas.py`: `TransactionCreate/Out`에 `time` optional 추가. `ImportPreview`/`ImportResult`에 대출 미리보기/건수 필드 추가(대출 value 음수 허용 — 자산과 별도 목록으로 둘지, `account_type`에 loan 추가하고 ge 제약 완화할지는 구현 재량).
- [ ] `frontend`: `types.ts`에 time·대출 필드 추가. `TransactionsPage.tsx` 목록에 시간 표시, 폼에 시간 입력(미입력 허용), 업로드 다이얼로그에 대출 미리보기/결과 섹션 추가.

## 결정 사항 및 출처

- [사용자 확인] 거래 시간 범위 → **표시 + 수동 입력/수정** : 목록에 시간 표시(AC-3), 추가/수정 폼에 시간 입력 필드(미입력 허용, AC-4), 엑셀 업로드 시 시간 적재(AC-2).
- [사용자 확인] 대출 잔액 반영 방식 → **AssetValuation 음수값(오늘 날짜 upsert, 추이 반영)** : 부동산·주식 import와 대칭. 잔액/추이 공식 재사용, analytics 변경 없음(AC-6·AC-7).
- [기술 결정] `date`는 Date 유지하고 `time`을 **별도 nullable 컬럼**으로 추가(DateTime 전환 안 함) : 월 필터·정렬(`transactions.py:15-19,83,118`) 불변, 하위호환. → AC-1.
- [기술 결정] 대출 계정 **자동 생성 및 동명 비-loan 계정 제외** : 기존 자산 평가 정책(`_effective_valuations`, `transactions.py:339-348`)과 동일하게 적용. → AC-7.
- [기술 결정] `시간` 컬럼은 **선택 컬럼** — 없는 파일도 파싱 실패시키지 않음(`REQUIRED_COLUMNS` 미포함). 시간 없는 행/파일은 time=null. → AC-2·AC-8 정합.
- [기술 결정] 대출 미리보기/결과의 자료구조(자산 목록에 합칠지 별도 필드로 둘지, value 부호를 미리보기에서 음수로 노출할지) : 구현 재량(외부 계약은 "대출 항목·건수가 미리보기/결과에 보인다"까지만 고정, AC-9).

## 미해결 질문

- 없음
