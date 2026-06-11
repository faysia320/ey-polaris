# Research: 이전 사이클 QA Low 이슈 3건 후속 개선

- 날짜: 2026-06-11
- 요청 원문: 이전 개발 사이클의 미해결 항목을 진행하자

## 요약

직전 사이클(`docs/tasks/2026-06-11-assets-goals-calendar/`)의 2차 QA는 PASS였으나 Low 이슈 3건이 후속 개선으로 남았다(`docs/tasks/2026-06-11-assets-goals-calendar/qa-report.md:40-48`). (1) 평가액 입력이 빈 문자열이면 `Number('') === 0`이라 0원 평가액이 기록되어 계정 잔액이 0원으로 표시되는 함정, (2) 평가액 이력 조회·개별 삭제 UI 부재로 계정을 평가액 기반에서 거래 기반으로 UI만으로 되돌릴 수 없음, (3) 캘린더 일자별 합계가 상단 구분/카테고리 필터의 영향을 받는데 이를 알리는 안내가 없음. 세 건 모두 **프론트엔드만 변경**하면 된다 — 이력 조회(`GET`)·개별 삭제(`DELETE`) API는 이미 존재하고(`backend/app/routers/valuations.py:12-19,45-52`), 모든 평가액 삭제 시 거래 기반 잔액으로 복귀하는 로직도 백엔드에 이미 구현되어 있다(`backend/app/routers/analytics.py`의 "이력 없으면 개설잔액+거래합산" 분기). 캘린더 건은 QA 권고대로 동작은 유지하고 안내 문구만 추가한다.

참고: 1차 research의 미해결 질문이었던 "특정 계정 묶음 기준 목표"는 결함이 아닌 기능 확장 아이디어이므로 이번 범위에서 제외한다.

## 관련 파일 및 근거

### 이슈 1 — 빈 평가액 입력 시 0원 기록
- `frontend/src/pages/AssetsPage.tsx:102-106` — `submitValuation`이 `Number(valuationValue)`로 변환 후 `value < 0`만 거부. 빈 문자열은 `Number('') === 0`으로 통과한다. 날짜(103행)와 달리 금액에는 빈값 가드가 없음.
- `backend/app/schemas.py` `ValuationUpsert.value: Field(ge=0)` — 서버는 0원을 유효값으로 허용(의도된 동작: 명시적 0원 평가는 가능해야 함). 따라서 수정은 프론트 빈값 가드로 한정하고 0 입력 자체는 계속 허용한다.

### 이슈 2 — 평가액 이력/개별 삭제 UI 부재
- `backend/app/routers/valuations.py:12-19` — `GET /accounts/{id}/valuations`: 날짜 내림차순 이력 반환 (이미 존재).
- `backend/app/routers/valuations.py:45-52` — `DELETE /accounts/{id}/valuations/{valuation_id}`: 개별 삭제, 타 계정 id는 404 (이미 존재).
- `frontend/src/pages/AssetsPage.tsx:289-331` — 평가액 갱신 다이얼로그. 현재 기록(upsert)만 가능하고 이력 표시·삭제 진입점이 없음. 이력 UI가 들어갈 자연스러운 위치.
- `frontend/src/types.ts` — `Valuation` 타입이 이미 정의되어 있음 (1차 사이클에서 추가).
- `frontend/src/pages/AssetsPage.tsx:93-98` — `openValuation`이 다이얼로그 상태를 초기화하는 지점. 이력 조회 트리거를 여기에 연결 가능.
- `backend/app/routers/analytics.py:117-135` — 평가액 이력이 없는 계정은 `opening_balance + 거래합산`으로 잔액 계산. 즉 **모든 평가액을 삭제하면 추가 백엔드 변경 없이 거래 기반으로 복귀**한다.

### 이슈 3 — 캘린더 합계의 필터 영향 안내
- `frontend/src/components/transactions/TransactionCalendar.tsx:29-38` — `totalsByDate`가 전달받은 `transactions`를 그대로 집계.
- `frontend/src/pages/TransactionsPage.tsx:305-347` — 구분(kind)/카테고리 필터 UI. 필터는 스토어 `filters`를 통해 서버 조회에 반영되므로(`frontend/src/stores/transactions.ts:13-20`) 캘린더가 받는 `items`도 필터링된 결과.
- `frontend/src/pages/TransactionsPage.tsx:413-423` — 캘린더 뷰 블록(월 이동 헤더). 안내 문구가 들어갈 위치.
- 1차 implementation.md에 "캘린더 뷰에서도 구분/카테고리 필터가 합계에 반영됨"이 의도된 동작으로 기재됨 — QA 권고도 동작 변경이 아니라 안내 추가(`qa-report.md:48`).

## 영향도

- `frontend/src/pages/AssetsPage.tsx` — 평가액 다이얼로그 확장. 기존 upsert 기록 흐름(AC-2/3/6 검증 완료분)을 깨지 않아야 함. 삭제 후 `fetchAssets()` 재조회로 잔액·총자산·추이 갱신 필요 (기존 기록 흐름과 동일 패턴, `AssetsPage.tsx:113`).
- `frontend/src/pages/TransactionsPage.tsx` — 캘린더 블록에 조건부 안내 문구 1개 추가. 테이블 뷰·필터 동작 자체는 불변.
- 백엔드 — 변경 없음 (필요 API 전부 존재함을 라우터 코드로 확인).
- `frontend/src/types.ts`, 스토어 — 기존 `Valuation` 타입 재사용 가능. 신규 스토어 불필요(다이얼로그 로컬 상태로 충분, 구현 재량).

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: 평가액 입력이 빈 문자열(또는 공백)인 채 "기록"을 누르면 다이얼로그에 에러 메시지가 표시되고 API 호출이 발생하지 않는다 — UI에서 빈 칸 제출 + 네트워크 탭(또는 서버 로그)으로 확인.
- [ ] AC-2: 명시적으로 `0`을 입력한 평가액 기록은 여전히 허용된다(기존 동작 보존) — 0 입력 제출 시 200 및 잔액 0원 반영 확인.
- [ ] AC-3: 평가액 갱신 진입점에서 해당 계정의 평가 이력(기준일·금액)을 볼 수 있다 — 평가액 2건 이상 기록 후 이력이 날짜 내림차순으로 표시됨을 확인.
- [ ] AC-4: 이력의 개별 항목을 UI에서 삭제할 수 있고, 삭제 후 잔액·총자산이 갱신된다 — 최신 평가액 삭제 시 직전 평가액 기준으로 카드 잔액이 바뀜을 확인.
- [ ] AC-5: 모든 평가액을 삭제하면 계정 잔액이 거래 기반(개설잔액+거래합산)으로 복귀하고 "평가 기준일" 표기가 사라진다 — 전부 삭제 후 UI와 `/analytics/assets` 응답(`valued_at: null`)으로 확인.
- [ ] AC-6: 캘린더 뷰에서 구분 또는 카테고리 필터가 활성일 때 합계가 필터 적용 결과임을 알리는 안내가 표시되고, 두 필터 모두 "전체"면 표시되지 않는다 — 필터를 토글하며 확인.
- [ ] AC-7: 기존 기능 회귀 없음 — 평가액 upsert 기록 흐름, 캘린더 일자별 합계·날짜 선택, 테이블 뷰가 변경 후에도 동일 동작.
- [ ] AC-8: `npm run build`와 `npm run lint`(frontend)가 통과한다.

## Action Items

- [ ] `AssetsPage.tsx` `submitValuation`에 빈 금액 가드 추가 (`Number` 변환 전에 빈/공백 문자열 거부).
- [ ] 평가액 이력 UI: 평가액 갱신 다이얼로그 안에 해당 계정의 이력 목록(기준일·금액·삭제 버튼)을 표시. 다이얼로그 열 때 `GET /accounts/{id}/valuations` 조회, 삭제 시 `DELETE` 후 이력·자산 재조회. 표시 개수(전체 vs 최근 N건)와 레이아웃은 구현 재량. 이력 조회/삭제 실패는 다이얼로그 내 에러로 표시(페이지 전역 에러로 흘리지 않기 — 1차 Medium-2와 동일 원칙).
- [ ] `TransactionsPage.tsx` 캘린더 블록에 구분/카테고리 필터 활성 시 안내 문구 추가 (예: 적용 중인 필터를 명시하는 한 줄). 문구·스타일은 구현 재량.
- [ ] 백엔드 변경 없음 — 추가 작업 금지 (필요 API 존재 확인 완료).

## 미해결 질문

- 없음 — 세 건 모두 QA 보고서의 권고 방향이 명확하고(빈값 가드 / 이력·삭제 UI / 안내 문구), 사용자 결정이 필요한 분기는 구현 재량으로 위임했다.
