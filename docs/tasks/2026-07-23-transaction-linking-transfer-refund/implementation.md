# Implementation: 거래 묶기(연결) — 계좌 간 이체·카드 환불 쌍 연결 + 통계 상쇄

- 날짜: 2026-07-23
- 기반 명세: docs/tasks/2026-07-23-transaction-linking-transfer-refund/research.md

## 변경 파일

### 백엔드
- `backend/app/models.py` — `TransactionLink` 테이블(link_type transfer|refund, created_at) 추가, `Transaction.link_id` FK(ondelete SET NULL, index) + `link` 관계 추가.
- `backend/alembic/versions/0010_transaction_links.py` — 신규 마이그레이션: transaction_links 테이블 + transactions.link_id 컬럼/FK/인덱스. downgrade는 역순 제거.
- `backend/app/schemas.py` — `LinkType` 리터럴, `TransactionOut`에 `link_id`/`link_type` 추가, 묶기 요청(`TransactionLinkCreate`)·응답(`TransactionLinkOut`) 스키마.
- `backend/app/routers/transactions.py` — `_to_out`에 link 필드 반영, list 조회에 `selectinload(link)` 추가, `POST /transactions/link`(검증 후 연결)·`DELETE /transactions/link/{id}`(해제·복원) 엔드포인트. `update` import 추가.
- `backend/app/routers/analytics.py` — `_income_expense_stats` 헬퍼 신설(이체 묶음 제외 + 환불 순지출 반영). `dashboard`·`_month_stats`가 이 헬퍼를 공유하도록 리팩터. `assets`(잔액·추이)는 의도적으로 미변경. `or_`·`aliased` import 추가.

### 프론트엔드
- `frontend/src/types.ts` — `LinkType` 타입, `Transaction`에 `link_id`/`link_type` 추가.
- `frontend/src/stores/transactions.ts` — `link`/`unlink` 액션 추가(호출 후 재조회).
- `frontend/src/pages/TransactionsPage.tsx` — 목록 행 선택(체크박스), 선택 액션 바("묶기"/선택 해제), 묶기 확인 다이얼로그(유형 제안·효과 미리보기·클라이언트 검증), 묶음 배지 표시, 묶음 해제 버튼. 테이블/모바일 카드/캘린더 상세에 모두 반영.
- `frontend/src/lib/format.ts` — `previousMonth()` 헬퍼 신설(오늘 기준 전월).
- `frontend/src/pages/DashboardPage.tsx`·`frontend/src/stores/budgets.ts` — 기본 조회 월을 `currentMonth()`→`previousMonth()`로 변경(거래 목록 기본 월과 정합). (QA 기록: 최초 implementation.md 변경 파일 목록에서 누락되어 사후 보완.)

## 주요 결정
- **잔액/자산 추이 미변경**: 원본 income/expense가 이미 각 계정에 ±반영되므로 이체·환불 묶음 모두 잔액이 자동으로 정확하다. 상쇄는 수입/지출 통계(dashboard·_month_stats)에만 적용 — research.md 근거대로.
- **묶음 데이터 표현**: 별도 `transaction_links` 테이블 + `Transaction.link_id` FK. ondelete SET NULL로 해제 시 거래는 보존되고 연결만 끊긴다(되돌리기 자명).
- **환불 순지출 반영 방식**: 환불(수입) 다리는 income에서 제외하고, 그 금액을 짝 지출 다리의 **대분류에서 차감**해 카테고리·예산 spent까지 일관되게 순지출로 만든다. 검증(환불≤지출)으로 대분류 순지출은 음수가 될 수 없어, 0 이하 대분류만 표시에서 제외.
- **유형 판정**: 서버는 명시적 link_type을 받아 그 유형 규칙만 검증(transfer=다른 계정·같은 금액, refund=환불≤지출). UI는 계정 동일 여부로 기본 제안하되 사용자가 변경 가능.
- **범위 2건 고정**: 스키마에서 transaction_ids를 정확히 2개로 제약. 수입 1 + 지출 1 조합만 허용.
- research.md와 다르게 구현한 부분: 없음.

## QA 재작업 (1회차) — Medium 2건 해소

QA 판정 CONDITIONAL PASS의 Medium 2건을 수정했다.

- **Medium 1 해소** (`analytics.py` `_income_expense_stats`): 환불 차감 쿼리의 월 앵커를 환불(수입) 다리 `in_month(income_leg)` → **지출(결제) 다리 `in_month(expense_leg)`** 로 변경. by_major가 지출 다리를 결제 월에 담으므로 차감도 결제 월·같은 대분류에 정렬되어, 카드 익월 환불(결제 7월/환불 8월)도 결제 월에서 순지출로 상쇄된다. 같은 월 환불은 종전대로 정상.
- **Medium 2 해소** (`transactions.py` `delete_transaction`): 삭제 대상이 묶인 거래면 소속 `TransactionLink`를 통째로 해제(양쪽 `link_id` NULL + 링크 행 삭제)한 뒤 삭제한다. 짝 다리가 반쪽 묶음으로 남아 통계에서 조용히 빠지거나 고아 링크가 생기지 않는다. `unlink_transactions`와 동일한 정리 로직 재사용.

재검증: 스크래치패드 `test_medium_fixes.py`(임시 venv + 인메모리 SQLite, 실제 모듈 import·실행) → **16개 체크 ALL PASS**: 익월 환불 결제월 상쇄·환불 증발 방지·전액 익월환불·같은월 회귀(Medium 1), 짝 다리 독립 복원·고아 링크 정리·삭제 후 통계 재반영·미묶음 삭제 회귀(Medium 2). 두 수정 모두 백엔드 전용이라 프론트 변경 없음.

## QA 재작업 (2회차) — 새 Medium 해소: 묶인 거래 수정 재검증

2회차 QA에서 이전 Medium 2건은 수정 확인됐고, 같은 "묶인 거래 정합성" 클래스의 새 Medium 1건이 발견됐다: `update_transaction`이 묶음 제약을 재검증하지 않아, 묶인 거래를 편집하면(예: 환불 수입을 지출보다 크게) 통계가 조용히 왜곡됨.

- **처리 방향 결정** [사용자 확인]: 묶인 거래 수정 시 **재검증 후 위반이면 거부**(묶음 유지). 자동 해제/수정 차단 대신, 묶음이 항상 유효 상태를 유지하도록 함.
- **수정** (`transactions.py`): `link_transactions`의 유형별 규칙을 공용 헬퍼 `_check_link_pair`로 추출하고, `update_transaction`이 묶인 거래(link_id != None)를 수정할 때 짝 다리와 함께 재검증하도록 함(setattr 전 payload 값으로 검증해 세션 미오염). 위반(이체 금액 불일치·같은 계정, 환불>지출, 수입/지출 구분 파괴) 시 422. 묶음 무관 필드(메모·날짜 등)만 바꾸는 건 허용. 미묶음 거래는 종전대로 자유 수정.
- **의도된 제약**: 이체 묶음의 금액을 바꾸려면 한쪽만 바꾸는 순간 짝과 불일치가 되어 거부되므로, 먼저 묶음을 해제해야 한다(재검증 방식의 자연스러운 귀결).

재검증: `test_update_revalidate.py`(SQLite, 실제 모듈 실행) → **8개 체크 ALL PASS**(이체 금액변경·같은계정·kind변경 거부, 환불>지출 거부, 메모·날짜 수정 허용, 환불≤지출 허용, 미묶음 자유수정 회귀). 이전 회귀(`test_links.py`·`test_medium_fixes.py`)도 재실행 → 모두 ALL PASS(회귀 없음). 백엔드 전용 수정이라 프론트 변경 없음(서버 422가 기존 폼 에러 처리로 사용자에게 표시됨).

## 자체 검증 결과
- `python -c ast.parse(...)` (백엔드 5개 변경 파일) → **문법 OK**
- `npm run build` (tsc -b && vite build) → **통과** (초기 TS2448 오류: columns가 toggleSelect/doUnlink를 선언 전 참조 → 두 정의를 columns 앞으로 이동해 해결. 재빌드 성공)
- `npm run lint` (eslint) → **0 errors, 2 warnings**. 경고 2건은 기존 코드 패턴과 동일: (a) columns useMemo의 `openEdit`/`doUnlink` 누락 의존성 — 원본도 `openEdit`을 `[remove]`에만 두던 기존 패턴, (b) TanStack Table `useReactTable` incompatible-library 경고(기존부터 존재).
- **묶기/집계 로직 SQLite 통합 검증** (임시 venv + 인메모리 SQLite로 `analytics._income_expense_stats` / `transactions.link_transactions` / `unlink_transactions` 실제 실행) → **ALL PASS** (18개 체크): 묶기 전 합계, 이체 묶음 제외(AC-2), 환불 순지출·카테고리 차감(AC-3), 해제 복원(AC-4), 원본 보존(AC-1), 거부 규칙 5종(AC-5), 링크 그룹 삭제(AC-4).
- `alembic history`/`heads` → **0010 (head)**, 0009→0010 체인 정상(AC-8 구조 확인).
- 브라우저 E2E(선택 UI·다이얼로그·모바일 375px 조작/레이아웃)는 /qa 위임.

## 성공 기준 자가 체크
- [x] AC-1: 2건 선택→이체 묶기 시 원본 보존 + 연결(SQLite 검증 "이체 원본 2건 보존"). 화면 배지 표시는 컬럼/카드 셀에 구현, 브라우저 확인은 /qa.
- [x] AC-2: 이체 묶음 두 다리가 income/expense/대분류에서 제외됨(검증 got=3,020,000 / 60,000). 잔액 미변경은 assets 로직 미수정으로 보장.
- [x] AC-3: 환불 묶음 순지출(결제−환불)만 반영, 환불 수입 제외(검증 income 3,000,000 / expense 40,000 / 식비 40,000).
- [x] AC-4: 해제 시 두 거래가 독립 복원되고 통계 원상 복귀(검증 income/expense 최초값 일치, 링크 그룹 삭제).
- [x] AC-5: 부적합 조합 5종(2건 아님/같은 방향/이체 금액 불일치/환불 초과/이미 묶임) 모두 422 거부, 데이터 불변(SQLite 검증).
- [x] AC-6: 묶기/해제 모두 단일 커밋 트랜잭션(link_transactions·unlink_transactions 각각 db.commit() 1회).
- [x] AC-7: `_month_stats`가 dashboard와 동일한 `_income_expense_stats`를 호출 — 규칙 공유로 수치 일치.
- [x] AC-8: `alembic heads`=0010(head), 0009→0010 체인 정상. 실제 upgrade/downgrade 적용은 Docker/QA 환경.
- [~] AC-9(모바일): 체크박스(터치 라벨 래핑)·묶기 버튼·다이얼로그·묶음 배지·해제 버튼을 모바일 카드/375px 기준으로 구현. flex-wrap·truncate·min-w-0로 오버플로 방지. **브라우저 375px 실측은 /qa 단독 수행.**

## 보류/미완 항목
- 실제 Postgres 대상 `alembic upgrade head`/`downgrade`는 로컬에 DB/venv가 없어 Docker/QA 환경에서 수행(구조·문법은 확인). 
- member 필터 하 묶음 두 다리 소유자 상이 시 상쇄 비대칭 — research.md 문서화된 엣지, 이번 범위 밖.
- 캘린더 상세 목록은 묶음 배지 표시·해제만 제공하고 선택(묶기)은 테이블/카드 뷰에서만 — research.md 제안대로.
