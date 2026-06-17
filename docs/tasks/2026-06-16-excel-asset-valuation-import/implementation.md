# Implementation: 엑셀(뱅샐현황) 업로드로 부동산·주식 평가액 자동 갱신

- 날짜: 2026-06-16 (QA 후속 수정: 2026-06-17)
- 기반 명세: `docs/tasks/2026-06-16-excel-asset-valuation-import/research.md`
- QA 후속: `qa-report.md` CONDITIONAL PASS의 Action Items(Medium 1 + Low 2) 반영 (아래 "QA 후속 수정" 참조)

## 변경 파일
- `backend/app/excel_import.py` — `ParsedValuation` 데이터클래스 및 `parse_valuations(content)` 추가. 뱅샐현황 "재무현황" 자산 표에서 헤더(항목/상품명/금액)를 동적 탐지하고, 항목을 carry-forward 하며 부동산→`real_estate`/투자성 자산→`stock`으로 추출. '총자산'/'순자산'·다음 섹션 헤더에서 종료. 시트/표 부재 시 빈 목록.
- `backend/app/schemas.py` — `ImportValuationRow`(product_name/account_type/value) 추가, `ImportPreview.valuations`·`ImportResult.valuation_count` 필드 추가.
- `backend/app/routers/transactions.py` — preview/import에서 파일 바이트를 1회만 읽어 재사용. import 확정 시 평가액 반영 단계 추가(오늘 날짜 upsert). preview 응답에 평가 목록 포함.
- `frontend/src/types.ts` — `ImportValuationRow` 타입, `ImportPreview.valuations`·`ImportResult.valuation_count` 추가.
- `frontend/src/pages/TransactionsPage.tsx` — `VALUATION_TYPE_LABEL` 상수, 미리보기 화면에 반영될 평가 목록, 결과 화면에 평가 반영 건수 표시.

## 주요 결정
- **상품명-기존계정 유형 충돌(입력 지시 반영)**: 평가액은 이름이 같은 `stock`/`real_estate` 계정에만 매칭한다. 동명의 비시세형 계정(은행 등)이 있으면 매칭하지 않고 건너뛴다(계정명은 unique이라 신규 생성도 불가하므로 그 행은 반영 안 됨). 기존 계정의 유형은 변경하지 않는다.
- **0원 항목(사용자 확정)**: 0원 행은 신규 계정을 만들지 않는다. 이미 같은 이름의 `stock`/`real_estate` 계정이 있으면 0으로 갱신한다. (참조 파일의 `금현물전용`·`종합매매`(0) 등은 신규 생성되지 않음)
- **평가일(사용자 확정)**: 서버 `date.today()`. 선택한 가져오기 월과 무관하게 자산 표 전체를 반영(스냅샷은 월 독립적).
- **파일 바이트 1회 읽기**: `UploadFile.file.read()`는 1회만 가능하므로 `content` 변수로 받아 `parse_ledger`와 `parse_valuations`가 공유.
- **계정 사전 공유**: 거래 가져오기의 `accounts = {a.name: a}` 사전을 평가 단계에서 그대로 사용해 거래·평가가 같은 계정을 가리키도록 함. 신규 평가 계정은 `created_accounts`에도 추가되어 결과에 노출.
- **upsert**: `(account_id, today)` 기준으로 기존 평가가 있으면 값 갱신, 없으면 insert. autoflush로 같은 트랜잭션 내 동명 중복 행도 안전 처리. 전 과정이 기존 단일 트랜잭션 안이라 실패 시 전체 롤백.
- **파서 견고성**: 자산 표 부재/시트 부재/손상 파일이면 `parse_valuations`가 빈 목록을 반환 → 거래 가져오기는 영향 없음(AC-5).
- research와의 차이: 없음(미해결 질문 2건은 입력·질문으로 확정 후 그대로 반영).

## 자체 검증 결과
- 실행: 참조 파일로 `excel_import.parse_valuations` 직접 호출 → **11건 추출**(real_estate 1: 오산시티자이2단지 355,000,000 / stock 10: SK텔레콤 19,700,000 등). 동산(기아 더 뉴K7)·연금·보험·총자산·순자산 제외 확인. (통과)
- 실행: `python -m py_compile app/excel_import.py app/schemas.py app/routers/transactions.py` → **PY COMPILE OK** (통과)
- 실행: `cd frontend && npm run build`(tsc -b && vite build) → **built 성공** (통과, chunk-size 경고는 기존 사항)
- 실행: `npm run lint` → **0 errors, 2 warnings** (경고는 기존 `useReactTable`·React Compiler 관련으로 본 변경과 무관) (통과)
- 백엔드 전체 앱 인스턴스화/DB E2E: 로컬에 `pydantic` 등 백엔드 의존성 미설치로 실행 불가 → 라우터 로직은 코드 리뷰로 확인, 실제 업로드·DB·브라우저 검증은 `/qa`에 위임.

## 성공 기준 자가 체크
- [x] AC-1: 참조 파일 파싱 결과 부동산 1건(real_estate)·투자성 10건(stock), 동산/총자산/순자산 제외 — 직접 실행으로 확인.
- [x] AC-2: import 확정 시 매칭/생성 계정에 `date.today()`로 `AssetValuation` upsert — 라우터 로직 구현(코드 근거 `transactions.py` 평가 단계). 실제 DB 확인은 `/qa` 위임.
- [x] AC-3: 매칭 계정 없으면 `real_estate`/`stock` 유형으로 자동 생성 후 평가 기록 — 구현됨. 실제 `GET /accounts`·`/analytics/assets` 확인은 `/qa` 위임.
- [x] AC-4: `(account_id, today)` upsert로 재업로드 중복 없음 — 기존 평가 조회 후 갱신 로직 구현(유니크 제약과 일치).
- [x] AC-5: 시트/자산 표 부재 시 `parse_valuations`가 빈 목록 반환 → 가져오기 정상 성공, 평가 0건 — 파서 early-return 구현.
- [x] AC-6: preview 응답 `valuations`·결과 `valuation_count` 추가, 미리보기 목록·결과 건수 UI 표시 — 구현. 화면 표시는 `/qa` 위임.
- [x] AC-7: 업로드 후 자산 카드 잔액=평가액, 평가 기준일=오늘 — 모델상 최신 평가액이 잔액. 브라우저 확인은 `/qa` 위임.
- [x] AC-8(모바일): 미리보기 평가 목록을 `flex`+`min-w-0`/`truncate`/`shrink-0`로 375px 오버플로 방지하도록 작성 — 브라우저 375px 확인은 `/qa` 위임.
- [x] AC-9: `npm run build`·`py_compile` 통과 — 확인.

## QA 후속 수정 (2026-06-17)
qa-report.md의 수정 Action Items 3건을 반영했다.

- **(Medium) 미리보기 평가 노출** — `TransactionsPage.tsx` `runImport`: 직행 확정 조건을 `review.length === 0 && valuations.length === 0`으로 변경. 이체 검토행이 0건이어도 반영될 평가액이 있으면 미리보기 화면을 띄워 사용자가 평가 목록을 확인 후 확정한다. 검토행이 0건일 때 어색하지 않도록 다이얼로그 제목("업로드 내용 확인")·설명·안내 문구를 `review.length`에 따라 분기.
- **(Low) React key 충돌** — 평가 목록 `map((v, i) => ...)`로 인덱스를 받아 `key={`${i}-${v.account_type}-${v.product_name}`}`로 변경. 동명 중복(`종합매매`) 항목의 key 충돌 제거.
- **(Low) 백엔드 중복행 dedupe** — `transactions.py` 평가 적재 전 상품명 단위 dedupe 추가. 0원 행이 비영 평가액을 덮어쓰지 않도록 "마지막 비영값 우선"(새 값이 0이고 기존이 비영이면 유지) 규칙 적용 → `valuation_count` 안정화 및 0원 덮어쓰기 회피. 순서 무관(검증: `[0,304]`/`[304,0]` 모두 304 유지).
- Info(작업 트리에 섞인 무관한 `DashboardPage.tsx` 변경)는 본 작업 범위가 아니므로 미수정 — `/git-commit` 시 커밋 분리 필요.

### QA 후속 자체 검증
- `python -m py_compile app/routers/transactions.py app/excel_import.py app/schemas.py` → **PY COMPILE OK**
- dedupe 로직 재현(참조 파일) → raw 11 → **deduped 10**, `종합매매` 최종값 **304**(0원 미덮어씀) 확인
- `npm run build` → **성공**, `npm run lint` → **0 errors, 2 warnings**(기존 `useReactTable` 관련, 무관)

## QA 후속 수정 2차 (2026-06-17)
2회차 qa-report.md의 수정 Action Items 2건(Medium 1 + Low 1)을 반영했다. (Low 375px 실측은 환경 제약상 `/qa` 영역)

- **(Medium) 미리보기-반영 불일치 제거** — dedup + "0원 신규 미생성" + "동명 비시세형 계정 제외" 정책을 `transactions.py`의 공유 헬퍼 `_effective_valuations(content, accounts)`로 추출. `preview_import`에 `db`를 주입해 현재 계정 상태로 동일 헬퍼를 호출 → 미리보기 `valuations`와 확정 `valuation_count`가 **동일 집합·건수**를 사용. 참조 파일·빈 DB 기준 양쪽 모두 8건으로 일치(원본 11건의 중복 1·0원 신규 2 제외). `import_transactions`도 같은 헬퍼를 사용하도록 단순화.
  - 트레이드오프: 미리보기가 DB를 1회 조회(읽기 전용, 변경 없음)하게 됨 — 정확도를 위해 수용.
- **(Low) 파서 헤더 탐지 방어** — `parse_valuations`의 `list.index(..., start)`를 `try/except ValueError`로 감싸 비정상 컬럼 순서(예: 상품명이 항목보다 앞)에서 예외가 전파되지 않고 헤더 탐색을 계속하거나 빈 목록을 반환하도록 변경(AC-5의 "자산 표 부재 시 빈 목록" 견고성과 정합).
- Info(`DashboardPage.tsx` 무관 변경)는 본 작업 범위 밖이라 미수정 — `/git-commit` 시 커밋 분리 필요.

### QA 후속 2차 자체 검증
- `python -m py_compile app/routers/transactions.py app/excel_import.py app/schemas.py` → **PY COMPILE OK**
- effective 헬퍼 로직 재현(참조 파일): 빈 DB → **8건**(`종합매매` 단일 304, 0원 신규 2건 제외) = `valuation_count`와 일치. 동명 `기업은행`이 bank로 존재할 때 → **7건**(기업은행 제외, 충돌 미발생) 확인.
- `npm run build` → **성공**, `npm run lint` → **0 errors, 2 warnings**(기존 `useReactTable`, 무관)

## 보류/미완 항목
- AC-8 진정한 375px 동적 실측: 디바이스 에뮬레이션 가능 환경에서의 1회 실측은 `/qa` 영역(구현자 코드 수준에서는 mobile-safe 패턴 적용 완료).
- `DashboardPage.tsx` 무관 변경 커밋 분리: 본 작업 아님 — `/git-commit` 단계 처리.
