# Research: 자산 내역 삭제 기능 · 주식 엑셀 제외 및 총합 직접 입력

- 날짜: 2026-07-22
- 요청 원문: 자산 상태에서 자산 내역을 삭제할 수 있는 기능을 추가해줘. 그리고 주식의 경우 Excel 업로드 할 때 제외 해주고, 보유 주식 총합을 직접 입력하는 방식으로 변경해줘

## 요약

자산 페이지(`AssetsPage`)의 "자산 상태"는 계정 카드 그리드(`frontend/src/pages/AssetsPage.tsx:366-421`)와 시세형 계정의 평가액 갱신 다이얼로그(`:432-499`)로 구성된다. 평가액 개별 삭제는 이미 다이얼로그 안에 존재하지만 **확인 절차 없이 즉시 삭제**되고(`:478-484`), **자산 계정 자체를 삭제하는 경로는 자산 페이지에 없다** — 계정 삭제는 설정 페이지에만 있다. 백엔드 `DELETE /accounts/{id}`(`backend/app/routers/accounts.py:57-61`)와 `DELETE /accounts/{id}/valuations/{vid}`(`backend/app/routers/valuations.py:45-52`)는 이미 존재하므로 이번 삭제 기능은 **프론트엔드 UI 작업 중심**이다.

주식 평가액은 현재 뱅크샐러드 엑셀의 "투자성 자산" 행에서 자동 추출되어(`backend/app/excel_import.py:248`) 거래 업로드 시 오늘 날짜로 반영된다(`backend/app/routers/transactions.py:459-490`). 사용자 결정에 따라 **엑셀 파싱에서 주식(`stock`)을 제외하고 부동산만 남기며**, 주식은 개별 종목 계정 대신 **단일 "주식 총합" 계정 하나에 평가액을 직접 입력**하는 방식으로 전환한다. 기존 다수 주식 계정의 통합·정리는 새로 추가하는 자산 페이지 계정 삭제 UI로 사용자가 직접 수행한다(자동 데이터 마이그레이션은 범위 밖).

주의할 계약: 계정 삭제는 거래가 참조 중이면 FK `RESTRICT`로 409가 되고(`backend/app/models.py:100-105` 참조, 메시지는 `accounts.py:61`), 평가액은 `ondelete="CASCADE"`(`backend/app/models.py:134`)라 계정 삭제 시 함께 사라진다. 이 두 동작 차이를 UI에서 사용자에게 명확히 전달해야 한다.

## 관련 파일 및 근거

### 백엔드
- `backend/app/routers/valuations.py:45-52` — 평가액 단건 삭제 엔드포인트. 계정 불일치 시 404. 일괄 삭제 없음
- `backend/app/routers/valuations.py:22-42` — 평가액 upsert(계정, 날짜 유니크). 주식 총합 직접 입력이 그대로 사용할 경로
- `backend/app/routers/accounts.py:57-61` — 계정 삭제. `commit_or_conflict`로 IntegrityError → 409 "거래에서 참조 중인 계정은 삭제할 수 없습니다 (비활성화를 사용하세요)"
- `backend/app/models.py:121-138` — `AssetValuation`. `account_id`는 `ondelete="CASCADE"`(`:134`), `(account_id, date)` 유니크(`:130`). 계정 삭제 시 평가 이력 동반 삭제
- `backend/app/models.py:42-43` — `Account.type` 문자열 열거. `stock`/`real_estate`가 시세형 유형
- `backend/app/excel_import.py:247-248` — `VALUATION_ITEM_TYPES = {"부동산": "real_estate", "투자성 자산": "stock"}`. **주식 제외의 1차 변경 지점**
- `backend/app/excel_import.py:251-315` — `parse_valuations`. 매핑에 없는 분류는 `:300-302`에서 자동 skip되므로 매핑만 좁히면 주식 행이 파싱되지 않음
- `backend/app/excel_import.py:51-56` — `ParsedValuation.account_type` 주석이 `real_estate | stock`
- `backend/app/routers/transactions.py:191-218` — `_effective_valuations`. `:213-214`에서 동명 계정 유형을 `("stock", "real_estate")`로 허용. 주식 제외 시 이 화이트리스트도 함께 좁혀야 함
- `backend/app/routers/transactions.py:459-490` — 업로드 확정 시 오늘 날짜로 평가액 기록, 동명 계정 없으면 `type=v.account_type`으로 신규 생성(`:467-477`). 주식 제외 후에는 주식 계정이 업로드로 자동 생성되지 않아야 함
- `backend/app/schemas.py:275-280` — `ImportValuationRow.account_type: Literal["real_estate", "stock"]`. 주식 제외 시 축소 대상
- `backend/app/schemas.py:289-291`, `:315-317` — `ImportPreview.valuations` / `ImportResult.valuation_count` 설명 문구가 "부동산·주식"
- `backend/app/schemas.py:113-129` — `ValuationUpsert`(value ≥ 0, 미래 날짜 금지) / `ValuationOut`
- `backend/app/routers/transactions.py:120` — 거래 월 일괄 삭제 엔드포인트. 일괄 삭제 API가 필요해질 경우의 참고 패턴

### 프론트엔드
- `frontend/src/pages/AssetsPage.tsx:143-174` — `renderAccountCard`. 계정 카드에는 현재 "평가액 갱신" 버튼만 있고 삭제 액션 없음. **계정 삭제 진입점 추가 지점**
- `frontend/src/pages/AssetsPage.tsx:176-190` — `deleteValuation`. 확인 없이 즉시 `api.delete` 호출
- `frontend/src/pages/AssetsPage.tsx:465-494` — 평가 이력 목록 + Trash2 삭제 버튼(`:478-484`)
- `frontend/src/pages/AssetsPage.tsx:432-499` — 평가액 갱신 다이얼로그. 주식 총합 직접 입력이 사용할 UI
- `frontend/src/pages/AssetsPage.tsx:44-45` — `VALUATION_TYPES = ["stock", "real_estate"]`. 주식이 계속 시세형이어야 하므로 **유지**
- `frontend/src/pages/AssetsPage.tsx:29-38` — `ACCOUNT_TYPE_LABEL`(`stock: "주식"`)
- `frontend/src/pages/TransactionsPage.tsx:1214-1246` — "월 전체 삭제" 확인 다이얼로그. **재사용할 확인 패턴**(제목/설명/에러 라인/`variant="destructive"` 확정 버튼/`삭제 중…` 비활성)
- `frontend/src/pages/TransactionsPage.tsx:473-492` — 확인 다이얼로그 상태·핸들러 패턴(실패 시 다이얼로그 유지 + 에러 표시)
- `frontend/src/pages/TransactionsPage.tsx:101-105`, `:992-995`, `:1021-1043` — 업로드 미리보기·결과의 "부동산·주식" 라벨/문구. 주식 제외 시 문구 정리 대상
- `frontend/src/stores/masterData.ts:73-84` — `deleteAccount` 액션 존재. 자산 페이지 계정 삭제가 재사용할 스토어 함수
- `frontend/src/stores/analytics.ts:24-28` — `fetchAssets(memberId)`. 삭제 후 자산 상태 재조회에 필요
- `frontend/src/types.ts:1-9`, `:102-125`, `:179-184` — `AccountType`, `AccountBalance`, `Valuation`, `ImportValuationRow`
- `frontend/src/pages/SettingsPage.tsx:36-47`, `:597-614` — 계정 유형 목록과 인라인 삭제(`RowActions`) 패턴. 자산 페이지 삭제와 동작이 어긋나지 않아야 함
- `frontend/src/lib/api.ts:20,30-31` — `api.delete<T = void>`가 204 처리

### 선행 이력
- `docs/tasks/2026-06-16-excel-asset-valuation-import/research.md` — 엑셀 평가액 반영 기능의 원 설계(이번에 주식 부분을 되돌림)
- `docs/tasks/2026-07-22-month-bulk-delete-import-scroll-member-split/research.md` — 확인 다이얼로그 기반 삭제 계약의 최신 선례

## 영향도

- **`backend/app/excel_import.py`** — `VALUATION_ITEM_TYPES` 축소. `parse_valuations`의 분류 skip 로직이 이미 매핑 기반이라 로직 변경은 불필요하지만 docstring(`:252-260`)이 "부동산·주식"으로 되어 있어 갱신 필요
- **`backend/app/routers/transactions.py`** — `_effective_valuations`의 유형 화이트리스트와 주석(`:197`, `:213-214`), 확정 경로 주석(`:459`)이 주식을 전제. 파싱 단계에서 주식이 사라지므로 기능은 자동으로 맞아떨어지지만, 동명의 기존 주식 계정이 엑셀 부동산 행과 충돌하지 않도록 화이트리스트를 좁히는 편이 안전
- **`backend/app/schemas.py`** — `ImportValuationRow.account_type` Literal 축소는 프론트 `types.ts:182`와 동시에 바꿔야 타입 불일치가 안 생김
- **`frontend/src/pages/TransactionsPage.tsx`** — 미리보기·결과 문구가 "부동산·주식"에서 "부동산"으로 바뀜. 유형 라벨 맵(`:101-105`)이 Literal 축소를 따라가야 `tsc` 통과
- **`frontend/src/pages/AssetsPage.tsx`** — 계정 카드에 삭제 액션 추가로 카드 레이아웃이 변함 → **모바일 375px 검증 필요**
- **`frontend/src/stores/analytics.ts` 소비처(대시보드)** — 계정 삭제 시 총자산·추이가 바뀌므로 삭제 후 `fetchAssets` 재조회가 없으면 화면이 낡은 값을 보임
- **DB 마이그레이션 없음** — 스키마 변경이 없다. 기존에 엑셀로 생성된 주식 계정/평가액은 그대로 남으며 사용자가 UI로 정리한다
- **기존 테스트** — `backend/tests`에 평가액 엑셀 관련 테스트가 있다면 주식 케이스가 깨진다 (미확인 → 미해결 질문)

## 성공 기준 (Acceptance Criteria)

- [ ] **AC-1 (자산 계정 삭제 진입점)**: 자산 페이지의 각 계정 카드에서 해당 계정을 삭제할 수 있다 — 브라우저에서 자산 페이지를 열어 임의 계정 카드에 삭제 액션이 노출되는지 확인
- [ ] **AC-2 (계정 삭제 확인 절차)**: 계정 삭제는 즉시 실행되지 않고 확인 다이얼로그를 거친다. 다이얼로그는 대상 계정명과 "평가 이력도 함께 삭제되며 되돌릴 수 없다"는 취지를 명시하고, 취소 시 아무것도 삭제되지 않는다 — 브라우저에서 삭제 액션 클릭 → 취소 후 계정이 그대로 남아 있음을 확인
- [ ] **AC-3 (삭제 성공 반영)**: 계정 삭제 성공 시 자산 상태의 계정 카드·유형별 소계·총자산이 재조회되어 즉시 갱신된다 — 평가액만 있고 거래가 없는 테스트 계정을 삭제해 총자산이 해당 잔액만큼 줄어드는 것을 확인
- [ ] **AC-4 (삭제 차단 에러 처리)**: 거래가 참조 중인 계정 삭제를 시도하면 백엔드 409 메시지가 다이얼로그 안에 표시되고, 다이얼로그는 닫히지 않으며 페이지가 깨지지 않는다 — 거래가 있는 계정으로 삭제를 시도해 확인
- [ ] **AC-5 (평가액 삭제 확인)**: 평가 이력의 개별 평가액 삭제도 확인 절차를 거친 뒤 실행되며, 삭제 후 이력 목록과 자산 총액이 갱신된다 — 평가액 갱신 다이얼로그에서 이력 1건 삭제로 확인
- [ ] **AC-6 (엑셀 주식 제외 — 파싱)**: 뱅샐현황 시트의 "투자성 자산" 행은 더 이상 평가액으로 파싱되지 않고 부동산만 파싱된다 — `parse_valuations`에 주식·부동산 행이 모두 있는 시트를 넣어 부동산만 반환됨을 확인(백엔드 테스트 또는 업로드 미리보기 응답)
- [ ] **AC-7 (엑셀 주식 제외 — 미리보기·확정)**: 엑셀 업로드 미리보기와 결과 화면에 주식 평가액이 나타나지 않고, 문구도 부동산만 언급한다. 업로드로 인해 주식 계정이 새로 생성되거나 기존 주식 계정의 평가액이 갱신되지 않는다 — 실제 엑셀 업로드 후 주식 계정의 `valued_at`/잔액이 업로드 전과 동일함을 확인
- [ ] **AC-8 (주식 총합 직접 입력)**: 주식(`stock`) 유형 계정의 카드에서 평가액 갱신으로 보유 주식 총합 금액과 기준일을 직접 입력·저장할 수 있고, 저장 후 해당 계정 잔액과 총자산에 반영된다 — 브라우저에서 주식 계정에 금액 입력 후 카드 금액·평가 기준일 갱신을 확인
- [ ] **AC-9 (타입·빌드 정합성)**: `cd frontend && npm run build`와 `npm run lint`가 오류 없이 통과한다 — 명령 실행으로 확인
- [ ] **AC-10 (모바일)**: 375px 뷰포트에서 자산 페이지의 계정 카드(삭제 액션 포함), 삭제 확인 다이얼로그, 평가액 갱신 다이얼로그에 가로 스크롤·요소 겹침·잘림이 없고 삭제/취소 버튼이 터치 가능한 크기다 — **/qa 단계에서** 브라우저 도구로 375px 리사이즈 후 확인

## Action Items

- [ ] `backend/app/excel_import.py`의 자산 분류 매핑에서 "투자성 자산"→`stock`을 제거하고, `parse_valuations`·`ParsedValuation` 주석/docstring을 부동산 전용으로 정리
- [ ] `backend/app/routers/transactions.py`의 `_effective_valuations` 유형 화이트리스트를 부동산 전용으로 좁히고 관련 주석(`:197`, `:459`)을 갱신
- [ ] `backend/app/schemas.py`의 `ImportValuationRow.account_type` Literal과 `ImportPreview`/`ImportResult` 필드 설명을 부동산 전용으로 수정
- [ ] `frontend/src/types.ts`의 대응 타입·주석을 백엔드와 동기화
- [ ] `frontend/src/pages/TransactionsPage.tsx`의 평가액 유형 라벨 맵·미리보기 블록·결과 안내 문구에서 주식 언급 제거
- [ ] `frontend/src/pages/AssetsPage.tsx` 계정 카드에 삭제 액션 추가 (아이콘 버튼 등 배치 방식은 구현 재량, 단 모바일 터치 크기 유지)
- [ ] 계정 삭제 확인 다이얼로그 추가 — `TransactionsPage`의 월 전체 삭제 다이얼로그 패턴(상태 분리, 실패 시 다이얼로그 유지+에러 표시, 진행 중 버튼 비활성)을 따르되 컴포넌트 구조는 구현 재량
- [ ] 계정 삭제 실행은 `masterData` 스토어의 `deleteAccount`를 사용하고, 성공 후 `fetchAssets(memberId)`(및 필요 시 계정 마스터) 재조회로 화면 동기화
- [ ] 평가 이력 개별 삭제에도 확인 절차를 적용 (별도 다이얼로그 vs 인라인 확정 UI는 구현 재량 — 단 평가액 갱신 다이얼로그 위에서 동작해야 함)
- [ ] 주식 계정의 평가액 갱신 다이얼로그 문구를 "보유 주식 총합"을 입력하는 흐름으로 조정 (부동산과 문구 분기 여부는 구현 재량)
- [ ] `backend/tests`에 주식 평가액 파싱을 전제한 테스트가 있으면 부동산 전용으로 수정
- [ ] `cd frontend && npm run build` / `npm run lint` 통과 확인

## 미해결 질문

- 기존에 엑셀 업로드로 자동 생성된 다수의 주식 계정은 자동 통합하지 않는다(사용자가 새 삭제 UI로 정리 후 "주식 총합" 성격의 계정 1개만 남기는 것을 전제). 자동 마이그레이션이 필요하면 별도 작업으로 분리해야 한다
- "주식 총합" 계정을 시스템이 강제로 1개만 두도록 제약할지(예: `stock` 유형 계정 중복 생성 차단) 여부는 확정하지 않았다 — 현 명세는 제약 없이 사용자가 계정 수를 관리하는 방식이다
- `backend/tests` 디렉터리에 평가액 엑셀 관련 테스트가 실제로 존재하는지 확인하지 못했다 (`/implement` 단계에서 확인 필요)
- 계정 삭제가 거래 참조로 차단될 때 "비활성화" 대안을 자산 페이지에서 바로 제공할지(현재는 설정 페이지에서만 가능)는 미정 — 최소 범위는 409 메시지 표시까지다
