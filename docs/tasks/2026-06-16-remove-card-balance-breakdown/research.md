# Research: 자산 카드의 '잔액 구성'(usage_breakdown) 분해 제거

- 날짜: 2026-06-16
- 요청 원문: 자산에서 카드의 잔액 구성을 다시 수정해줘. 카드 잔액은 현 시점까지의 누적액이니까 잔액 구성을 궂이 알 필요는 없어보여. 게다가 맞지도 않고. 예를들어 잔액 구성의 간편결제 내역들은 차감없이 마이너스 누적만 가능해 지금 상태로는. 왜냐면 카드값 이체는 직접 사용 계정으로 이루어지지 간편결제로는 안이루어지니까. 잔액 구성을 제거해줘

## 요약

직전 작업(`docs/tasks/2026-06-16-easy-pay-account-linking`)에서 연결 카드/은행 카드 안에 '잔액 구성'(개설 잔액 + 직접 사용 + 간편결제 채널별 + 입금·이체) 분해를 추가했다. 그러나 카드값 상환(이체)은 '직접 사용' 계정(연결 카드 자신)으로만 들어오고 간편결제 채널로는 들어오지 않으므로, 간편결제 채널 항목은 **차감 없이 음수 지출만 누적**되어 의미 있는 현재값을 표현하지 못한다. 사용자는 카드 잔액 자체가 현 시점 누적액이라 분해가 불필요하고 오해를 준다고 판단해 **'잔액 구성' 분해 전체 제거**를 요청했다.

해결 방향: 프론트의 분해 렌더 블록과 백엔드의 `usage_breakdown` 산출·스키마 필드·`UsageSource` 모델을 제거한다. **간편결제(easy_pay) 계정 유형·연결(`linked_account_id`)·패스스루 잔액 귀속은 그대로 유지**한다 — 이것들은 카드 잔액에 간편결제 지출을 올바르게 합산하는 핵심이며 제거 대상이 아니다. 제거되는 것은 "분해 표시"뿐이다.

## 관련 파일 및 근거

- `backend/app/routers/analytics.py:181-201` — 연결 카드/은행에 대한 `breakdown` 구성 블록(개설 잔액/직접 사용/채널별/입금·이체). 제거 대상.
- `backend/app/routers/analytics.py:202-208` — `schemas.AccountBalance(..., usage_breakdown=breakdown)` 생성 — `usage_breakdown` 인자 제거 대상.
- `backend/app/routers/analytics.py:143-147` — `easy_by_target` 맵. 분해 전용이므로 제거 대상.
- `backend/app/routers/analytics.py:115-141` — `signed_by_account`·`bridge_by_account` 원본 맵은 분해를 위해 도입됐으나 현재 `net_by_account`(135-141) 계산이 이 맵들에 의존한다. `net_by_account`는 패스스루 잔액에 필수이므로 **계산 결과는 유지**해야 한다. 분해 제거 후 이 블록을 원래의 간결한 형태로 되돌릴지(구현 재량)는 Action Items 참조.
- `backend/app/schemas.py` — `UsageSource` 모델과 `AccountBalance.usage_breakdown` 필드(직전 작업에서 추가). 제거 대상. (`AccountBalance`의 나머지 필드 `id/name/type/is_active/balance/valued_at`는 유지)
- `frontend/src/types.ts:102-117` — `UsageSource` 인터페이스와 `AccountBalance.usage_breakdown` 필드. 제거 대상.
- `frontend/src/pages/AssetsPage.tsx` — `a.usage_breakdown.length > 0 && (...)` 분해 렌더 블록('잔액 구성' 헤더 + 항목 리스트). 제거 대상. (계정 카드의 잔액·평가 기준일·평가액 갱신 버튼 등 나머지 표시는 유지)

## 영향도

- `backend/app/routers/analytics.py`의 `GET /analytics/assets` 응답에서 `usage_breakdown` 키가 사라진다. 잔액(`balance`)·`total`·`grand_total`·`trend` 계산은 `net_by_account` 기반으로 **변경 없음** — 패스스루 동작 유지.
- `frontend`에서 `usage_breakdown`을 참조하는 곳은 `AssetsPage.tsx` 한 곳뿐(grep 확인). 타입 필드 제거 시 다른 컴파일 오류 없음.
- 직전 작업의 산출 문서(`docs/tasks/2026-06-16-easy-pay-account-linking/*`, `docs/history/2026-06-16-easy-pay-account-linking.md`)는 과거 기록이므로 **수정하지 않는다**(이력 보존). 본 작업의 변경은 새 task 폴더에 기록.
- easy_pay 계정 유형·연결·설정 UI(`SettingsPage.tsx`)·검증(`accounts.py`)·마이그레이션(`0008`)은 **영향 없음**(유지).
- 기존 데이터/마이그레이션 영향 없음 — 스키마 컬럼 변경이 아니라 응답 필드(파생값) 제거.

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: `GET /analytics/assets` 응답의 각 계정 객체에 `usage_breakdown` 키가 더 이상 존재하지 않는다 — 실행 중 백엔드에서 `/analytics/assets` 응답 JSON을 확인(키 부재).
- [ ] AC-2: `UsageSource` 모델/인터페이스 정의가 백엔드(`schemas.py`)·프론트(`types.ts`) 양쪽에서 제거된다 — 두 파일 grep으로 `UsageSource` 미존재 확인.
- [ ] AC-3: 자산 상태(Assets) 페이지의 카드/은행 항목에서 '잔액 구성' 분해 영역이 더 이상 렌더되지 않는다 — **/qa 단계에서** 브라우저로 연결 카드(간편결제 연결된 카드)를 열어 분해 라인이 없음을 확인. 상단 카드 잔액 숫자는 그대로 표시된다.
- [ ] AC-4: 간편결제 패스스루는 유지된다 — 간편결제 계정의 지출이 여전히 연결 카드 잔액에 반영되고 간편결제 계정 잔액은 변하지 않는다(분해만 사라지고 잔액 의미는 불변). **/qa 단계에서** 직전 작업의 패스스루 시나리오로 잔액 확인.
- [ ] AC-5: `cd frontend && npm run build`와 `npm run lint`가 통과하고, 백엔드는 import/구문 오류가 없다 — 명령 실행 결과로 확인.
- [ ] AC-6 (모바일): 분해 영역 제거 후 자산 상태 페이지가 375px 뷰포트에서 가로 스크롤·요소 겹침·잘림 없이 렌더된다 — **/qa 단계에서** 브라우저 도구로 확인. (단순 영역 제거이므로 회귀 위험은 낮음)

## Action Items

- [ ] `frontend/src/pages/AssetsPage.tsx`: `usage_breakdown` 분해 렌더 블록('잔액 구성' 헤더 포함) 제거.
- [ ] `frontend/src/types.ts`: `UsageSource` 인터페이스와 `AccountBalance.usage_breakdown` 필드 제거.
- [ ] `backend/app/schemas.py`: `UsageSource` 모델과 `AccountBalance.usage_breakdown` 필드 제거.
- [ ] `backend/app/routers/analytics.py`: `breakdown` 구성 블록·`usage_breakdown=` 인자·`easy_by_target` 맵 제거. `net_by_account` 계산(패스스루)은 유지하되, `signed_by_account`/`bridge_by_account` 중간 맵을 원래의 간결한 형태로 되돌릴지는 구현 재량(동작 동일 보장이 조건).
- [ ] 자체 검증: build/lint 실행. 백엔드는 의존성 미설치 환경이면 `py_compile`로 구문 확인(런타임/E2E는 /qa 위임).

## 미해결 질문

- 없음. (직전 작업에서 도입한 "카드 직접 사용 vs 간편결제 구분 표시"는 사용자 요청에 따라 **의도적으로 제거**되며, 이후 자산 페이지에서 결제수단 구분 시각화는 제공되지 않는다 — 기록용으로 명시. 간편결제 연결·패스스루 집계 자체는 유지됨.)
