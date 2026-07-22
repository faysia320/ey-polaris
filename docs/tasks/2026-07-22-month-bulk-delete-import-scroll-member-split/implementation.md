# Implementation: 월 일괄 삭제 · 업로드 확인 모달 스크롤 · 자산 구성원별 분할

- 날짜: 2026-07-22
- 기반 명세: `docs/tasks/2026-07-22-month-bulk-delete-import-scroll-member-split/research.md`
- 사용자 결정: **Q1 = 2번(현재 화면 필터 적용분만 삭제)**, **Q6 = 구성원 2명 고정**

## 변경 파일

- `backend/app/routers/transactions.py` — 필터 조건 빌더 `_filter_conditions()` 추출(목록/삭제 공유), `DELETE /transactions` 월 일괄 삭제 엔드포인트 추가
- `backend/app/schemas.py` — `BulkDeleteResult` 추가, `AccountBalance`에 `member_id`/`member_name` 추가
- `backend/app/routers/analytics.py` — 계정 조회에 `selectinload(Account.member)` 추가(N+1 방지), `AccountBalance` 조립부에 구성원 주입
- `frontend/src/lib/api.ts` — `api.delete`를 `<T = void>`로 제네릭화 (204/200+본문 모두 지원)
- `frontend/src/stores/transactions.ts` — `removeMonth()` 액션 추가 (현재 필터 그대로 전송, 삭제 건수 반환)
- `frontend/src/pages/TransactionsPage.tsx` — 툴바 "월 전체 삭제" 버튼, 확인 다이얼로그, 성공 안내 상태(`pageNotice`), 업로드 다이얼로그 본문 `ScrollArea`화
- `frontend/src/pages/AssetsPage.tsx` — `renderAccountCard` 헬퍼 추출, 자산 유형 카드 내부 구성원별 좌/우 분할
- `frontend/src/types.ts` — `AccountBalance`에 `member_id`/`member_name` 동기화

## 주요 결정

- **필터 조건을 한 곳에서 정의**: Q1이 "현재 필터"이므로 목록 조회와 일괄 삭제의 조건이 어긋나면 "화면에 보이는 것만 지운다"는 계약이 즉시 깨진다. `_filter_conditions()`로 추출해 `list_transactions`와 `delete_transactions_by_month`가 같은 함수를 쓰게 했다. 목록 조회는 `.where(*conditions)`로 재작성했으나 동작은 동일하다.
- **`month`를 쿼리 필수 파라미터로**: 미지정 시 전체 삭제가 되는 사고를 API 계층에서 원천 차단(422). 프론트 버튼 비활성(AC-6)은 2차 방어이고, store `removeMonth()`도 월이 없으면 호출 전에 throw한다 — 3중 방어.
- **삭제를 단일 쿼리로 처리**: `major` 필터가 `category.has(...)` 상관 서브쿼리(EXISTS)지만 SQLAlchemy 2 + PostgreSQL은 이를 `delete().where(*conditions)` 한 문장에 그대로 실을 수 있다. 초기 구현은 `select id` → `delete where id IN`의 2단계였으나, 두 쿼리 사이 TOCTOU 구간과 bind 파라미터 상한 문제가 있어 단일 쿼리로 단순화했다. `major` 필터 삭제가 정상 동작함을 검증했다(아래 검증 결과).
- **성공 메시지에 `pageError`를 재사용하지 않음**: `pageError`는 `text-destructive`(빨강)로 렌더된다. 삭제 성공을 빨간 글씨로 띄우는 것은 오해를 부르므로 `pageNotice` 상태를 별도로 두었다. research.md의 AC-8은 실패 경로만 `pageError`를 요구한다.
- **업로드 다이얼로그는 국소 수정(Q2)**: `ui/dialog.tsx` 전역 수정 대신 해당 `DialogContent`에만 `max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]`를 적용하고 본문을 `ScrollArea`로 감쌌다. 요청이 업로드 모달만 지목했고, 전역 수정은 다이얼로그 9곳 전부가 회귀 대상이 되기 때문. → AC-16은 "해당 없음".
- **내부 ScrollArea 2개를 제거**: 본문 전체가 스크롤되므로 건너뜀 목록(`max-h-40`)과 이체 검토 목록(`max-h-[50vh]`)의 ScrollArea를 남겨두면 중첩 스크롤이 되어 휠 이벤트가 갇힌다. 바깥 단일 스크롤로 통일했다(건너뜀 목록의 테두리 박스는 유지). research.md Action Item "이중 스크롤바 방지"에 해당.
- **구성원 목록을 응답에서 도출**: `AccountBalance`에 이미 `member_id`/`member_name`이 실리므로 masterData store를 새로 끌어오지 않고 계정에서 구성원을 추출했다. 의존성이 늘지 않고, 이름 하드코딩도 없다(AC-19). `member_id` 오름차순 정렬이라 시드 순서상 **좌측 으니(id=1) / 우측 영이(id=2)** 가 자연히 성립한다.
- **분할 레이아웃은 `sm:grid-cols-2`**: Q6이 2명 고정이므로 좌/우 2열이 맞다. 다만 375px에서는 `grid-cols-1`로 세로 적층된다(CLAUDE.md 모바일 제약). 계정 카드 그리드는 분할 시 폭이 절반이라 `grid-cols-1 xl:grid-cols-2`로 두어 xl 이상에서만 2열로 늘린다(분할하지 않을 때는 기존 `md:grid-cols-2 xl:grid-cols-3` 유지).
- **한쪽만 계정이 있는 유형은 "계정 없음"을 표시**: 빈 열을 렌더링하지 않으면 좌/우 정렬이 무너져 어느 쪽이 누구인지 읽기 어렵다(AC-21).
- **`splitMembers.length > 1`일 때만 분할**: 구성원을 선택한 경우 `memberId !== null`이라 빈 배열이 되어 기존 표시가 그대로 유지된다(AC-20).

## 자체 검증 결과

- 실행: `cd frontend && npm run build` (tsc + vite) → **통과** (초기 JSX 구조 오류 11건은 수정 후 재실행하여 해소)
- 실행: `cd frontend && npm run lint` → **에러 0, 경고 2**. 두 경고(`TransactionsPage.tsx` 의 `react-hooks/exhaustive-deps`, `react-hooks/incompatible-library`)는 이번에 건드리지 않은 TanStack Table 영역이며, `git stash` 후 변경 전 상태에서도 동일하게 2건 발생함을 실제 확인함
- 실행: `docker compose up -d --build db backend` → 기동 성공. 아래 API 검증은 실제 기동된 백엔드 대상
- OpenAPI 확인: `/api/v1/transactions`에 `delete` 등록, `month` required=True, 응답 `BulkDeleteResult`, `AccountBalance.required`에 `member_id`/`member_name` 포함
- 입력 검증: `DELETE ?month=2026-13` → **422**, `DELETE` (month 누락) → **422**
- 빈 월 삭제: `DELETE ?month=2019-03` → `{"deleted_count":0}` (500 아님)
- 경계/필터 시나리오 (5/31, 6/01, 6/15, 6/30, 7/01 생성):
  - 삭제 전 05/06/07 = `1 / 3 / 1`
  - `?month=2019-06&kind=income` → `deleted_count=1`, 이후 `1 / 2 / 1` (**필터 적용분만 삭제됨 = Q1 계약**)
  - `?month=2019-06` → `deleted_count=2`, 이후 `1 / 0 / 1` (**인접 월 보존**)
- `major` 필터 삭제 (EXISTS 우회 경로): 결혼 2건 + 교통 1건 중 `major=결혼` 삭제 → `deleted_count=2`, 잔여 `['교통 > 철도']`
- 자산 응답: `[('우리집 통장', 1, '으니'), ('현금 지갑', 1, '으니'), ('Trip to 로카', 1, '으니'), ('ALL 우리카드 Infinite', 1, '으니')]` — 구성원 필드 정상
- 검증용으로 생성한 거래는 모두 삭제해 원상복구함
- **브라우저 E2E(UI 렌더링·375px 모바일·Select 상호작용)는 `/qa` 위임** — 구현 단계에서는 코드 근거 + 빌드/린트 + API 레벨까지만 검증

## 성공 기준 자가 체크

- [x] AC-1: `DELETE /api/v1/transactions` 등록, `month`에 `YEAR_MONTH_PATTERN` 적용 — OpenAPI 확인 + `2026-13` 요청 422
- [x] AC-2: 경계 시나리오에서 6월만 삭제되고 5월/7월 각 1건 보존 확인
- [x] AC-3: `BulkDeleteResult.deleted_count` 반환, `removeMonth()`가 이를 반환해 `pageNotice`로 "N건을 삭제했어요" 표시
- [x] AC-4: 빈 월 요청 시 `{"deleted_count":0}` 정상 응답
- [x] AC-5: `bulkDeleteOpen` 확인 다이얼로그. 문구에 `{filters.month}` 와 `{items.length}건` 명시, 버튼 라벨도 `N건 삭제`. 취소 시 아무 호출 없음
- [x] AC-6: 버튼 `disabled={!filters.month || items.length === 0}` + store `removeMonth()`가 월 없으면 throw + API `month` required(422) — 3중 방어
- [x] AC-7: `removeMonth()` 내부에서 `await get().fetch()` 호출
- [x] AC-8: `confirmBulkDelete`의 catch에서 `setPageError((e as Error).message)` → 기존 `text-destructive` 렌더 경로
- [ ] AC-9 (모바일): 툴바가 `flex-wrap`이라 375px에서 줄바꿈되도록 작성했으나 **브라우저 확인은 /qa 위임**
- [x] AC-10: `DialogContent`에 `max-h-[calc(100dvh-2rem)]` + `grid-rows-[auto_minmax(0,1fr)_auto]` 적용 — 뷰포트 초과 불가 (렌더 확인은 /qa)
- [x] AC-11: 본문을 `<ScrollArea className="min-h-0">`로 감쌈 (native overflow 아님)
- [x] AC-12: `ScrollArea`가 `DialogHeader`와 `DialogFooter` **사이**에만 위치 — 두 요소는 grid의 `auto` 트랙으로 고정
- [x] AC-13: 3분기(`importResult` / `importPreview` / 입력폼) 모두 ScrollArea 내부에 그대로 보존, 빌드 통과
- [ ] AC-14: 중첩 스크롤을 제거해 Radix Popper 충돌 요인을 줄였으나, **Select 실제 개폐는 /qa 위임**
- [ ] AC-15 (모바일): 코드상 고정 px 폭 미사용, **브라우저 확인은 /qa 위임**
- [x] AC-16: `ui/dialog.tsx` 미수정 — **해당 없음** (국소 수정 선택, Q2)
- [x] AC-17: `/analytics/assets` 응답에 `member_id`/`member_name` 포함 — 실제 응답으로 확인
- [x] AC-18: `splitMembers.length > 1`일 때 유형 카드 내부에서 구성원별 분할 + 이름/소계 헤더 렌더 (육안 확인은 /qa)
- [x] AC-19: 구성원을 `assets.accounts`에서 도출, 이름 하드코딩 없음. 열 수는 `sm:grid-cols-2` 고정이라 3번째 구성원부터는 둘째 행으로 줄바꿈된다(레이아웃은 깨지지 않음). Q6이 2명 고정이므로 현 상태 유지
- [x] AC-20: `memberId !== null`이면 `splitMembers`가 빈 배열 → 기존 그리드 유지
- [x] AC-21: 계정 없는 구성원 열에 "계정 없음" 표시로 좌/우 정렬 유지
- [x] AC-22: 유형 소계(`subtotal`)와 총자산 계산 로직 미변경 — 표시 구조만 변경. 구성원별 소계는 별도 계산으로 추가만 됨
- [x] AC-23: 목표 카드는 `grand_total`을 그대로 사용, 이번 변경에서 미수정
- [ ] AC-24 (모바일): `grid-cols-1 sm:grid-cols-2`로 375px 세로 적층되게 작성, **브라우저 확인은 /qa 위임**
- [x] AC-25: `npm run build` 통과

## 보류/미완 항목

- **브라우저 E2E 검증 (AC-9, AC-14, AC-15, AC-24)** — `/implement` 단계의 역할이 아니므로 `/qa`에 위임. 검증 편의를 위해 `db`/`backend` 컨테이너는 기동 상태로 남겨두었다 (`docker compose up -d frontend`로 프론트만 추가 기동하면 됨).
- **백엔드 자동화 테스트 없음** — 레포에 테스트 하네스가 없어(research.md Q7) API 직접 호출로 검증했다. 테스트 하네스 신설은 이번 범위 밖.
- **`pageNotice` 지속 시간** — 삭제 성공 안내는 조회 필터(월·구분·대분류·소분류·구성원)가 바뀌면 effect로 초기화된다. 다만 시간 기반 자동 소멸은 없어 같은 필터를 유지하는 동안에는 계속 표시된다. 오류가 아닌 안내라 영향은 경미하다고 판단해 타이머/토스트 도입은 하지 않았다.
