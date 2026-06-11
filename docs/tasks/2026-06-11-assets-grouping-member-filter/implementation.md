# Implementation: 자산 상태 카드 유형별 그룹핑 + 구성원 필터 + 계정 소유자 필수화

- 날짜: 2026-06-11
- 기반 명세: docs/tasks/2026-06-11-assets-grouping-member-filter/research.md

## 변경 파일

### Backend
- `backend/app/models.py` — Account에 `member_id` NOT NULL FK(RESTRICT) + `member` relationship 추가
- `backend/alembic/versions/0005_account_owner_required.py` — (신규) member_id nullable 추가 → 최소 id 구성원(으니)으로 백필 → NOT NULL + FK 적용. 구성원 0명+계정 존재 시 RuntimeError로 중단
- `backend/app/schemas.py` — `AccountCreate`에 `member_id: int` 필수 추가, `AssetsOut`에 `grand_total` 추가
- `backend/app/routers/accounts.py` — create/update에 구성원 존재 검증(get_or_404) 추가
- `backend/app/routers/members.py` — 삭제 차단 메시지에 계정(소유자) 참조 사유 반영
- `backend/app/routers/transactions.py` — import API에 `default_member_id` Form 파라미터(필수, 존재 검증) 추가, 자동 생성 계정에 적용
- `backend/app/routers/analytics.py` — dashboard에 `member_id` 파라미터(in_month 조건 결합 + 최근 거래 별도 where), assets에 `member_id` 파라미터(visible 계정만 balances/total/trend 계산) + `grand_total`(전 계정 기준) 산출

### Frontend
- `frontend/src/stores/memberFilter.ts` — (신규) 전역 구성원 필터 zustand 스토어 (null=전체)
- `frontend/src/components/members/MemberFilterSelect.tsx` — (신규) 전체+구성원 동적 옵션 select. masterData 미로드 시 자체 로드
- `frontend/src/stores/analytics.ts` — `fetchDashboard(month, memberId?)`, `fetchAssets(memberId?)` 시그니처 확장
- `frontend/src/stores/transactions.ts` — `TransactionFilters.member_id` + toQuery 반영
- `frontend/src/pages/DashboardPage.tsx` — 헤더 우측 select 배치, memberId를 fetch 의존성에 연결
- `frontend/src/pages/TransactionsPage.tsx` — 헤더 select 배치, 전역 필터→거래 필터 동기화 effect(마운트 조회 겸용), 엑셀 업로드 다이얼로그에 "새 계정 기본 소유자" select(+필수 검증, FormData 전송)
- `frontend/src/pages/AssetsPage.tsx` — 헤더 우측 select, 계정 카드를 유형별 그룹 카드(라벨+소계, 빈 유형 미표시) 중첩 구조로 교체, 목표 카드를 `grand_total` 기준으로 변경·"부부 공동 목표 — 전체 자산 기준" 표기, 평가액 갱신/삭제 후 재조회에 memberId 유지
- `frontend/src/pages/SettingsPage.tsx` — AccountsTab에 소유자 select(필수 검증)·테이블 소유자 컬럼 추가
- `frontend/src/types.ts` — `Account.member_id`, `Assets.grand_total` 추가
- `frontend/src/stores/masterData.ts` — `AccountInput.member_id` 추가

## 주요 결정
- **유형 그룹 순서**: `ACCOUNT_TYPE_LABEL` 객체 키 순서(은행→현금→카드→투자→주식→부동산→기타)를 그대로 사용 — 명세의 고정 순서와 일치.
- **내부 계정 카드의 유형 배지 제거**: 그룹 헤더가 유형을 표시하므로 중복 배지는 제거 (비활성 배지·잔액 색상·평가 기준일·평가액 갱신 버튼은 유지).
- **dashboard 필터**: `in_month` 조건식에 member 조건을 결합해 거래 집계 3곳에 일괄 적용, 전체 기간 대상인 최근 거래만 별도 where. 예산 amount는 가구 공통이라 필터하지 않음(spent만 필터됨) — 명세대로.
- **assets**: 전 계정 잔액을 먼저 계산해 `grand_total`을 구한 뒤 visible 계정만 응답·추이에 사용 — 목표 달성률이 필터와 무관하게 항상 동일.
- **TransactionsPage 마운트 조회**: 기존 `fetch()` 호출을 `setFilters({ member_id })`로 대체(내부 fetch 포함)해 이중 조회 방지.
- **import의 default_member_id는 필수 Form**: 새 계정이 안 생기는 업로드에서도 받지만, 선택 강제가 단순하고 업로드 시점에 소유자 부재 상황이 생기지 않음.
- research.md와 다르게 구현한 사항: 없음.

## 자체 검증 결과
- `npm --prefix frontend run build` (tsc -b + vite build) → **통과** (chunk 500kB 경고는 기존부터 존재)
- `npm --prefix frontend run lint` → **0 errors / 2 warnings** — 둘 다 이번 변경과 무관한 기존 코드(TransactionsPage columns useMemo deps, TanStack Table 비호환 경고)
- `python -m compileall backend/app backend/alembic` → **통과**
- `docker compose up -d --build backend` → 기동 로그에서 **`Running upgrade 0004 -> 0005` 성공** 확인
- API 실검증 (로컬 dev DB):
  - `GET /api/v1/accounts` → 기존 계정 10건 모두 `member_id: 1`(으니)로 백필됨
  - `GET /api/v1/analytics/assets` → `grand_total` 포함. `?member_id=2` → accounts 0건·total 0·grand_total은 전체값 유지. `?member_id=1` → 10건·전체와 동일
  - `GET /api/v1/analytics/dashboard?month=2026-05&member_id=1` → income/expense/recent 모두 으니 거래만 집계(기존 import 거래는 member_id 없음 → 0, 의미상 올바름)
  - `POST /api/v1/accounts` member_id 누락 → **422**, member_id=999 → **404**, member_id=2 → 201 생성 후 필터에 즉시 반영(검증용 계정은 삭제로 정리)
  - `DELETE /api/v1/members/1` (계정 소유자) → **409** "거래 또는 계정(소유자)에서 참조 중인 구성원은 삭제할 수 없습니다"
- `docker compose up -d --build frontend` → 신규 빌드로 재기동 완료 (구버전 프론트는 import API의 필수 파라미터와 어긋나므로 함께 갱신)

## 성공 기준 자가 체크
- [x] AC-1: 유형별 그룹 카드 안 중첩 카드 렌더 — AssetsPage 그룹 구조로 교체, 빌드 통과 (브라우저 최종 확인은 /qa)
- [x] AC-2: 고정 순서·소계·빈 유형 미표시 — ACCOUNT_TYPE_LABEL 키 순회 + length 0 그룹 skip + 헤더 소계
- [x] AC-3: 잔액 색상·평가 기준일·평가액 갱신 버튼·비활성 배지 유지 — 내부 카드 마크업 보존
- [x] AC-4: 세 페이지 헤더 우측 select, 전체+/members 동적 옵션 — MemberFilterSelect 공용 컴포넌트
- [x] AC-5: 페이지 이동 시 선택 유지 — 전역 zustand 스토어
- [x] AC-6: 거래 목록 member 필터 — filters.member_id → `GET /transactions?member_id=N` (백엔드 기존 지원 활용)
- [x] AC-7: 대시보드 집계 4곳 필터 — API 실검증으로 확인 (예산 amount 불변)
- [x] AC-8: 계정 소유자 필수 — UI 검증 에러 + API 422/404 실검증
- [x] AC-9: 마이그레이션 백필 — upgrade 성공, 10건 전부 member_id=1 확인
- [x] AC-10: 소유 구성원 삭제 차단 — 409 + 메시지 실검증
- [x] AC-11: 업로드 다이얼로그 기본 소유자 select — UI·FormData·백엔드 적용 구현 (실파일 업로드 검증은 /qa)
- [x] AC-12: 자산 member 필터 — `?member_id=2` → 0건/total 0, 검증용 계정 생성 시 1건 반영 실검증
- [x] AC-13: 목표 카드 항상 표시·grand_total 기준 — assets 응답 grand_total 필터 무관 동일 실검증, FE는 grandTotal 사용
- [x] AC-14: '전체' 회귀 없음 — member_id 미전달 시 기존 구조·값 동일 (grand_total 필드 추가만)

## 보류/미완 항목
- 없음. (단, 기존 계정 10건이 모두 으니 소유로 백필되어 있으므로, 실제 소유자가 다른 계정은 기준정보 관리에서 한 번 재지정 필요 — 명세에 합의된 일회성 수동 작업)
