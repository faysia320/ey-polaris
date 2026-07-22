# Research: 월 일괄 삭제 · 업로드 확인 모달 스크롤 · 자산 구성원별 분할 표시

- 날짜: 2026-07-22
- 요청 원문:
  ```
  아래 내용에 대해 검토 후 계획을 수립해줘
  1. 지출/수입 내역에 해당월 전체 삭제 기능 추가
  2. 엑셀 업로드 시, 업로드 내역을 확인하는 모달에 스크롤이 없는 문제가 있어. scrollarea 추가해줘
  3. 자산 상태에서 전체로 볼 때, 각 자산을 좌측엔 으니, 우측엔 영이걸로 나눠 표시해줘. 은행/현금/카드 같은 카테고리 안에서 분할해서 보여줘
  ```

## 요약

세 요청은 서로 독립적이며 난이도가 크게 다르다.

**(1) 월 일괄 삭제** — 백엔드에 bulk delete 엔드포인트가 하나도 없다(`transactions.py`의 delete는 `:125` 단건뿐). 다만 `import_transactions` 내부 `transactions.py:264-275`에 이미 월 범위 `delete(...).rowcount` 선례가 있어 그대로 참고 가능하다. `_month_range()`(`transactions.py:15-19`)도 재사용된다. 주의점 두 가지: `filters.month`는 MonthPicker가 `clearable`이라 `null`("전체 기간")일 수 있고(`TransactionsPage.tsx:480-494`), 현재 코드베이스에는 삭제 확인 다이얼로그가 아예 없다(단건 삭제도 클릭 즉시 실행 — `TransactionsPage.tsx:305-307`). 파괴적 작업인 만큼 확인 단계가 필수이며, `BudgetsPage.tsx:240-255`의 "전월 예산 복사" 확인 다이얼로그가 정확한 선례다.

**(2) 업로드 확인 모달 스크롤** — 원인을 특정했다. `ScrollArea`는 이미 존재하고(`ui/scroll-area.tsx`) 이체 검토 목록에는 적용돼 있다(`TransactionsPage.tsx:977` `max-h-[50vh]`). 문제는 두 곳이다. 첫째, **평가액 목록(`TransactionsPage.tsx:954-976`)에 스크롤 컨테이너가 전혀 없어** 부동산·주식 행이 많으면 무한정 늘어난다. 둘째, 더 근본적으로 **`DialogContent`에 `max-h`도 `overflow`도 없다**(`ui/dialog.tsx:61-68`). Radix Content가 `top-1/2 -translate-y-1/2` 고정 배치라 콘텐츠가 뷰포트를 넘으면 위아래가 화면 밖으로 잘리고 스크롤로도 접근할 수 없다. 사용자가 말한 "업로드 내용 확인" 모달은 `review.length === 0`인 분기(`:892`)로, 정확히 평가액 목록만 길게 나오는 경우다.

**(3) 자산 구성원별 분할** — 프론트만으로는 불가능하다. 자산 페이지가 받는 `AccountBalance`에는 member 정보가 없다(`schemas.py:201-208`, `types.ts:102-110`, 조립부 `analytics.py:165-172`). 반면 `Account` 모델에는 `member_id`가 필수 필드로 존재한다(`models.py:46`). 따라서 **백엔드 응답에 `member_id`/`member_name`을 추가하는 것이 선행 작업**이다. "으니"/"영이"는 시드에 실제 존재한다(`alembic/versions/0002_seed_master_data.py:46-47`, color `#f472b6`/`#60a5fa`). 구성원별로 화면을 분할하는 UI 패턴은 코드베이스에 아직 없다 — member는 지금까지 필터 또는 단일 컬럼으로만 쓰였다.

**"좌측/우측" 해석 주의**: 375px 모바일에서 2열 고정은 CLAUDE.md 모바일 제약과 정면 충돌한다. 데스크톱에서만 좌우 2열, 모바일에서는 세로 적층으로 처리해야 한다. 또한 구성원이 3명 이상으로 늘어날 때를 대비해 "으니/영이"를 하드코딩하지 말고 구성원 목록 기반으로 일반화해야 한다 (미해결 질문 참조).

## 관련 파일 및 근거

### 공통
- `frontend/src/lib/api.ts:30` — `delete: (path: string) => request<void>(...)`. 반환 타입이 `void`로 하드코딩 → 삭제 건수를 응답받으려면 제네릭화 필요
- `frontend/src/lib/api.ts:20` — 204는 `undefined` 반환. 200+본문을 쓸지 204를 쓸지 결정에 영향
- `backend/app/routers/utils.py` — `get_or_404`, `commit_or_conflict` (IntegrityError → 409)

### (1) 월 일괄 삭제
- `backend/app/routers/transactions.py:15-19` — `_month_range(month) -> (start, end)` 반개구간. 12월 롤오버 처리 포함. 재사용 대상
- `backend/app/routers/transactions.py:65-87` — `list_transactions`의 `month: str | None = Query(pattern=schemas.YEAR_MONTH_PATTERN)` 관례. 새 엔드포인트도 이 관례를 따라야 일관됨
- `backend/app/routers/transactions.py:125-129` — 단건 `DELETE /{transaction_id}`, 204, raw `db.commit()`
- `backend/app/routers/transactions.py:264-275` — **월 범위 대량 삭제 선례**. `delete(...).where(date >= start, date < end, source == "import", member 조건).rowcount`
- `backend/app/routers/transactions.py:260-262` — `month_rows == 0` 가드와 주석 "빈 월을 잘못 골라 기존 데이터만 지우는 사고 방지". 이 레포의 파괴적 작업 방어 철학
- `backend/app/schemas.py:7` — `YEAR_MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"`
- `backend/app/models.py:111` — `source: manual | import`. 삭제 범위를 manual/import로 나눌 수 있는 유일한 축
- `frontend/src/stores/transactions.ts:7-15` — `TransactionFilters.month: string | null`. **월 상태는 store에 저장**되며 컴포넌트 로컬이 아님
- `frontend/src/stores/transactions.ts:67-70` — `remove(id)`: 삭제 후 전체 재조회 패턴 (낙관적 업데이트 없음). 일괄 삭제도 동일 패턴을 따를 것
- `frontend/src/pages/TransactionsPage.tsx:445-475` — 툴바. `:468` 엑셀 업로드 / `:471` 거래 추가 버튼 사이가 신규 버튼 위치 후보
- `frontend/src/pages/TransactionsPage.tsx:480-494` — `MonthPicker ... clearable placeholder="전체 기간"`. **`month`가 `null`일 수 있는 엣지 케이스의 근원**
- `frontend/src/pages/TransactionsPage.tsx:125,477` — `pageError` state와 렌더 위치 (에러 처리 관례)
- `frontend/src/pages/BudgetsPage.tsx:39,240-255` — **확인 다이얼로그 유일 선례**. `confirmOpen` state + Dialog + 파괴적 동작 설명 + 취소/실행 Footer

### (2) 업로드 확인 모달 스크롤
- `frontend/src/components/ui/dialog.tsx:61-68` — **`DialogContent`에 `max-h`/`overflow` 없음**. `grid` 레이아웃이라 자식 트랙 기본 `min-height:auto` → 내부 스크롤 자식에 `min-h-0`이 없으면 축소되지 않음
- `frontend/src/pages/TransactionsPage.tsx:883-886` — 업로드 Dialog. `DialogContent`에 너비(`sm:max-w-2xl`/`sm:max-w-md`)만 지정, 높이 제약 없음
- `frontend/src/pages/TransactionsPage.tsx:888-893` — 제목 3분기. `'업로드 내용 확인'`은 `review.length === 0`일 때 → 사용자가 지목한 화면
- `frontend/src/pages/TransactionsPage.tsx:954-976` — **평가액 목록. 스크롤 컨테이너 없이 `importPreview.valuations` 전량 렌더** (핵심 결함)
- `frontend/src/pages/TransactionsPage.tsx:977,1066` — 이체 검토 목록 `ScrollArea max-h-[50vh]` (이미 적용됨)
- `frontend/src/pages/TransactionsPage.tsx:930-938` — 건너뛴 행 목록 `ScrollArea max-h-40 rounded-md border` (이미 적용됨)
- `frontend/src/pages/TransactionsPage.tsx:1115-1143` — `DialogFooter`. 스크롤 영역 밖에 고정되어야 함
- `frontend/src/components/ui/scroll-area.tsx:1-56` — 이미 존재. Root `relative` + Viewport `size-full`. **`radix-ui` 모놀리식 패키지 사용, 추가 설치 불필요**
- `frontend/src/components/ui/dialog.tsx:109-111` — `DialogFooter`가 음수 마진(`-mx-4 -mb-4`)으로 카드 하단에 붙음. 내부 스크롤 도입 시 이 마진과의 상호작용 주의
- 다른 Dialog 사용처 8곳 — `AssetsPage.tsx:390,463`, `BudgetsPage.tsx:241`, `DashboardPage.tsx:312`, `SettingsPage.tsx:200,386,563`, `TransactionsPage.tsx:709`. `DialogContent`를 전역 수정할 경우 전부 영향권

### (3) 자산 구성원별 분할
- `backend/app/schemas.py:201-208` — `AccountBalance`에 `id/name/type/is_active/balance/valued_at`뿐. **member 없음**
- `backend/app/routers/analytics.py:165-172` — `AccountBalance` 조립부. 여기에 member 주입 필요
- `backend/app/routers/analytics.py:98,101` — `accounts` 전량 조회 후 `visible = accounts if member_id is None else [...]`. 루프 변수 `a`가 `models.Account`이므로 `a.member_id` 접근은 이미 가능
- `backend/app/models.py:46` — `Account.member_id` 필수 필드 (소유자)
- `backend/app/schemas.py:109` / `frontend/src/types.ts:56` — `member_name` 비정규화 선례 (Transaction). 동일 패턴 적용 가능
- `frontend/src/types.ts:102-110` — `AccountBalance` FE 타입. 백엔드와 동시 수정 필요
- `frontend/src/pages/AssetsPage.tsx:320-375` — **유형별 그룹 카드 렌더링. 이번 변경의 주 무대.** `Object.keys(ACCOUNT_TYPE_LABEL)` 순회 → `HIDDEN_GROUP_TYPES`(easy_pay) skip → `filter(a => a.type === type)` → 빈 그룹 `null` → 소계 `reduce` → `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`로 계정 카드
- `frontend/src/pages/AssetsPage.tsx:29-38` — `ACCOUNT_TYPE_LABEL` (은행/현금/카드/…)
- `frontend/src/pages/AssetsPage.tsx:222-227` — 헤더 + `MemberFilterSelect`
- `frontend/src/stores/memberFilter.ts:5,11` — 전역 `memberId: number | null`. **`null`이 곧 "전체"** → 이번 요청의 대상 상태
- `frontend/src/components/members/MemberFilterSelect.tsx:26-27,34` — `'all'` ↔ `null` 변환
- `frontend/src/stores/masterData.ts:52-57` — `members` 목록 조회처. 구성원 이름·색상 공급원
- `backend/app/models.py:22-29` / `frontend/src/types.ts:14-18` — `Member { id, name, color }`. **`color`가 있어 구성원 구분 색상에 즉시 활용 가능**
- `backend/alembic/versions/0002_seed_master_data.py:46-47` — 시드에 "으니"(`#f472b6`), "영이"(`#60a5fa`) 존재
- `frontend/src/pages/AssetsPage.tsx:219-220`, `backend/app/routers/analytics.py:173` — 목표 카드는 `grand_total`(가구 전체) 사용, 구성원 필터 무관. 이번 변경에서도 유지해야 함 (선행 작업 AC-13 계약)

## 영향도

**(1) 월 일괄 삭제**
- `backend/app/routers/transactions.py` — 신규 엔드포인트 추가. 기존 라우트와 경로 충돌 주의: `DELETE ""`(컬렉션)와 `DELETE "/{transaction_id}"`는 FastAPI에서 구분되나, 등록 순서와 경로 형태를 명확히 할 것
- `backend/app/schemas.py` — 삭제 결과 스키마 신설 시 (200 응답 선택 시에만)
- `frontend/src/lib/api.ts` — `api.delete`를 제네릭화하면 기존 호출부 6곳(accounts/budgets/categories/goals/members/valuations store)이 모두 영향. `request<void>` → `request<T>`는 후방호환이지만 **타입 추론 변화로 빌드 에러 가능성** → `npm run build`로 검증 필수
- `frontend/src/stores/transactions.ts` — 액션 추가. `remove`와 동일하게 삭제 후 `fetch()` 재조회
- 대시보드·예산·자산 페이지 — 거래가 대량 삭제되면 집계가 변한다. 단, 각 페이지가 자체 조회하므로 **코드 영향은 없고 데이터 영향만** 있음. 자산 잔액은 평가액이 있는 계정은 평가액 단독 계산이라(`analytics.py:133-135` 주석) 거래 삭제 영향을 받지 않음
- **이체(transfer) 거래**: 한 행이 출금·입금 두 다리를 모두 표현하므로(`transactions.py:43-51`) 행 삭제 시 짝 처리 이슈 없음 — 단건 삭제와 동일하게 안전

**(2) 업로드 모달 스크롤**
- `frontend/src/pages/TransactionsPage.tsx`만 수정하면 요청 범위 충족 (국소 변경, 영향 없음)
- **`ui/dialog.tsx`를 전역 수정할 경우** — Dialog 사용처 9곳 전부 영향. 근본 해결이지만 회귀 범위가 넓음. 범위 결정은 미해결 질문 참조
- `ScrollArea` 신규 의존성 없음 — 이미 존재하고 `radix-ui` 패키지에 포함

**(3) 자산 구성원별 분할**
- `backend/app/routers/analytics.py` + `backend/app/schemas.py` — `AccountBalance` 필드 추가. **필드 추가는 기존 소비자에게 후방호환** (Pydantic 응답 확장)
- `frontend/src/types.ts` — `AccountBalance` 인터페이스 확장. 필수 필드로 추가하면 이 타입을 쓰는 모든 곳이 컴파일 대상
- `frontend/src/pages/AssetsPage.tsx` — 그룹 렌더링 재구성. 소계 계산 로직이 구성원별로 쪼개짐
- `DashboardPage` — `AccountBalance`를 소비하는지 확인 필요 (미확인 → 미해결 질문)
- **DB 마이그레이션 불필요** — `Account.member_id`는 이미 존재하며 백필도 완료됨(`0005_account_owner_required.py`)
- 모바일 회귀 위험이 가장 큰 항목. 기존 `md:grid-cols-2 xl:grid-cols-3` 안에 구성원 분할을 중첩하면 컬럼이 과도하게 좁아질 수 있음

## 성공 기준 (Acceptance Criteria)

### (1) 월 일괄 삭제

- [ ] **AC-1**: 백엔드에 특정 월의 거래를 일괄 삭제하는 엔드포인트가 존재하고, `month`는 `YEAR_MONTH_PATTERN` 검증을 받는다 — `/docs`(OpenAPI)에서 엔드포인트 노출 확인, 잘못된 형식(`2026-13`) 요청 시 422 응답 확인
- [ ] **AC-2**: 해당 월 거래만 삭제되고 인접 월(전월 말일·익월 1일)은 보존된다 — 3개월치 데이터가 있는 상태에서 가운데 달 삭제 후 `GET /transactions?month=`로 전월·익월 건수가 불변임을 확인
- [ ] **AC-3**: 응답으로 삭제된 건수를 확인할 수 있고, 프론트가 그 값을 사용자에게 표시한다 — 실제 삭제 후 화면에 표시된 건수가 삭제 전 목록 건수와 일치하는지 확인
- [ ] **AC-4**: 삭제 대상이 0건인 월에 실행해도 500이 아닌 정상 응답(삭제 0건)을 반환한다 — 빈 월로 요청해 확인
- [ ] **AC-5**: 삭제 실행 전 확인 단계가 있으며, 확인 문구에 **대상 월과 삭제될 건수**가 명시된다 — 버튼 클릭 시 즉시 삭제되지 않고 확인 UI가 뜨는지, 취소 시 데이터가 그대로인지 확인
- [ ] **AC-6**: `filters.month`가 `null`("전체 기간")일 때 일괄 삭제를 실행할 수 없다 — MonthPicker를 비운 상태에서 버튼이 비활성이거나 실행이 차단되는지 확인 (전체 데이터 소실 방지)
- [ ] **AC-7**: 삭제 성공 후 거래 목록이 자동 갱신되어 해당 월이 비어 보인다 — 수동 새로고침 없이 화면이 갱신되는지 확인
- [ ] **AC-8**: 삭제 실패 시 기존 `pageError` 관례로 에러 메시지가 화면에 표시된다 — 백엔드를 중단시키거나 잘못된 요청을 유도해 확인
- [ ] **AC-9 (모바일)**: 375px 뷰포트에서 툴바에 버튼이 추가된 뒤에도 가로 스크롤·요소 겹침·잘림이 없고, 확인 다이얼로그의 버튼이 화면 안에 온전히 보인다 — **/qa 단계에서** 브라우저 도구로 375px 리사이즈 후 확인

### (2) 업로드 확인 모달 스크롤

- [ ] **AC-10**: 평가액 항목이 많은 파일을 업로드해도 "업로드 내용 확인" 모달이 뷰포트를 벗어나지 않는다 — 평가액 20건 이상 시나리오에서 모달 상·하단(제목과 Footer 버튼)이 모두 화면 안에 보이는지 확인
- [ ] **AC-11**: 모달 내 긴 목록이 `ScrollArea`로 스크롤되며 끝까지 도달할 수 있다 — 스크롤해 마지막 항목이 보이는지 확인 (native `overflow-y-auto`가 아닌 `ScrollArea` 사용 — 코드베이스 관례, `docs/tasks/2026-06-12-replace-native-scroll-with-scrollarea/` 계약)
- [ ] **AC-12**: `DialogHeader`와 `DialogFooter`(확정/취소 버튼)는 스크롤 영역 밖에 남아 항상 조작 가능하다 — 목록을 중간까지 스크롤한 상태에서 버튼이 여전히 보이는지 확인
- [ ] **AC-13**: 기존에 동작하던 3개 상태(엑셀 업로드 입력 / 이체 내역 검토 / 결과)가 모두 회귀 없이 렌더링된다 — 세 분기를 각각 재현해 확인
- [ ] **AC-14**: 이체 검토 목록 내 `Select`(수입/지출/이체/건너뛰기) 드롭다운이 스크롤 컨테이너 안에서도 정상 열리고 선택된다 — 스크롤 후 항목의 Select를 열어 확인 (Radix Popper와 스크롤 컨테이너 상호작용 회귀 지점)
- [ ] **AC-15 (모바일)**: 375px 뷰포트에서 모달이 가로 스크롤 없이 표시되고, 세로로 긴 콘텐츠가 스크롤로 모두 접근 가능하다 — **/qa 단계에서** 브라우저 도구로 확인
- [ ] **AC-16**: `DialogContent` 공용 컴포넌트를 수정한 경우, 나머지 Dialog 8곳이 회귀 없이 렌더링된다 — 수정했다면 각 다이얼로그를 열어 확인. 수정하지 않았다면 "해당 없음"으로 명시

### (3) 자산 구성원별 분할

- [ ] **AC-17**: `/analytics/assets` 응답의 각 계정에 소유 구성원을 식별할 정보가 포함된다 — `/docs`에서 응답 스키마 확인 또는 실제 응답 JSON 확인 (필드명은 구현 재량)
- [ ] **AC-18**: 구성원 필터가 "전체"일 때, 각 자산 유형 카드(은행/현금/카드 등) **안에서** 계정이 구성원별로 나뉘어 표시되고 각 구성원 이름이 보인다 — 자산 페이지에서 "전체" 선택 후 육안 확인
- [ ] **AC-19**: 구성원별 그룹은 하드코딩이 아니라 실제 구성원 데이터에 기반한다 — 구성원을 1명 추가한 뒤에도 화면이 깨지지 않고 새 구성원이 반영되는지 확인
- [ ] **AC-20**: 특정 구성원을 선택한 경우(필터가 "전체"가 아닐 때)에는 기존 표시 방식이 유지되어 불필요한 분할이 나타나지 않는다 — 구성원 선택 후 확인
- [ ] **AC-21**: 계정이 없는 자산 유형은 여전히 표시되지 않고, 한쪽 구성원만 계정을 가진 유형도 레이아웃이 깨지지 않는다 — 한쪽만 계정이 있는 유형에서 확인
- [ ] **AC-22**: 자산 유형별 소계와 총자산 금액이 분할 표시 도입 전과 동일하다 — 변경 전후 총자산 카드 금액 비교로 확인 (표시 방식 변경일 뿐 집계 변경이 아님)
- [ ] **AC-23**: 목표 달성 현황 카드는 기존대로 가구 전체(`grand_total`) 기준을 유지한다 — 구성원 필터를 바꿔도 목표 카드 금액이 불변인지 확인 (선행 작업 계약 유지)
- [ ] **AC-24 (모바일)**: 375px 뷰포트에서 구성원 분할이 좌우 2열로 강제되지 않고 세로로 적층되며, 가로 스크롤·요소 겹침·잘림이 없다 — **/qa 단계에서** 브라우저 도구로 375px 및 데스크톱 폭 양쪽 확인
- [ ] **AC-25**: `npm run build`(tsc + vite)가 에러 없이 통과한다 — 명령 실행으로 확인

## Action Items

### (1) 월 일괄 삭제
- [ ] `backend/app/routers/transactions.py`에 월 단위 일괄 삭제 엔드포인트 추가. `_month_range()` 재사용, `transactions.py:264-275` 삭제 패턴 참고. 삭제 건수를 반환하도록 설계
- [ ] 삭제 범위 정책 확정 후 반영 — 구성원 필터(`member_id`)를 존중할지, `source`(manual/import)를 구분할지 (미해결 질문 Q1)
- [ ] 삭제 건수 응답을 위한 스키마 정의 (200 응답 채택 시)
- [ ] `frontend/src/lib/api.ts`의 `delete`를 응답 본문을 받을 수 있도록 확장. 기존 호출부 후방호환 유지 확인
- [ ] `frontend/src/stores/transactions.ts`에 일괄 삭제 액션 추가 — `remove`와 동일하게 성공 후 `fetch()` 재조회
- [ ] `TransactionsPage.tsx` 툴바(`:445-475`)에 삭제 트리거 추가. `filters.month`가 `null`이면 비활성 처리
- [ ] `BudgetsPage.tsx:240-255` 패턴을 따라 확인 다이얼로그 추가. 대상 월·삭제 건수를 문구에 노출
- [ ] 에러는 기존 `pageError` 관례로 표시

### (2) 업로드 확인 모달 스크롤
- [ ] 스크롤 적용 범위 결정 — 업로드 다이얼로그 국소 수정 vs `ui/dialog.tsx` 전역 수정 (미해결 질문 Q2)
- [ ] 평가액 목록(`TransactionsPage.tsx:954-976`)에 `ScrollArea` 기반 높이 제약 적용
- [ ] 다이얼로그 전체 높이가 뷰포트를 넘지 않도록 제약하고, Header/Footer는 고정한 채 본문만 스크롤되도록 구성. `DialogContent`가 `grid`이므로 스크롤 자식의 `min-h-0` 처리 필요(`ui/dialog.tsx:61-68`)
- [ ] 기존 `ScrollArea` 두 곳(`:930`, `:977`)과 새 스크롤 영역이 중첩되지 않도록 정리 — 이중 스크롤바 방지
- [ ] `DialogFooter`의 음수 마진(`ui/dialog.tsx:109-111`)과 스크롤 컨테이너 경계가 어긋나지 않는지 확인

### (3) 자산 구성원별 분할
- [ ] `backend/app/schemas.py`의 `AccountBalance`에 구성원 식별 필드 추가 (`Transaction`의 `member_name` 비정규화 패턴 참고 — `schemas.py:109`)
- [ ] `backend/app/routers/analytics.py:165-172` 조립부에서 해당 필드를 채움. 루프 변수 `a`가 `models.Account`이므로 `a.member_id` 접근 가능. `member_name`을 담으려면 relationship 조회 비용 확인 (N+1 방지 — `selectinload` 고려)
- [ ] `frontend/src/types.ts:102-110`의 `AccountBalance`를 백엔드와 동기화
- [ ] `AssetsPage.tsx:320-375` 그룹 렌더링을 유형 → 구성원 2단 중첩으로 재구성. 구성원 목록은 `masterData` store에서 가져와 하드코딩 회피
- [ ] 반응형 처리 — 데스크톱은 좌우 분할, 모바일(375px)은 세로 적층. 기존 `md:grid-cols-2 xl:grid-cols-3` 계정 그리드와 중첩 시 컬럼 폭이 과도하게 좁아지지 않도록 조정
- [ ] `Member.color`(`models.py:22-29`)를 구성원 구분 시각 단서로 활용할지 결정
- [ ] 구성원 필터가 "전체"가 아닐 때는 분할하지 않는 분기 처리
- [ ] `DashboardPage`가 `AccountBalance`를 소비하는지 확인 후 타입 변경 영향 반영

### 공통
- [ ] `cd frontend && npm run build`로 타입·빌드 검증
- [ ] `cd frontend && npm run lint` 통과 확인

## 미해결 질문

- **Q1 (사용자 결정 필요 — 월 일괄 삭제 범위)**: "해당월 전체 삭제"의 범위가 모호하다. 세 가지 해석이 가능하다.
  1. 그 달의 **모든** 거래 (구성원·source 무관)
  2. **현재 화면 필터가 적용된** 거래만 (구성원 필터 등 반영 — 화면에 보이는 것만 지우므로 직관적이나, 필터를 잊으면 예상과 다르게 동작)
  3. `source == "import"`인 거래만 (엑셀 재업로드 대비용. 수기 입력 거래 보호)

  `import_transactions:264-275`의 기존 대량 삭제는 3번+구성원 조건이다. **권장은 1번(그 달 전체)** — 기능명이 "해당월 전체 삭제"이고, 부분 삭제는 사용자가 예상하기 어렵다. 다만 확인 다이얼로그에 삭제 건수를 반드시 노출해 오인을 막아야 한다. 사용자 확인 필요.

- **Q2 (구현 재량 — 스크롤 적용 범위)**: `ui/dialog.tsx`의 `DialogContent`를 전역 수정해 모든 다이얼로그의 높이 문제를 근본 해결할지, 업로드 다이얼로그만 국소 수정할지. 전역 수정이 근본적이지만 Dialog 9곳 전부가 회귀 검증 대상이 된다. 요청은 업로드 모달만 지목했으므로 **국소 수정을 기본으로 하되**, 구현 중 전역 수정이 명백히 더 안전하다고 판단되면 채택하고 AC-16으로 검증할 것.

- **Q3 (구현 재량 — 응답 형태)**: 일괄 삭제를 204(본문 없음)로 할지 200+삭제 건수로 할지. AC-3이 건수 표시를 요구하므로 200이 자연스럽지만, 삭제 전 `GET`으로 건수를 미리 알 수 있어 204도 가능하다. 필드명·스키마명은 구현 재량.

- **Q4 (구현 재량 — 필드명)**: `AccountBalance`에 추가할 구성원 필드의 이름(`member_id`만인지 `member_name`도 포함인지). AC-17은 "소유 구성원을 식별할 정보"만 요구하며 구체적 키 이름은 재량.

- **Q5 (미확인)**: `DashboardPage`가 `AccountBalance` 타입을 소비하는지 직접 확인하지 못했다. `types.ts` 변경 시 컴파일 에러로 드러날 것이므로 `npm run build`로 포착 가능하다.

- **Q6 (사용자 결정 권장 — 구성원 3명 이상)**: 요청은 "좌측 으니, 우측 영이"로 2명을 전제하나, 구성원은 Settings에서 추가 가능하다(`SettingsPage.tsx:486-554`). AC-19는 하드코딩 금지만 계약했고, 3명 이상일 때의 정확한 레이아웃(3열 / 줄바꿈 / 스크롤)은 구현 재량으로 남긴다.

- **Q7 (미확인)**: 백엔드 테스트 디렉터리가 없어(`backend/`에 `alembic/`, `app/`만 존재) 백엔드 AC는 실행 테스트가 아니라 **API 호출 또는 `/docs` 확인**으로 검증해야 한다. 테스트 하네스 신설은 이번 범위 밖으로 본다.
