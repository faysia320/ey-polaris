# Research: 자산 계정 유형 추가 — 전자금융자산 · 대출 · 보증금

- 날짜: 2026-07-23
- 요청 원문: 자산계정에 전자금융자산 항목이 필요해. 네이버페이나 온라인상품권 등이 그 계정이야. 그리고 은행 대출 계정도 필요해. 또 이건 질문인데 내가 전세를 살고있는데 전세 보증금은 어떤 계정으로 잡아놔야해?

## 요약
계정 유형은 DB Enum/CHECK 제약 없이 `String(20)` 문자열 컬럼으로 저장되며(`models.py:43`), 유형 값은 백엔드 Pydantic `Literal`과 프론트 `AccountType` 유니온, 그리고 라벨 맵 몇 곳에만 하드코딩되어 있다. 따라서 **새 유형 추가에 Alembic 마이그레이션이 필요 없고**(마이그레이션 0008이 `easy_pay` 추가 시 "type은 String(20) 그대로이며 값만 새로 허용 — 스키마 변경 없음"이라 명시, `0008_easy_pay_linked_account.py:6`), 유형 목록·라벨이 정의된 5개 지점만 일관되게 수정하면 된다.

세 항목의 성격이 서로 다르다: (1) **전자금융자산**(네이버페이·온라인상품권)은 자체 잔액을 보유하는 선불 충전형 자산으로, 잔액이 연결 계정으로 패스스루되어 0으로 수렴하는 `easy_pay`(간편결제)와는 동작이 다르므로 별도 유형이 필요하다. (2) **대출**은 부채이며, `opening_balance`에 하한 제약이 없고(`schemas.py:34`) 총자산은 전 계정 잔액 단순 합산(`analytics.py:232`)이고 `formatKRW`가 음수를 정상 출력하므로, 잔액을 음수로 두면 총자산이 자동으로 순자산(자산−부채)이 된다. (3) **전세 보증금**은 시세 변동 없이 계약 종료 시 돌려받는 고정 금액 자산으로, 평가액(valuation) 입력 방식인 `real_estate`와 성격이 달라 전용 유형으로 둔다.

세 유형 모두 `cash`/`bank`처럼 "잔액 = 개설잔액 + 거래 순증감"으로 계산되는 단순 잔액 유형이며, 평가액(`VALUATION_TYPES`)·연결 계정(`easy_pay`)·그룹 숨김(`HIDDEN_GROUP_TYPES`) 대상이 아니다.

## 관련 파일 및 근거
- `backend/app/models.py:42-43` — `Account.type` 컬럼 정의 및 허용 값 목록 주석(`bank | cash | card | easy_pay | investment | stock | real_estate | other`). DB는 `String(20)`이라 값 제약 없음.
- `backend/app/schemas.py:26-28` — `AccountType = Literal[...]`. 새 유형 값을 추가할 1차 지점(생성/수정 페이로드 검증).
- `backend/app/schemas.py:34` — `opening_balance: int = 0` (하한 제약 없음 → 음수 개설잔액 허용, 대출 모델링의 근거).
- `backend/app/routers/accounts.py:11-28` — 라우터 검증은 `easy_pay`의 연결 계정 정합성만 다룸. 그 외 유형은 추가 화이트리스트 없이 통과 → 새 유형은 별도 라우터 변경 불필요.
- `backend/app/routers/analytics.py:215-232` — 잔액 계산: 평가액 이력이 있으면 최신 평가액, 없으면 `opening_balance + net`. `grand_total = sum(모든 계정 잔액)` → 음수 잔액(대출)이 자동으로 차감됨.
- `frontend/src/types.ts:1-9` — 프론트 `AccountType` 유니온. 백엔드 Literal과 동기화 필요.
- `frontend/src/pages/SettingsPage.tsx:37-46` — `ACCOUNT_TYPES` 배열(계정 생성/수정 폼의 유형 드롭다운 옵션·라벨).
- `frontend/src/pages/SettingsPage.tsx:49` — `LINKABLE_TYPES = ['card','bank']` (easy_pay 연결 대상). 새 유형은 여기 포함하지 않음.
- `frontend/src/pages/AssetsPage.tsx:31-40` — `ACCOUNT_TYPE_LABEL` 맵. 자산 페이지 그룹 카드 라벨·**그룹 표시 순서**(`Object.keys` 순회, `AssetsPage.tsx:472`)를 결정.
- `frontend/src/pages/AssetsPage.tsx:44,47` — `HIDDEN_GROUP_TYPES=['easy_pay']`, `VALUATION_TYPES=['stock','real_estate']`. 새 유형은 어느 쪽도 아님.
- `frontend/src/lib/format.ts:17-19` — `formatKRW`는 `Intl.NumberFormat('ko-KR')`이라 음수를 "-1,000,000원"으로 정상 출력(대출 음수 잔액 표시 근거).

## 영향도
- **엑셀 import**(`backend/app/excel_import.py:234-243` `guess_account_type`, `250` `VALUATION_ITEM_TYPES`): 자동 계정 생성 휴리스틱은 `card|bank|cash|other`만 추정하고 평가액 매핑은 `real_estate`만 다룬다. 새 유형은 import 경로에서 자동 생성되지 않으며(사용자가 설정 화면에서 수동 생성), import 로직 변경은 **불필요**. 다만 새 유형 값이 기존 `Literal`/유니온과 충돌하지 않는지만 확인하면 됨.
- **자산 페이지 그룹 렌더링**(`AssetsPage.tsx:472-476`): `ACCOUNT_TYPE_LABEL`에 키를 추가하면 해당 유형 계정이 있을 때 자동으로 그룹 카드가 하나 더 생긴다(계정 0개면 미표시). 별도 렌더 코드 변경 없이 동작. 대출 그룹 소계(`subtotal`, `:476`)는 음수로 합산되어 정상.
- **음수 잔액의 부수효과**: 자산 추이 차트(`analytics.py:287-300`)·목표 달성률(`grand_total` 사용)은 모두 합산 기반이라 음수 잔액이 자연스럽게 순자산으로 반영된다. 진척 바 `Math.min(rate,1)`(`AssetsPage.tsx:460`)은 상한만 두므로 음수 총자산이 되어도 표시 오류는 없음(달성률이 음수가 되는 극단은 별도 처리 대상 아님 — 현 스코프 밖).
- 백엔드 Literal과 프론트 유니온이 어긋나면 런타임/타입 오류 → **두 곳을 반드시 동일 값 집합으로 유지**해야 함.

## 성공 기준 (Acceptance Criteria)
- [ ] AC-1: 계정 유형에 전자금융자산·대출·보증금 3종이 추가된다 — 설정 > 자산 계정 생성 폼의 유형 드롭다운(`SettingsPage.tsx` `ACCOUNT_TYPES`)에 3종이 한글 라벨로 노출되고 선택해 저장할 수 있다. 브라우저에서 각 유형으로 계정 1개씩 생성해 목록에 나타나는 것으로 확인(/qa 단계, 브라우저 도구).
- [ ] AC-2: 백엔드가 새 유형 값을 수락한다 — `POST /accounts`에 `type`을 새 3개 값 각각으로 보내면 201로 생성되고, `linked_account_id`는 `null`로 저장된다(easy_pay가 아니므로). OpenAPI 스키마(`/docs`)의 `AccountType`에 3개 값이 포함됨으로 확인.
- [ ] AC-3: 전자금융자산 계정의 잔액이 자체 보유 방식으로 계산된다 — 개설잔액 X로 생성 후 해당 계정에 수입/지출 거래를 넣으면 잔액이 `X ± 거래`로 반영된다(easy_pay처럼 연결 계정으로 빠져나가 0으로 수렴하지 않음). 자산 페이지에서 잔액 확인.
- [ ] AC-4: 대출 계정을 음수 개설잔액으로 생성하면 총자산에서 차감된다 — 예: 대출 계정 개설잔액 -1,000,000으로 생성 시 자산 페이지 총자산(`total`/`grand_total`)이 생성 전 대비 정확히 1,000,000 감소하고, 대출 그룹 카드에 음수 금액("-1,000,000원")이 표시된다. 브라우저에서 확인(/qa 단계).
- [ ] AC-5: 보증금 계정이 고정 잔액 자산으로 동작한다 — 평가액 입력 UI 없이(비-VALUATION_TYPES) 개설잔액 = 보증금액으로 자산에 그대로 가산되고, 자산 페이지에 '보증금' 그룹으로 분리 표시된다.
- [ ] AC-6: 백엔드 Literal(`schemas.py`)과 프론트 유니온(`types.ts`)의 유형 값 집합이 완전히 일치한다 — 두 파일을 비교해 3개 신규 값이 양쪽에 동일 문자열로 존재함을 확인. `frontend`에서 `npm run build`(tsc)가 유형 관련 오류 없이 통과한다.
- [ ] AC-7: 기존 유형(easy_pay 패스스루, stock/real_estate 평가액, HIDDEN_GROUP_TYPES)의 동작이 회귀 없이 유지된다 — 기존 easy_pay 계정이 여전히 그룹에서 숨겨지고 연결 계정으로 귀속되는지, real_estate가 여전히 평가액 입력 대상인지 확인.
- [ ] AC-8 (모바일): 375px 뷰포트에서 설정 폼 유형 드롭다운과 자산 페이지의 신규 그룹 카드(특히 대출 음수 금액 포함)가 가로 스크롤·겹침·잘림 없이 표시된다 — /qa 단계에서 브라우저 도구로 확인.

## Action Items
- [ ] `backend/app/schemas.py:26-28` `AccountType` Literal에 신규 3개 값 추가.
- [ ] `backend/app/models.py:42` 허용 값 목록 주석에 3개 값 반영(문서화).
- [ ] `frontend/src/types.ts:1-9` `AccountType` 유니온에 동일 3개 값 추가.
- [ ] `frontend/src/pages/SettingsPage.tsx:37-46` `ACCOUNT_TYPES`에 `{value, label}` 3개 추가(폼 옵션).
- [ ] `frontend/src/pages/AssetsPage.tsx:31-40` `ACCOUNT_TYPE_LABEL`에 3개 라벨 추가. 그룹 표시 순서를 고려해 위치 선정(구현 재량 — 예: 전자금융자산은 현금/카드 근처, 보증금은 부동산 근처, 대출은 부채 성격이라 맨 끝).
- [ ] 신규 유형은 `LINKABLE_TYPES`·`VALUATION_TYPES`·`HIDDEN_GROUP_TYPES` 어디에도 추가하지 않음(단순 잔액 유형).
- [ ] 프론트 빌드(`npm run build`)로 유형 동기화 검증.

## 결정 사항 및 출처
- [사용자 확인] 전세 보증금을 어떤 계정으로 잡을지 → **전용 유형 '보증금' 신규 추가**. 시세 평가 없이 개설잔액=보증금액으로 총자산에 그대로 가산, 자산 페이지에 별도 그룹 표시(AC-5).
- [사용자 확인] 은행 대출을 총자산에 반영하는 방식 → **음수 잔액으로 총자산에서 자동 차감**(= 순자산 표시). 자산/부채 분리·순자산 별도 섹션 등 추가 개발은 하지 않음(AC-4). 최소 변경으로 유형 추가만 수행.
- [기술 결정] 새 유형의 내부 문자열 값 → 전자금융자산=`e_money`, 대출=`loan`, 보증금=`deposit` (한글 라벨: "전자금융자산", "대출", "보증금"). 근거: 기존 값이 모두 영문 소문자 스네이크(`easy_pay`, `real_estate`)라 컨벤션 일치. 최종 내부 값 문자열은 구현 재량이나, 백엔드 Literal과 프론트 유니온에 **동일 문자열**로 반드시 일치시킬 것.
- [기술 결정] 세 유형 모두 단순 잔액 유형으로 취급(평가액·연결·숨김 대상 아님). 근거: 전자금융자산은 자체 잔액 보유, 대출·보증금은 고정 잔액이며 시세 평가 대상이 아님(`analytics.py:215-221` 잔액 규칙).
- [기술 결정] Alembic 마이그레이션 불필요. 근거: `Account.type`이 `String(20)`이고 DB CHECK/Enum 제약이 없음(`models.py:43`, 마이그레이션 0008 선례).

## 미해결 질문
- 없음.
