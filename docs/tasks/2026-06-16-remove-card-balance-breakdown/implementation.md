# Implementation: 자산 카드의 '잔액 구성'(usage_breakdown) 분해 제거

- 날짜: 2026-06-16
- 기반 명세: docs/tasks/2026-06-16-remove-card-balance-breakdown/research.md

## 변경 파일
- `backend/app/routers/analytics.py` — `usage_breakdown` 분해 산출 블록·`easy_by_target` 맵 제거. 분해용으로 도입했던 `signed_by_account`/`bridge_by_account` 중간 맵을 없애고 `net_by_account`(패스스루)를 원래의 간결한 라우팅 형태로 복원. `AccountBalance` 생성에서 `usage_breakdown=` 인자 제거.
- `backend/app/schemas.py` — `UsageSource` 모델과 `AccountBalance.usage_breakdown` 필드 제거.
- `frontend/src/types.ts` — `UsageSource` 인터페이스와 `AccountBalance.usage_breakdown` 필드 제거.
- `frontend/src/pages/AssetsPage.tsx` — 계정 카드 내 '잔액 구성' 분해 렌더 블록 제거.

## 주요 결정
- **패스스루 유지**: easy_pay 거래를 연결 계정으로 귀속하는 `_route()`·`net_by_account` 로직은 그대로 두었다. 제거 대상은 "분해 표시"뿐이며 잔액 계산 의미는 불변(AC-4).
- **중간 맵 복원(구현 재량)**: research가 허용한 대로, 분해 전용으로 추가했던 `signed_by_account`/`bridge_by_account`를 제거하고 `net_by_account`를 분해 도입 이전의 2-블록 형태(직접 부호합 + 이체 입금 다리, 각각 `_route` 적용)로 되돌렸다. 동작은 동일하며 코드가 더 간결하다.
- **easy_pay 유형·연결·설정 UI·검증·마이그레이션은 미변경**: 요청 범위가 분해 제거에 한정되므로 건드리지 않았다.
- **직전 작업 문서 미수정**: `docs/tasks/2026-06-16-easy-pay-account-linking/*`·`docs/history/*`는 과거 이력으로 보존.

## 자체 검증 결과
- `cd frontend && npm run build` (tsc + vite) → **통과** (기존 chunk-size 경고만). types.ts 필드 제거 후에도 AssetsPage 컴파일 정상 = 잔존 참조 없음.
- `cd frontend && npm run lint` → **통과** (0 errors; `TransactionsPage.tsx` 사전 경고 2건은 무관).
- `python -m py_compile app/schemas.py app/routers/analytics.py` → **통과**.
- `grep usage_breakdown|UsageSource` (docs 제외) → **0건** (코드에서 완전 제거 확인).
- 백엔드 런타임 `/analytics/assets` 응답 키 부재 실측·브라우저 렌더·375px 모바일은 **/qa 위임**.

## 성공 기준 자가 체크
- [x] AC-1: `AccountBalance`에서 `usage_breakdown` 필드 제거 → 응답에 키 없음. (런타임 실측 /qa)
- [x] AC-2: `UsageSource`가 schemas.py·types.ts 양쪽에서 제거됨 (grep 0건).
- [x] AC-3: AssetsPage 분해 렌더 블록 제거. 잔액 숫자·평가 표시는 유지. (브라우저 확인 /qa)
- [x] AC-4: `_route`/`net_by_account` 패스스루 로직 유지 — 잔액 의미 불변.
- [x] AC-5: build·lint 통과, 백엔드 py_compile 통과.
- [x] AC-6(모바일): 단순 영역 제거로 회귀 위험 낮음 — 잔여 레이아웃은 기존 반응형 그대로. (375px 실측 /qa)

## QA 후속 수정 (2026-06-16)
- QA Low 이슈 반영: `AssetsPage.tsx`의 `HIDDEN_GROUP_TYPES` 주석이 제거된 "'직접/간편결제 사용' 분해"를 여전히 설명하던 사실 불일치를 정리(패스스루 귀속 설명만 유지). 주석 1줄 변경으로 동작 영향 없음. `npm run lint` 재실행 통과(0 errors).

## 보류/미완 항목
- 없음.
