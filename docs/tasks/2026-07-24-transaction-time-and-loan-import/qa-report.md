# QA Report: 거래 시간(time) 추가 및 대출현황 엑셀 업로드

- 날짜: 2026-07-24
- 작업 폴더: `docs/tasks/2026-07-24-transaction-time-and-loan-import`
- 판정: **CONDITIONAL PASS**

> 근거: research.md의 AC-1~AC-11을 전부 직접 실행으로 충족 확인(High 0건). 단 작업 트리가 별개 작업
> `transaction-link-ux-redesign`의 변경을 같은 파일에 함께 담고 있는 [Medium] 범위 오염 1건이 남아 있어
> 판정 규칙상 CONDITIONAL PASS. 이전 QA의 FAIL 사유(빌드 파손)는 해소됨 — `npm run build` EXIT=0.

## 데이터 영향

**실데이터 손상 없음 — 검증 데이터는 전량 정리 완료.** 파괴적 검증(`POST /import`)은 실데이터가 없는 과거 월
`2025-07`(사전 조회로 0건 확인)에 전용 테스트 구성원(id=4, "QA_TEST_ZZZ")으로만 실행했다.

- 가져오기 검증 전 실측 사전 상태: accounts=24(max id 25), categories=84(max id 109), asset_valuations=1건
  (오산시티자이2단지 2026-07-23 360,000,000), members=2, 2025-07 거래=0건.
- 가져오기가 실계정 `오산시티자이2단지`(real_estate, 실데이터)에 오늘(2026-07-24) 평가액 355,000,000을
  **추가**했으나, 검증 후 해당 07-24 행만 정밀 삭제해 원상복구(07-23 단일 행으로 환원).
- 정리 후 재조회: accounts=24, categories=84, asset_valuations=1(07-23 360M만), members=2, member4 거래=0,
  2025-07 거래=0, `QA_%` 메모 거래=0. 자동 생성 loan 계정(아낌e보금자리론)·음수 평가액·테스트 구성원 전량 제거.
- UI 확인용 수동 거래 2건(id 389 time 有 / 390 time=null)도 생성 후 삭제, 총 184건·time 채워진 행 0건으로 환원.

## 성공 기준 채점

### 시간
- ✅ **AC-1**: 컨테이너 `alembic current` = `0011 (head)` 런타임 확인. `0011_transaction_time.py`가
  `op.add_column("transactions", sa.Column("time", sa.Time(), nullable=True))`로 정확. 가져오기가 실제로 time을
  기록/조회하므로 컬럼 존재를 종단으로 검증.
- ✅ **AC-2**: `POST /import`(2025-07) 후 `GET /transactions?month=2025-07` → 59/59 행 `time` 채워짐, 값 일치
  (예: `2025-07-31 03:06:03`). 엑셀 `시간` 컬럼이 없는 파일은 time=null로 파싱됨(파서 단독 실행으로 교차 확인).
- ✅ **AC-3**: 375px iframe 실측 — time 있는 행은 모바일 리스트에 `2026-06-30 14:25` 표시, time=null 행은
  `2026-06-30`만 표시(생략 분기). 테이블 날짜 셀도 `whitespace-nowrap`으로 날짜/시간 2단 표시(코드+렌더 확인).
- ✅ **AC-4**: 폼에 `<Input type="time" step="1">`(375px 다이얼로그에서 존재 확인). time 지정 create(id 389
  time=14:25:30) 및 time=null create(id 390 time=null) 모두 201 성공. 편집 채움 `t.time ?? ''`, payload
  `time: form.time || null`.

### 대출
- ✅ **AC-5**: `POST /import/preview`(및 파서 단독 실행) → `liabilities=[{아낌e보금자리론, 243277183}]`. 장기대출
  항목 carry-forward·총부채 종료·양수 반환 정상. 0원 `카카오뱅크 마이너스 통장`은 `_effective_liabilities`의
  0원 신규 미생성 정책으로 제외됨.
- ✅ **AC-6**: 가져오기 후 loan 계정(id 29)에 오늘(2026-07-24) `AssetValuation` **-243,277,183**(음수) 기록.
  같은 파일 재업로드 → 평가액 1행 유지(중복 없음)·값 갱신, loan 계정 1개 유지 → (account_id,date) upsert 확인.
- ✅ **AC-7**: 상품명 무매칭 → loan 유형 계정 자동 생성(id 29). `GET /analytics/assets` → 해당 잔액
  `-243,277,183`, `valued_at=2026-07-24`, grand_total(214,295,701)에 차감 반영. 동명 비-loan 계정 제외는
  `_effective_liabilities`의 `account.type != "loan"` 분기로 정적 확인(자산 경로와 대칭).
- ✅ **AC-8**: 가져오기 응답 2xx 성공. `뱅샐현황` 시트 없는 워크북 → `parse_liabilities` `[]`(백엔드 컨테이너에서
  합성 워크북으로 직접 실행). 부채 트리오 없이 자산 트리오만 있는 시트 → 대출 `[]`(자산 평가는 정상). `시간`
  컬럼 부재 파일도 파싱 성공(time=null).
- ✅ **AC-9**: preview 응답에 `liabilities` 포함, `POST /import` 응답에 `loan_count=1`. 프론트 업로드
  미리보기에 "반영될 대출 잔액 — N건" 섹션(상품명·`-금액` 붉은색), 결과에 "대출 잔액 N건 반영" 문구 존재.

### 공통
- ✅ **AC-10 (모바일 375px)**: 레시피 A(iframe) 실측 — `/transactions`·`/assets`·`/` 모두
  `pageHasHorizontalScroll=false`, `unclippedOffenders=[]`. 거래 추가 다이얼로그(시간 입력 포함)·엑셀 업로드
  다이얼로그를 375px에서 연 상태도 오버플로 0. 대출 미리보기 행은 `justify-between`+`min-w-0 truncate`+`shrink-0`
  으로 오버플로 안전(다이얼로그 베이스 실측 clean, 행 마크업 정적 확인 — 미리보기 채운 상태의 375px 렌더는 375px
  iframe에 파일 업로드를 주입할 수 없어 정적으로 갈음).
- ✅ **AC-11**: `cd frontend && npm run build`(tsc -b && vite build) → **EXIT 0**(3672 modules). 백엔드
  런타임 로드 확인 — 컨테이너 기동(15분 전 빌드), `GET /openapi.json`에 `time`/`liabilities`/`loan_count` 노출,
  `alembic current`=0011. 서빙 번들 해시(`index-CKlgAIvQ.js`)가 로컬 빌드 산출물과 **동일** → 실행 중 프론트가
  현재 작업 트리와 일치.

## 검증 시나리오

- `git diff HEAD` 분석 — time/loan 변경(models.time·schemas.time·`_effective_liabilities`·`parse_liabilities`·
  import time/대출 단계·프론트 formatTime/폼/미리보기)과 link-ux 변경(`_partner_of`·`linked_partner`·
  `partner_leg`·`TransactionLink.transactions`)이 같은 파일에 혼재함을 확인.
- `npm run build` → EXIT 0(위).
- `POST /import/preview`(2026-06/05/04, 2025-12/07) → liabilities/valuations 일관 반환.
- `POST /import`(2025-07, member 4) → created 59, loan_count 1, valuation_count 1, created_accounts=[아낌e보금자리론].
  재업로드 → deleted 59·재생성, 평가액/계정 중복 없음(upsert).
- `GET /transactions?month=2025-07` → 59/59 time 有. `GET /analytics/assets` → loan 잔액 음수·총자산 차감.
- 백엔드 컨테이너 python으로 `parse_ledger`/`parse_liabilities`/`parse_valuations` 합성 워크북 엣지 실행
  (시트 부재/단일 트리오/시간 컬럼 유무).
- 375px iframe 실측(레시피 A): 3개 페이지 + 거래추가·엑셀업로드 다이얼로그 + time 표시 분기(있음/없음).
- DB 사전/사후 수치 대조로 실데이터 무손상·테스트 데이터 전량 정리 확인.

## 발견 이슈

- **[Medium]** 작업 범위 오염 — 이 작업(time/loan)의 산출물에 별개 작업 `2026-07-24-transaction-link-ux-redesign`의
  변경이 같은 파일에 함께 얹혀 있음. 백엔드: `transactions.py`의 `_partner_of`/`list_transactions`의 `partner_leg`
  eager-load, `schemas.py`의 `TransactionLinkPartner`/`TransactionOut.linked_partner`, `models.py`의
  `TransactionLink.transactions` 관계. 프론트: `TransactionsPage.tsx` 980줄 diff의 상당 부분(묶음 보기/링크
  피커/번들 렌더)이 link-ux용이며 research.md 계약에 없음. 빌드·런타임은 정상이라 time/loan 기능은 온전하나,
  이 상태로 `/git-commit` 하면 두 작업이 한 커밋에 뒤섞여 산출물 경계가 무너진다. 재현: `git diff HEAD`에서 위
  심볼이 time/loan 변경과 같은 파일에 존재.
- **[Low]** `backend/app/models.py:170`(및 155-160 docstring) — `AssetValuation.value` 주석 "KRW 정수(원),
  0 이상"이 이번 대출 반영으로 **음수 값이 저장**되면서 실제와 불일치(주석-코드 불일치). loan 계정 평가액은
  `-대출원금`으로 기록된다.
- **[Low]** `backend/app/excel_import.py`·`routers/transactions.py` — 같은 업로드 바이트를 요청당 최대 3~4회
  파싱(`parse_ledger` + `parse_valuations` + `parse_liabilities`, 각각 워크북을 독립적으로 open; preview·import
  양쪽). 단일 파일 규모라 체감 영향은 없으나 부채 파서 추가로 open 횟수가 1회 늘었다. 함수 시그니처를 바꿔
  파싱 결과를 공유해야 하므로 QA 국소 수정 범위 밖(Action Item 아님 — 무해).

## QA 중 적용한 수정 (Low 한정)

- `backend/app/models.py:170` — `AssetValuation.value` 인라인 주석을 대출 음수 저장 사실에 맞게 정정
  (원래 [Low] "주석-코드 불일치" 항목 대응).
- 수정 후 재검증: 컨테이너에서 `python -m py_compile app/models.py` → OK(구문 무결). 주석만 변경이라 프론트
  빌드·런타임 무영향. 회귀 없음.

## 수정 Action Items (CONDITIONAL 시)

- [ ] time/loan 과 transaction-link-ux-redesign 두 작업을 별도 커밋/브랜치로 분리하거나, `/git-commit` 단계에서
      time/loan 변경만 선별 커밋해 산출물 경계를 복원한다. [Medium]

## 다음 단계

CONDITIONAL PASS — [Medium] 범위 오염은 커밋 분리 문제이므로 `/git-commit`에서 time/loan 변경만 선별해 커밋하면
해소된다. 기능적 결함은 없으므로 코드 재구현(`/implement`)은 불필요. 커밋 분리 후 진행 권장.
