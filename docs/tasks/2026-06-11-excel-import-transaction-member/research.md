# Research: 엑셀 업로드 시 거래 구성원(member_id) 비어 있음 수정

- 날짜: 2026-06-11
- 요청 원문: 지출/수입 내역에서 액셀업로드 할때 구성원을 선택했는데 막상 업로드된 데이터는 구성원이 비어있어

## 요약

엑셀 업로드(가져오기) API는 거래를 생성할 때 `member_id=None`으로 하드코딩하고 있다(`backend/app/routers/transactions.py:187`). 업로드 다이얼로그에서 선택하는 구성원은 라벨 그대로 "새 계정 기본 소유자"(`frontend/src/pages/TransactionsPage.tsx:796`)로, **엑셀에 처음 등장해 자동 생성되는 계정의 소유자**(`transactions.py:173`)에만 쓰이고 거래 자체에는 반영되지 않는다. 이는 최초 가져오기 설계 당시 "파일에 구성원 정보가 없다"는 이유로 의도된 동작이었다(`docs/tasks/2026-06-11-monthly-excel-import/research.md:78`). 그러나 이후 정책 변경으로 **모든 계정에 소유자가 필수**가 되었으므로(`backend/app/models.py:24,34`, 마이그레이션 0005), 이제는 거래의 결제수단(계정)을 통해 구성원을 확정할 수 있다.

해결 방향: 가져오기로 생성되는 각 거래의 `member_id`를 **해당 거래가 속한 계정의 소유자(`account.member_id`)에서 상속**한다. 새로 자동 생성되는 계정의 소유자는 `default_member_id`이므로, 그 계정의 거래들은 자연히 다이얼로그에서 선택한 구성원으로 귀속된다 — 사용자 기대와 일치하면서, 기존 계정(예: 배우자 명의 카드)의 거래는 실제 소유자에게 정확히 귀속된다. 단순히 모든 거래에 `default_member_id`를 박는 대안보다 의미적으로 올바르다. 추가로, 이미 업로드되어 `member_id`가 비어 있는 기존 import 거래를 계정 소유자로 백필하는 마이그레이션(0006)을 포함해 과거 월 데이터도 함께 고친다.

## 관련 파일 및 근거

### 원인 지점
- `backend/app/routers/transactions.py:115-201` — 가져오기 엔드포인트 `POST /transactions/import`. `default_member_id`는 새 계정 생성 시 소유자로만 사용(`:173`)되고, 거래 생성 시에는 `member_id=None` 하드코딩(`:187`).
- `docs/tasks/2026-06-11-monthly-excel-import/research.md:78` — "member_id: null (누구의 거래인지 파일에 없음)" — 당시 의도된 설계. 이후 계정 소유자 필수화(0005)로 전제가 바뀜.

### 수정에 활용할 구조
- `backend/app/models.py:21-37` — `Account.member_id`는 NOT NULL(소유자 필수). 가져오기 루프에서 거래의 계정이 항상 확정되므로(`transactions.py:166-178`) 소유자 상속이 항상 가능.
- `backend/app/models.py:77-79` — `Transaction.member_id`는 nullable FK. 스키마 변경 없이 값만 채우면 됨.
- `backend/app/routers/transactions.py:80-81` — 거래 목록의 구성원 필터는 `Transaction.member_id` 기준. 현재 import 거래는 전부 null이라 구성원 필터에서 누락됨 — 이번 수정으로 필터에 잡히게 됨.

### 프런트엔드 (문구만 해당)
- `frontend/src/pages/TransactionsPage.tsx:795-812` — 업로드 다이얼로그의 구성원 select. 라벨 "새 계정 기본 소유자"(`:796`)와 도움말 문구(`:809-811`)가 새 동작(거래가 계정 소유자에게 귀속됨)을 설명하지 못함 — 문구 갱신 필요. 로직 변경은 불필요(이미 `default_member_id`를 전송 중, `:307`).

### 마이그레이션
- `backend/alembic/versions/0005_account_owner_required.py` — 최신 리비전. 백필 마이그레이션은 0006으로 추가.
- `backend/app/models.py:81` — `Transaction.source`('manual'|'import')로 import 거래만 선별 가능. 수동 입력 거래의 의도적 null은 건드리지 않음.

## 영향도

- **거래 목록 구성원 필터** (`backend/app/routers/transactions.py:80-81`, `frontend/src/pages/TransactionsPage.tsx:105-107`): import 거래가 필터 결과에 새로 포함되기 시작 — 의도된 개선이며 부작용 아님.
- **대시보드/분석** (`backend/app/routers/analytics.py`): 분석 API의 구성원 필터는 계정 소유 기준이므로 거래 `member_id` 변경의 영향 없음 (자산 계산은 계정 단위). 단, 거래 `member_id`를 직접 집계하는 로직이 있는지 구현 시 한 번 확인할 것.
- **재업로드 시나리오**: 같은 월 재업로드는 기존 import 거래 삭제 후 재등록(`transactions.py:139-145`)이므로 수정 후 재업로드만으로도 해당 월은 자연 치유됨. 백필 마이그레이션은 재업로드하지 않은 과거 월을 위한 것.
- **수동 입력 거래**: 영향 없음 — 백필은 `source='import' AND member_id IS NULL`만 대상.

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: 엑셀 업로드 후 생성된 모든 import 거래의 `member_id`가 해당 거래 계정의 소유자(`account.member_id`)와 일치한다 — 백엔드 기동 후 `POST /transactions/import` 실행, `GET /transactions?month=<월>` 응답에서 각 거래의 `member_id`·`member_name`이 계정 소유자와 일치함을 확인 (테스트 인프라가 없으므로 ad-hoc 스크립트 또는 수동 API 호출로 검증).
- [ ] AC-2: 엑셀에 처음 등장해 자동 생성된 계정의 거래는 다이얼로그에서 선택한 구성원(`default_member_id`)으로 귀속된다 — AC-1과 동일 방법으로, 신규 계정 거래의 `member_id == default_member_id` 확인.
- [ ] AC-3: 업로드 후 지출/수입 내역 화면에서 구성원 필터를 적용하면 import 거래가 해당 구성원 기준으로 필터링되어 표시된다 — `GET /transactions?member_id=<id>` 응답에 import 거래 포함 확인 또는 브라우저에서 확인.
- [ ] AC-4: 기존 DB의 `source='import' AND member_id IS NULL` 거래가 마이그레이션(0006) 적용 후 각자 계정의 소유자로 백필된다 — `alembic upgrade head` 후 해당 조건의 거래 수가 0임을 SQL로 확인. 수동(`source='manual'`) 거래의 null `member_id`는 변경되지 않음도 함께 확인.
- [ ] AC-5: 업로드 다이얼로그의 구성원 select 라벨·도움말 문구가 새 동작(거래가 계정 소유자 구성원으로 귀속, 새 계정은 선택한 구성원 소유)을 설명한다 — 화면 확인. 문구 자체는 구현 재량.
- [ ] AC-6: 가져오기 결과(deleted/created/skipped 수, 새 카테고리·계정 목록)는 기존과 동일하게 동작한다 — 동일 파일 재업로드 시 중복 없이 교체되는 기존 회귀 시나리오 확인.

## Action Items

- [ ] `backend/app/routers/transactions.py`의 가져오기 루프에서 거래 생성 시 `member_id=None` → 해당 행의 `account.member_id`로 변경 (신규 생성 계정 포함 — 신규 계정은 소유자가 `default_member_id`이므로 동일 경로로 처리됨).
- [ ] 가져오기 엔드포인트 docstring(`transactions.py:122-128`)의 "엑셀에는 소유자 정보가 없으므로…" 설명을 새 동작에 맞게 갱신.
- [ ] Alembic 마이그레이션 0006 추가: `transactions.source='import' AND member_id IS NULL`인 행의 `member_id`를 소속 계정의 `member_id`로 UPDATE (downgrade는 해당 조건 행을 다시 NULL로 — 정확한 역연산 불가하므로 단순 NULL 복원로 충분, import 거래의 이전 상태가 전부 NULL이었음).
- [ ] `frontend/src/pages/TransactionsPage.tsx` 업로드 다이얼로그의 구성원 select 라벨(`:796`)·도움말(`:809-811`) 문구 갱신 (예: "구성원" / "업로드되는 거래는 각 결제수단(계정)의 소유자 구성원으로 기록돼요. 새로 생성되는 계정은 여기서 선택한 구성원 소유가 돼요." — 문구는 구현 재량).

## 미해결 질문

- **거래 귀속 기준 확인**: 본 명세는 "계정 소유자 상속"을 채택했다 (배우자 명의 카드 거래가 한 사람에게 몰리는 오귀속 방지, 구성원 필터 의미와 일관). 만약 사용자의 의도가 "다이얼로그에서 선택한 구성원을 **모든** 거래에 일괄 지정"이라면 Action Item 1개만 다르게 구현하면 되므로, 구현 전 확인할 가치가 있음. 단, 새 계정만 등장하는 일반적 첫 업로드에서는 두 방식의 결과가 동일하다.
  → **해소됨 — 아래 부록 참조.**
- 백엔드에 테스트 인프라(pytest 등)가 없음 (`backend/tests` 부재) — AC 검증은 ad-hoc 스크립트/수동 API 호출 기준으로 작성했다. 테스트 셋업 추가는 본 작업 범위 밖.

---

## 부록: 사용자 결정에 따른 계약 개정 (2026-06-11, /implement 단계)

사용자 답변 원문: "내가 엑셀을 소유자별로 업로드를 할거야. 그래서 내가 요구하는건 업로드 시 선택한 구성원으로 엑셀 모든 내용이 업로드 되면 돼"

### 개정된 설계 결정

1. **귀속 기준 변경**: 계정 소유자 상속(원안) → **다이얼로그에서 선택한 구성원을 모든 거래에 일괄 지정**. 가져오기 API 파라미터는 의미 변화를 반영해 `default_member_id` → `member_id`로 개명 (호출자는 자사 프런트뿐).
2. **교체 범위 축소 (파생 필수 변경)**: 사용자는 같은 월에 구성원별 엑셀 파일을 **각각** 업로드한다. 기존의 "같은 월 import 거래 전체 삭제 후 재등록" 로직이라면 두 번째 구성원 업로드가 첫 번째 구성원의 데이터를 지워버리므로, 삭제 범위를 `source='import' AND (member_id = 선택 구성원 OR member_id IS NULL)`로 축소한다. `IS NULL` 포함은 구성원 지정 이전에 업로드된 잔재 데이터의 자연 정리용 (수정 후 import 거래는 항상 구성원을 가지므로 신규 데이터에는 해당 없음).
3. **마이그레이션 0006(백필) 제외**: 원안의 "계정 소유자로 백필"은 새 귀속 기준(선택 구성원 일괄)과 의미가 다르고, 과거 업로드 당시 어떤 구성원을 의도했는지 DB로 복원할 수 없다. 사용자가 소유자별 재업로드를 계획하고 있고, 위 2번의 NULL 정리 규칙으로 재업로드 시 잔재가 자동 제거되므로 마이그레이션은 불필요.

### 개정된 성공 기준 (이것으로 채점)

- [ ] AC-1(개정): 엑셀 업로드 후 생성된 모든 import 거래의 `member_id`가 다이얼로그에서 선택한 구성원과 일치한다 — `POST /transactions/import` 후 `GET /transactions?month=<월>` 응답으로 확인 (ad-hoc 스크립트/수동 API).
- [ ] AC-2(개정): 같은 월에 구성원 A 파일 업로드 후 구성원 B 파일을 업로드해도 A의 거래가 보존된다 — 두 번 업로드 후 양쪽 구성원 거래가 모두 존재함을 확인.
- [ ] AC-3(유지): 구성원 필터(`GET /transactions?member_id=<id>`)에 import 거래가 잡힌다.
- [ ] AC-4(개정): 같은 월·같은 구성원 재업로드 시 중복 없이 교체되고, `member_id IS NULL`인 과거 import 거래도 함께 정리된다. 수동 입력 거래와 다른 구성원의 import 거래는 보존된다.
- [ ] AC-5(유지): 업로드 다이얼로그의 라벨·도움말이 새 동작(모든 거래가 선택 구성원으로 기록, 같은 구성원 업로드만 교체)을 설명한다 — 문구는 구현 재량.
- [ ] AC-6(유지): 가져오기 결과 보고(created/deleted/skipped, 새 카테고리·계정)는 기존과 동일하게 동작한다.

(원안 AC-1·AC-4의 "계정 소유자 상속"·"백필 마이그레이션"은 본 부록으로 대체되어 채점 대상이 아니다.)
