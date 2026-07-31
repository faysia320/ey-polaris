# QA Report: 간편결제 연결 계정 — 기준정보 선택화 + 거래별 지정 (재QA, 2회차)

- 날짜: 2026-07-31
- 작업 폴더: `docs/tasks/2026-07-31-easy-pay-per-transaction-link`
- 판정: **PASS**

> 이 보고서는 1회차 QA에서 [Medium] M-1(묶음 행·이체 행에 최종 귀속 계정 미표시)이 보고되고
> `/implement`가 재작업한 뒤의 **독립 재평가**다. 1회차 보고서 내용은 근거로 채택하지 않고
> 14개 AC 전부를 처음부터 다시 실행 검증했다.

## 데이터 영향 (사고 없음)

- 손상·유실 **없음**.
- 검증 데이터는 실데이터가 0건인 **2019-05 / 2019-06**과 `QA2*` 전용 계정에만 만들었다. 파괴적 기능
  실행 전 사전 조회로 `transactions where date < '2020-01-01'` = **0건**임을 확인했다.
- **엑셀 가져오기의 최종 "확정하고 가져오기"는 실행하지 않았다.** 이 기능은 대상 월을
  delete-then-insert로 교체하므로, 매핑 스텝(계정 확정)까지만 진행하고 2단계에서 중단했다.
  대상 월 2019-06의 사전 건수 0건, 사후 건수 **0건**을 확인했다.
- 정리 결과(수치 확인):
  - `accounts where name like 'QA2%'` = **0**
  - `accounts` 총 **25개** (시작과 동일)
  - `transactions` 총 **129건** (시작과 동일), `date < 2020-01-01` = **0**
  - `transactions.linked_account_id is not null` = **0**
  - `transaction_links` = **2건** (기존 그대로)
  - 생성물 전량 삭제: 거래 8건 / 묶음 2건 / 계정 9개 (엑셀 마법사가 만든 `QA2업로드페이` 포함)
- `GET /api/v1/analytics/assets` 응답이 **QA 시작 시점 스냅샷과 완전 동일**함을 재확인
  (`assets_before.json` == `assets_final.json`, Python `dict ==`, 총자산 464,779,136).
- 일회용 마이그레이션 검증 DB `polaris_qa2_mig`는 검증 후 `DROP DATABASE` 완료.

## 성공 기준 채점

- ✅ **AC-1**: `POST /accounts {"type":"easy_pay","linked_account_id":null}` → **201**, 저장값 null.
  필드를 아예 생략해도 **201**. 브라우저 375px 설정 다이얼로그에서 유형=간편결제 +
  `선택 안 함 (거래별 지정)` 상태가 정상 렌더됨을 확인했고, 목록에 `간편결제 → 거래별 지정`으로 표시됨.
- ✅ **AC-2**: `POST /accounts {"type":"card","linked_account_id":<카드id>}` → **422**
  `간편결제 유형이 아닌 계정에는 연결 계정을 설정할 수 없습니다`. 회귀 없음.
- ✅ **AC-3**: 브라우저 실측. 자산 계정 = `QA2페이`(easy_pay) → `연결 계정 (선택)` 필드 노출.
  `QA2나카드`(card)로 바꾸면 라벨 목록에서 **사라짐**. 다시 easy_pay로 되돌리면 값이
  `선택 안 함 (계정 기본 연결)`으로 **초기화**됨. 후보 목록에 비활성 카드(`QA2비활성카드`) 미노출 확인.
  미선택 저장 → 201.
- ✅ **AC-4**: 같은 간편결제 `QA2페이`의 지출 10,000(→QA2가카드)·30,000(→QA2나카드) →
  `/analytics/assets`에서 **가카드 -10,000 / 나카드 -30,000**.
- ✅ **AC-5**: 건별 미지정 지출 5,000은 기본 연결이 없을 때 **QA2페이 -5,000**으로 잔류.
  계정 기본 연결을 가카드로 지정하니 **가카드 -15,000 / QA2페이 0 / 나카드 -30,000(불변)**.
  목록 응답도 미지정 건이 기본 연결명(`QA2가카드`)으로 폴백됨을 확인.
- ✅ **AC-6**: 브라우저 실측 2케이스, 그룹 소계를 화면 텍스트에서 파싱해 합산 대조.
  - easy_pay 잔액 있음(QA2페이 -5,000): `간편결제` 그룹 **노출**, 그룹 소계 합
    **464,729,136 = 상단 총자산**.
  - 전부 0: 그룹 **미노출**(`간편결제`가 그룹 헤더로 등장하지 않음), 소계 합
    **464,729,136 = 총자산** (여전히 일치).
- ✅ **AC-7**: cash 지정 → 422 `연결 계정은 카드 또는 은행 계정이어야 합니다` / 자산 계정이 card인
  거래 → 422 `연결 계정은 간편결제 계정으로 결제한 거래에만 지정할 수 있습니다` / 존재하지 않는 id →
  **404** / 자기 자신(easy_pay) → 422 / 다른 easy_pay → 422 / bank → 201(정상 허용).
  **PUT(수정) 경로에서도 동일하게 422** 확인.
- ✅ **AC-8**: 건별 연결이 달린 거래가 있는 easy_pay → card 변경 시 **422**
  `이 계정으로 결제한 거래 5건에 연결 계정이 지정되어 있어 유형을 바꿀 수 없습니다. 해당 거래의
  연결 계정을 먼저 해제해주세요`. 건별 연결이 없는 easy_pay(`QA2페이2`)는 유형 변경 **200 허용**
  (과잉 차단 아님)도 확인.
- ✅ **AC-9**: 데스크톱 표·모바일 카드(375px)·묶음 보기 모달 **3곳 모두** 실측.
  - 건별 지정: `QA2페이 → QA2나카드`
  - 계정 기본 연결 폴백: `QA2페이 → QA2가카드` (실데이터 예: `네이버페이 간편결제 → ALL 우리카드 Infinite`)
  - 어디에도 미지정: `QA2페이` (계정명만)
  - **(재작업분) 이체 행**: `QA2페이(→QA2가카드) → QA2나카드`
  - **(재작업분) 이체 묶음 행**: `QA2페이(→QA2가카드) → QA2은행`
  - **(재작업분) 환불 묶음 행**: `QA2페이 → QA2나카드`
  - **(재작업분) 묶음 보기 모달**: 지출 다리 `QA2페이 → QA2가카드`, 수입 다리 `QA2은행`
  - API 수준에서 **짝 다리 요약 양방향** 확인: 수입 다리에서 본 `linked_partner.linked_account_name`
    = `QA2나카드`(환불) / `QA2가카드`(이체 묶음), 간편결제가 아닌 다리는 `null`.
    → 1회차 [Medium] M-1 **해소 확인**.
- ✅ **AC-10**: 브라우저 엑셀 업로드 마법사를 **실제 xlsx 픽스처로 끝까지 구동**(매핑 스텝까지).
  매핑 스텝 유형 Select 옵션 **11개 전부** 노출, `간편결제` 포함. 실제로 선택해
  "계정 확정하고 다음" → DB에 `QA2업로드페이 | easy_pay | linked_account_id = NULL` 생성 확인.
  API `POST /transactions/import/accounts {action:"create", type:"easy_pay"}` → **200**.
- ✅ **AC-11**: **실데이터 25개 계정**에 대해 변경 전 라우팅 규칙(계정 기본 연결만 사용)을 SQL로
  독립 재구현해 신규 코드의 `/analytics/assets` 응답과 대조 → **불일치 0건**,
  합계 **464,779,136 = API total**. (`transactions.linked_account_id`가 전부 NULL이라
  `_route(x, None)`이 종전 `_route(x)`와 동치이고, GROUP BY에 추가된 컬럼이 상수 NULL이라
  합계가 나뉘지 않음.) 추이 마지막 달 == 총자산도 4개 상태에서 확인.
- ✅ **AC-12**: 일회용 DB `polaris_qa2_mig`에서 `alembic upgrade head`(0003→0013) →
  `alembic current` **0013 (head)** → `downgrade -1` → **0012** → `upgrade head` → **0013 (head)**
  왕복 무오류.
- ✅ **AC-13**: `docker compose up --build`가 frontend 이미지에서 `npm run build`
  (= `tsc -b && vite build`)를 수행해 **통과**(내가 직접 실행, exit 0).
  `cd frontend && npm run lint` → **0 errors, 2 warnings**. 두 warning은 모두
  `TransactionsPage.tsx`의 기존 `react-hooks/exhaustive-deps`(611행)·
  `react-hooks/incompatible-library`(614행, TanStack Table)로 이번 변경과 무관한 기존 경고다.
- ✅ **AC-14 (모바일 375px)**: 레시피 A(iframe 실측)로 측정. 합격 조건은
  `pageHasHorizontalScroll === false` **그리고** `unclippedOffenders === []`.
  - `/transactions`, `/assets`, `/settings` 기본 화면: 모두 `docScrollWidth 360 / viewport 375`,
    가로 스크롤 없음, offender 0.
  - **거래 추가 다이얼로그(연결 계정 필드 노출 상태)**: 다이얼로그 25~351px(뷰포트 375),
    오버플로 0. 스크린샷으로 `연결 계정 (선택)` Select가 `col-span-2` 전체 폭을 쓰고
    안내 문구가 2줄로 정상 줄바꿈되며 겹침·잘림이 없음을 확인.
  - **설정 계정 수정 다이얼로그(간편결제 + 기본 연결 계정 필드)**: 25~351px, 오버플로 0,
    안내 문구 정상 렌더.
  - **거래 목록 모바일 카드**: 2026-06 실데이터(`네이버페이 간편결제 → ALL 우리카드 Infinite`)와
    2019-05 QA 데이터(`QA2페이(→QA2가카드) → QA2은행` 등 재작업 표기 전부) 양쪽에서 오버플로 0.
  - **자산 상태 간편결제 그룹 카드**(소계 -5,000, 계정 7개): 오버플로 0.

## 검증 시나리오

**실행 환경**: 기동 중이던 스택은 36분 전 이미지로, `GET /openapi.json`의
`TransactionLinkPartner.properties`에 `linked_account_name`이 **없어** 재작업분이 반영돼 있지
않음을 확인 → `docker compose up -d --build` **1회만** 수행해 재기동(빌드 상한 준수). 이후 모든
검증은 이 스택을 재사용했고, 재기동 후 `linked_account_name`이 노출됨을 재확인했다.

1. 사전 상태 조사 — `docker exec ey-polaris-db-1 psql ...`: alembic `0013`, 거래 129건,
   계정 25개, `linked_account_id` non-null 0, 2019년 거래 0건, easy_pay 계정 4개.
2. `curl /api/v1/analytics/assets` 스냅샷(`assets_before.json`) 저장 → 재빌드 후 재조회 →
   **완전 동일** 확인.
3. 독립 백엔드 API 검증 스크립트(스크래치패드 `qa_api.py`, urllib 직접 호출) —
   **49개 검사 중 47 통과, 2 실패**. 실패 2건은 **내 스크립트가 응답 필드명을 `link_partner`로
   잘못 쓴 것**이었고, 실제 필드 `linked_partner`로 재조회해 **양방향 모두 정상**임을 확인
   (아래 원본 응답 발췌). 실제 결함 0건.

   ```
   586 income  7000 | acct: QA2은행  | linked: None      | link: 11 transfer | partner: (585,'expense','QA2페이','QA2가카드')
   585 expense 7000 | acct: QA2페이  | linked: QA2가카드 | link: 11 transfer | partner: (586,'income','QA2은행',None)
   584 income  3000 | acct: QA2가카드| linked: None      | link: 10 refund   | partner: (583,'expense','QA2페이','QA2나카드')
   583 expense 8000 | acct: QA2페이  | linked: QA2나카드 | link: 10 refund   | partner: (584,'income','QA2가카드',None)
   582 transfer 12000| acct: QA2페이 | linked: QA2가카드 | link: None
   ```

4. 마이그레이션 왕복 (AC-12) — 일회용 DB. 검증 후 `DROP DATABASE polaris_qa2_mig`.
5. AC-11 독립 재계산 — 변경 전 라우팅 규칙을 SQL(CTE)로 직접 구현해 실데이터 25개 계정 잔액을
   신규 API 응답과 1:1 대조. 불일치 0.
6. 브라우저(Chrome MCP) — AC-3/6/9/10/14. Radix Select 조작은 실제 마우스 클릭 + pointer 이벤트
   합성을 병행했다.
7. 375px iframe 실측(레시피 A) — 3개 화면 + 2개 다이얼로그 + 2개 목록 상태.
8. 엑셀 업로드 마법사 — openpyxl로 픽스처(`가계부 내역` 시트, `datetime` 날짜, KRW, 결제수단
   `QA2업로드페이`) 생성 후 `file_upload`로 업로드. **최종 가져오기는 실행하지 않음.**
9. 추가 엣지(계약 밖, 각 1회 재현):
   - 비활성 카드를 건별 연결로 지정 → API가 **201로 허용**(프런트는 후보에서 제외) → Q-5.
   - 건별 연결로 참조 중인 카드 삭제 → **409** `거래에서 참조 중인 계정은 삭제할 수 없습니다` (정상).
   - 거래 수정 다이얼로그의 대분류/소분류가 비어 보임 → **실데이터(2026-06) 거래에서도 재현** →
     이번 변경과 무관한 기존 결함으로 판단, 아래 "범위 밖 관찰"에 기록.
10. 정리 — 묶음 2건 해제 → 거래 8건 삭제 → 계정 9개 삭제 → 수치 0 확인 → assets 응답 baseline
    동일 확인.

**교차 확인으로 채택한 항목**: 없음. AC-11·AC-12·AC-13을 포함해 모두 직접 실행했다.

### 검증 중 작업 트리가 변경된 사실 (기록)

QA 도중(17:29경) **다른 작업이 같은 워킹트리를 수정**했다. 보고서 저장 직전 mtime으로 확인한 결과
변경된 파일은 `frontend/src/index.css`, `frontend/vite.config.ts`, `frontend/package-lock.json`
**3개뿐이며 모두 SUIT 폰트 마이그레이션(Q-6) 소속**이다.

이번 계약(research.md)의 대상 파일 11개는 전부 **17:09:44 이전** 상태 그대로였고
(`models.py`·`accounts.py`·`analytics.py`·`0013_*.py`·`SettingsPage.tsx`·`masterData.ts` 16:30,
`AssetsPage.tsx` 17:02, `schemas.py` 17:07, `transactions.py` 17:08, `types.ts` 17:08,
`TransactionsPage.tsx` 17:09), 내 빌드·검증은 모두 그 이후에 수행됐다. 따라서 **위 채점은 전부
현재 계약 파일 상태에 대한 것**이며 영향받지 않는다.

다만 내가 빌드해 브라우저로 검증한 프런트 이미지에는 17:29 이후의 SUIT 폰트 변경이 포함돼 있지
않다. 해당 변경은 이번 계약 밖이므로 어떤 AC에도 영향이 없지만, 그 작업 자체의 검증은
**별도로 수행돼야 한다**.

## 발견 이슈

High 0건, Medium 0건. 아래는 전부 Low.

- **[Low] Q-1** — `frontend/src/pages/SettingsPage.tsx:273` — 계정 **기본** 연결 후보
  `linkableAccounts`는 `is_active`를 보지 않는데, 이번에 추가된 **거래별** 연결 후보
  (`TransactionsPage.tsx:337`)는 `a.is_active && (card|bank)`로 활성만 거른다. 같은 "연결 계정"
  개념의 후보 목록이 두 화면에서 서로 다르다. 백엔드는 둘 다 허용하므로 오동작은 아니다.

- **[Low] Q-2** — `frontend/src/pages/TransactionsPage.tsx:1560-1570` — 건별 연결 대상 카드가
  이후 **비활성화**되면, 그 거래의 수정 다이얼로그에서 `연결 계정 (선택)` Select 트리거가
  **빈 값으로 보인다**(후보가 활성만이라 매칭되는 `SelectItem`이 없음). 저장 시 값은
  `form.linked_account_id`가 그대로 전송돼 **보존**되므로 데이터 손실은 없고, 목록에는
  `계정 → 비활성카드`로 계속 보인다. 자산 계정 Select에도 같은 패턴이 이미 있어 신규 결함은 아니다.

- **[Low] Q-3** — `frontend/src/pages/TransactionsPage.tsx:2148, 2190, 2220` — 묶기(link) **선택**
  다이얼로그(기준 거래 요약·후보 목록·이체 안내 문구)는 여전히 `account_name`만 표시해, 목록·묶음
  보기 모달의 새 표기(`계정 → 결제계정`)와 어긋난다. AC-9의 범위("거래 목록의 '계정' 표시")
  밖이고 집계와 모순되는 표시는 아니다.

- **[Low] Q-4** (1회차 L-1 잔존) — `backend/app/routers/accounts.py:48-71` — `update_account`는
  `easy_pay → 다른 유형` 방향만 막는다. 반대로 **건별 연결 대상으로 참조 중인 카드/은행 계정을
  `cash` 등 비-linkable 유형으로 바꾸는 것은 허용**되어, `_validate_refs`가 생성 시 422로 막는
  조합(`transactions.py:92-95`)이 사후에 성립한다. 기존 `accounts.linked_account_id`에도 같은
  공백이 있어 회귀는 아니고, 라우팅·표시는 그 계정을 계속 일관되게 사용하므로 집계 불일치도 없다.

- **[Low] Q-5** (1회차 L-2 잔존) — `backend/app/routers/transactions.py:83-95` — 건별 연결 검증이
  `is_active`를 보지 않아 **비활성 카드/은행도 API로는 지정된다**(실측 201). 계정 기본 연결
  검증(`accounts._validate_linked_account`)도 동일하게 `is_active`를 보지 않아 일관되기는 하다.
  의도라면 주석 한 줄이 있으면 좋겠다.

- **[Low] Q-6** (1회차 L-4 잔존, 이 작업의 결함 아님 — 기록용) — 작업 트리 오염.
  `frontend/src/index.css`, `frontend/src/components/charts/EChart.tsx`, `frontend/vite.config.ts`,
  `frontend/package.json`, `frontend/package-lock.json`, `docs/tasks/2026-07-31-suit-font-migration/`
  는 **SUIT 폰트 마이그레이션이라는 별개 작업**의 변경이며 이번 계약(research.md)의 관련 파일
  목록에 없다. `/git-commit`에서 커밋 분리가 필요하다. (implementation.md도 이 사실을 기록하고 있다.)

- **[Low] Q-7** — `frontend/src/pages/TransactionsPage.tsx:1183-1186, 1329-1332` — 모바일 카드
  렌더에서 `const disp = bundleDisplay(t)`로 kind/amount/category를 뽑은 뒤, 계정 텍스트는
  `accountText(t)`가 **`bundleDisplay(t)`를 한 번 더 호출**한다(묶음 행 한정 중복 계산).
  결과는 동일하고 렌더당 비용도 무시할 수준이라 동작·성능 영향은 없다.

### 범위 밖 관찰 (이번 변경에 기인하지 않음 — 판정에 반영하지 않음)

- **거래 수정 다이얼로그의 대분류/소분류가 비어 보인다.** `openEdit`이 채우는
  `category_major`가 `''`가 되어 대분류 트리거에 placeholder `선택`이, 소분류에 `대분류 먼저`가
  뜬다. QA 데이터뿐 아니라 **손대지 않은 실데이터(2026-06, 카테고리 `미분류`) 거래에서도 재현**된다.
  이번 diff는 `openEdit`에 `linked_account_id` 한 줄만 추가했을 뿐 `category_major` 로직을
  건드리지 않았으므로 이 작업의 회귀가 아니다. 기존 lint 경고
  (`react-hooks/exhaustive-deps: useMemo has a missing dependency 'openEdit'`,
  `TransactionsPage.tsx:611`)가 가리키는 stale closure가 원인으로 의심된다.
  `category_id`는 정상 세팅되어 저장에는 영향이 없다(수정 저장 시 카테고리 유지).
  → **별도 작업으로 `/research`에 올릴 것을 권한다.**

> 이슈 탐색 과정 기록: 위 항목 외에 다음을 시도했으나 결함을 찾지 못했다 —
> `_route`의 override가 easy_pay가 아닌 계정에 잘못 적용되는지(`account_id in easy_pay_ids`
> 가드로 차단), 잔액 집계와 월별 추이의 라우팅 규칙 불일치(두 쿼리 모두 `linked_account_id`까지
> 그룹핑, `trend[-1] == total`을 4개 상태에서 확인), 이체 입금 다리 이중 계산,
> `list_transactions`의 N+1(짝 다리까지 `account`·`account.linked_account`·`linked_account`
> eager load 추가됨), 계정 삭제 RESTRICT(409 정상), 존재하지 않는 연결 계정(404), 자기 자신
> 지정(422), PUT 경로의 검증 누락 및 값 반영, easy_pay 계정 비활성화 후 폼 판정이 틀어지는지
> (`accounts`는 스토어 원본 전체 목록이라 `formAccountIsEasyPay`가 비활성 계정에도 올바름 →
> 건별 연결이 조용히 지워지는 경로 **없음**), 마이그레이션 downgrade 파괴성 명시(docstring에 있음),
> 엑셀 적재 경로가 `linked_account_id`를 채우는지(채우지 않음 → 기본 연결 폴백, 의도대로).

## QA 중 적용한 수정 (Low 한정)

**없음.**

발견한 Low 7건 모두 "국소적이고 동작을 바꾸지 않는" 수정 범위에 들어가지 않아 손대지 않았다.

- Q-1·Q-2·Q-4·Q-5는 **검증/후보 목록 로직 변경**이라 동작이 바뀐다.
- Q-3은 **표시 내용 변경**이라 동작이 바뀌고, 표기 형식에 사용자 확인이 필요할 수 있다.
- Q-6은 코드가 아니라 커밋 분리 문제다.
- Q-7은 중복 호출 제거가 국소 리팩터링에 해당해 판단이 애매하므로, 규칙대로 수정하지 않고 남긴다.

오타·문서-코드 불일치도 찾지 못했다(implementation.md의 변경 파일 목록·주요 결정·보류 항목이
실제 코드와 일치함을 대조 확인).

## 수정 Action Items (FAIL/CONDITIONAL 시)

해당 없음 (**PASS**). 아래는 강제 사항이 아닌 **선택적 후속 제안**이다.

- [ ] (선택) Q-1/Q-5 — 연결 계정 후보·검증의 `is_active` 취급을 계정 기본 연결과 거래별 연결
      양쪽에서 일치시키거나, 일치시키지 않는 이유를 주석으로 남긴다.
- [ ] (선택) Q-3 — 묶기 선택 다이얼로그에도 `legAccountText`류 표기를 적용할지 결정한다
      (표기 형식은 사용자 확인 필요).
- [ ] (필수, 다른 단계) Q-6 — `/git-commit`에서 SUIT 폰트 마이그레이션 변경을 **별도 커밋으로 분리**한다.
- [ ] (별도 작업) 범위 밖 관찰 — 거래 수정 다이얼로그의 대분류/소분류 미채움을 `/research`로 올린다.

## 다음 단계

`/git-commit` 진행 가능. 단, 커밋 시 **SUIT 폰트 마이그레이션 변경(Q-6)을 분리**해야 한다.
