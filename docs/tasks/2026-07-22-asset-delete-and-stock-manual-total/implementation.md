# Implementation: 자산 내역 삭제 기능 · 주식 엑셀 제외 및 총합 직접 입력

- 날짜: 2026-07-22
- 기반 명세: `docs/tasks/2026-07-22-asset-delete-and-stock-manual-total/research.md`
- 이력: 1차 구현 → `/qa` **FAIL**(AC-10) → 2차 수정(본 문서 반영)

## 변경 파일

- `backend/app/excel_import.py` — `VALUATION_ITEM_TYPES`에서 `"투자성 자산": "stock"` 제거(부동산만 매핑), `ParsedValuation.account_type` 주석·`parse_valuations` docstring을 부동산 전용으로 갱신
- `backend/app/routers/transactions.py` — `_effective_valuations`의 동명 계정 유형 검사를 `not in ("stock","real_estate")` → `!= "real_estate"`로 축소, 관련 docstring·확정 경로 주석 갱신
- `backend/app/schemas.py` — `ImportValuationRow.account_type`를 `Literal["real_estate"]`로 축소, `ImportPreview.valuations`·`ImportResult.valuation_count` 설명 문구에서 주식 제거
- `frontend/src/types.ts` — `ImportValuationRow.account_type`를 `'real_estate'`로 동기화, 주석 갱신
- `frontend/src/pages/TransactionsPage.tsx` — `VALUATION_TYPE_LABEL` 키를 `'real_estate'`로 축소, 미리보기/결과 문구 "부동산·주식" → "부동산"
- `frontend/src/pages/AssetsPage.tsx` — 계정 카드에 삭제 버튼 추가, 자산 계정 삭제 확인 다이얼로그 추가, 평가액 삭제에 확인 다이얼로그 도입, 주식 계정 전용 문구(`isStock`) 분기. **2차**: `CardTitle`에 `min-w-0` 추가(모바일 잘림 수정), 평가액 삭제 실패 UX를 계정 삭제와 통일
- (DB 데이터) 주식 계정 10개 → 구성원별 `주식(으니)`/`주식(영이)` 2개로 통합. 개발 DB에 psql로 1회 실행했으며 레포에 스크립트를 남기지 않는다 (아래 "통합 SQL 기록" 참조). Alembic 마이그레이션 아님

## 주요 결정

- **주식 계정 통합은 평가액 합계를 날짜별로 이관**했다. 단순 삭제 후 최신 합계만 시드하면 6월 이력이 사라져 "월별 자산 추이" 차트가 왜곡된다. 기존 계정의 `(날짜, 합계)`를 그대로 승계해 2026-06-17(25,343,381원)·2026-07-21(17,163,436원) 두 스냅샷을 보존했다.
- **계정명은 `주식(구성원명)`** — `accounts.name`이 unique이고 자산 페이지가 구성원별로 카드를 분할하므로 구성원별 1개가 필요했다. 사용자 선택(구성원별 2개 생성)에 따른 것이다.
- **`VALUATION_TYPES`에 `stock`을 유지**했다. 주식은 여전히 평가액 스냅샷으로 잔액을 관리하며, 달라진 것은 "값의 출처가 엑셀이 아니라 직접 입력"이라는 점뿐이다. 유형을 빼면 총합 입력 UI 자체가 사라진다.
- **평가액 삭제에도 확인 절차를 추가**했다(AC-5). 기존 코드는 확인 없이 즉시 삭제였고, research.md가 계약으로 요구했다.
- **계정 삭제는 기존 `masterData.deleteAccount`를 재사용**하고 성공 후 `fetchAssets(memberId)`를 호출한다.
- **DB 정리는 일회성 SQL**(사용자 선택). 실행 전 `pg_dump` 백업을 스크래치패드에 보관했다.

### 2차 수정 (QA FAIL 대응)

- **[Medium] 모바일 375px 삭제 버튼 잘림 — `CardTitle`에 `min-w-0` 적용.** 1차에서는 계정명 span에만 `min-w-0 truncate`를 줬는데, shadcn `CardHeader`가 `display:grid`이고 그리드 아이템인 `CardTitle`의 `min-width`가 `auto`라 트랙이 max-content(293.4px)로 커졌다. 트랙이 카드 콘텐츠 폭(264.3px)을 넘으니 안쪽 span에는 애초에 넘칠 폭이 없어 `truncate`가 발동하지 않았고, 카드의 `overflow-x:hidden`이 오른쪽 삭제 버튼을 잘랐다. **그리드 아이템 자신**에 `min-w-0`을 줘야 트랙 최소 크기가 0이 되어 가용 폭으로 제한되고, 그제서야 안쪽 truncate가 작동한다. 공용 `card.tsx`는 다른 화면에 영향이 가므로 건드리지 않고 이 카드의 className으로만 해결했다.
- **[Low] 평가액 삭제 실패 UX를 계정 삭제와 통일.** 1차에서는 실패 시 확인 다이얼로그를 닫고 바깥 갱신 다이얼로그에 에러를 띄웠는데, 계정 삭제(및 research.md가 참조한 `TransactionsPage` 패턴)는 다이얼로그를 유지하고 그 안에 사유를 보여준다. `valuationDeleteError` 상태를 추가해 두 경로를 같은 방식으로 맞췄다.
- **[Low] 통합 SQL을 문서에 기록.** QA가 "리뷰·재현·롤백 불가"를 지적했다. 이미 개발 DB에 적용을 마친 1회성 작업이라 Alembic 마이그레이션으로 승격하지 않고, 실행 가능한 스크립트 파일도 레포에 두지 않는다(재실행 시 계정이 중복 생성된다). 대신 실행 원문과 결과를 아래에 기록해 리뷰만 가능하게 했다.

### 통합 SQL 기록 (2026-07-22 개발 DB에 1회 실행, 재실행 금지)

실행 전 `pg_dump`로 백업했다. 대상 계정은 거래 참조가 0건이라 `accounts` FK(RESTRICT)에 걸리지 않고, `asset_valuations`는 CASCADE라 원본 평가액이 함께 정리된다.

```sql
BEGIN;
-- 통합 대상을 먼저 고정한다. 새로 만드는 계정도 type='stock'이라
-- 스냅샷 없이 진행하면 2~3단계가 신규 계정까지 대상으로 삼는다.
CREATE TEMP TABLE old_stock AS
SELECT id, member_id FROM accounts WHERE type = 'stock';

-- 구성원별 통합 계정 생성 (accounts.name이 unique이므로 구성원명을 붙인다)
INSERT INTO accounts (name, type, opening_balance, is_active, member_id)
SELECT DISTINCT '주식(' || m.name || ')', 'stock', 0, true, m.id
FROM old_stock o JOIN members m ON m.id = o.member_id;

-- 날짜별 합계를 통합 계정으로 이관 (최신값만 옮기면 과거 추이가 왜곡된다)
INSERT INTO asset_valuations (account_id, date, value)
SELECT na.id, v.date, sum(v.value)
FROM asset_valuations v
JOIN old_stock o ON o.id = v.account_id
JOIN members m ON m.id = o.member_id
JOIN accounts na ON na.name = '주식(' || m.name || ')'
GROUP BY na.id, v.date;

DELETE FROM accounts WHERE id IN (SELECT id FROM old_stock);
COMMIT;
```

적용 결과 — 계정 10개 삭제, 평가액 5건 잔존:

| id | 계정 | 구성원 | 날짜 | 금액 |
| --- | --- | --- | --- | --- |
| 130 | 주식(영이) | 2 | 2026-07-21 | 4,494,000 |
| 131 | 주식(으니) | 1 | 2026-07-21 | 17,163,436 |
| 131 | 주식(으니) | 1 | 2026-06-17 | 25,343,381 |

최신 평가일 기준 합계가 통합 전 21,657,436원과 정확히 일치한다.

## 자체 검증 결과

**1차**

- `cd frontend && npm run build` → **통과** (오류 0)
- `cd frontend && npm run lint` → **통과** (0 errors, 2 warnings). 두 경고는 `TransactionsPage.tsx:329,332`의 `useReactTable` 관련으로, `git stash` 후 변경 전 상태에서도 동일하게 2건 발생함을 실제 확인 (기존 경고)
- 합성 xlsx(부동산 2행 + 투자성 자산 2행)로 `parse_valuations` 직접 호출 → **통과**. 부동산 2건만 반환, `stock` 0건
  - 주의: 백엔드 컨테이너에 소스 볼륨 마운트가 없어 `docker compose restart`로는 코드가 반영되지 않았다. `docker compose up -d --build backend`로 재빌드한 뒤에야 통과 (첫 시도는 구 코드로 FAIL)
- `GET /api/v1/analytics/assets` → 총자산 381,657,436원, 주식 2계정(4,494,000 / 17,163,436). 통합 전 주식 합계 21,657,436원과 정확히 일치

**2차 (QA 지적 수정 후)**

- `cd frontend && npm run build` → **통과** (`✓ built in 1.53s`, 오류 0, 신규 번들 `index-Dh6wmbNW.js`)
- `cd frontend && npm run lint` → **통과** (0 errors, 2 warnings — 위와 동일한 기존 항목)
- `docker compose up -d --build frontend` 후 `curl localhost:3000` → 서빙 번들이 `index-Dh6wmbNW.js`로 빌드 산출물과 일치. **QA가 최신 코드를 대상으로 검증할 수 있는 상태**
- **브라우저 E2E 확인은 /qa 위임** — 특히 AC-10 375px 실측(삭제 버튼 `right <= card.right`, 계정명 span `scrollWidth > clientWidth`)은 QA가 지정한 방법으로 재확인 필요

## 성공 기준 자가 체크

- [x] AC-1: 계정 카드 CardTitle에 Trash2 삭제 버튼 — QA 1차에서 25개 카드 전수 검출로 확인됨
- [x] AC-2: `accountToDelete` + 확인 다이얼로그, 취소 시 API 미호출 — QA 1차 확인됨
- [x] AC-3: `deleteAccount` 후 `fetchAssets(memberId)` 재조회 — QA 1차에서 수치 일치 확인됨
- [x] AC-4: 실패 시 다이얼로그 유지 + 409 메시지 표시 — QA 1차 확인됨
- [x] AC-5: 평가액 삭제 확인 다이얼로그 — QA 1차 확인됨. 2차에서 실패 경로 UX를 계정 삭제와 통일
- [x] AC-6: 합성 xlsx 실행 검증으로 부동산만 파싱 — QA 1차 재확인됨
- [x] AC-7: 실제 엑셀 업로드로 주식 미반영 확인 — QA 1차에서 동명 계정 우회 케이스까지 검증됨
- [x] AC-8: `isStock` 분기로 총합 입력 UI 제공 — QA 1차 확인됨
- [x] AC-9: `npm run build`·`npm run lint` 통과 (경고 2건은 기존)
- [ ] AC-10: **2차 수정 완료, /qa 재검증 대기.** `CardTitle`에 `min-w-0`을 적용해 그리드 트랙이 가용 폭으로 제한되고 계정명이 ellipsis 처리되도록 했다. 1차 실패 지점(`우리직장인재테크 저축예금(수수료우대형` 카드)에서 삭제 버튼이 카드 안에 들어오는지는 **브라우저 실측이 필요하며 /qa가 수행**한다 — 코드 수준 근거만으로 충족을 주장하지 않는다

## 보류/미완 항목

- **AC-10 브라우저 실측**은 /qa 재실행으로 확정 (구현자 자가 E2E는 독립 평가를 대체하지 않음)
- **[Low] `deleteAccount` 실패 구분 미개선** — 스토어의 `deleteAccount`는 `api.delete` 성공 후 `fetchAll()`을 호출하므로, 새로고침만 실패해도 "삭제 실패"처럼 보인다. 제대로 고치려면 스토어를 우회해 `api.delete`를 직접 부르고 갱신을 분리해야 하는데, 이는 research.md가 지정한 "스토어 재사용" 방향과 어긋나고 다른 페이지와 패턴이 갈린다. 발생 확률이 낮아 의도적으로 남긴다
- **[Low] 다이얼로그 닫힘 중 계정명 공백 렌더** — Radix exit 애니메이션 동안 순간적으로 이름이 빈 문자열이 된다. 고치려면 open 상태와 대상 상태를 분리해야 해서, 순간적 표시라는 영향 대비 변경이 커 남긴다
- **[Low] `SettingsPage`의 계정 삭제는 여전히 확인 없음** — 자산 페이지와 UX가 갈린다. research.md가 언급했으나 AC로 승격되지 않았고, 이번 요청 범위(자산 상태 화면) 밖이라 별도 작업으로 남긴다
- **`stock` 계정 중복 생성 차단 미구현** (research.md 미해결 질문 2) — 현행대로 사용자가 계정 수를 관리
- **`backend/tests` 없음** — research.md 미해결 질문 3의 답. 수정할 기존 테스트가 없었고 신규 테스트 추가는 요청 범위 밖
- **DB 백업 위치**: `<scratchpad>/polaris-backup-20260722.sql` (28KB). 세션 스크래치패드라 영구 보관이 아니므로 롤백이 필요하면 이번 세션 중에 사용해야 한다
