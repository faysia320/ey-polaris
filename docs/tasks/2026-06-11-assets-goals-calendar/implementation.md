# Implementation: 주식·부동산 자산 관리 + 목표금액 달성 현황 + 거래 캘린더 뷰

- 날짜: 2026-06-11
- 기반 명세: `docs/tasks/2026-06-11-assets-goals-calendar/research.md`

## 변경 파일

### 백엔드
- `backend/app/models.py` — `AssetValuation`(계정 FK CASCADE, (계정,날짜) 유니크), `Goal` 모델 추가
- `backend/alembic/versions/0003_asset_valuations_and_goals.py` — 신규: `asset_valuations`, `goals` 테이블 생성 리비전 (upgrade/downgrade 포함)
- `backend/app/schemas.py` — `AccountType`에 `stock`, `real_estate` 추가; `ValuationUpsert/Out`, `GoalCreate/Update/Out` 스키마 추가; `AccountBalance`에 `valued_at`(평가 기준일, nullable) 추가
- `backend/app/routers/valuations.py` — 신규: `/accounts/{id}/valuations` GET(목록)/PUT(upsert)/DELETE
- `backend/app/routers/goals.py` — 신규: `/goals` CRUD
- `backend/app/routers/analytics.py` — `assets()`: 평가액이 있는 계정은 최신 평가액을 잔액으로 사용, `trend`를 계정별 계산으로 변경(월말 이전 최신 평가액 우선, 없으면 기존 누적 방식)
- `backend/app/main.py` — `valuations`, `goals` 라우터 등록

### 프론트엔드
- `frontend/src/types.ts` — `AccountType` 확장, `Valuation(Input)`, `Goal(Input)` 타입 추가, `AccountBalance.valued_at` 추가
- `frontend/src/stores/goals.ts` — 신규: 목표 zustand 스토어 (budgets.ts 패턴)
- `frontend/src/pages/SettingsPage.tsx` — `ACCOUNT_TYPES`에 주식/부동산 추가
- `frontend/src/pages/AssetsPage.tsx` — 라벨 추가, 주식/부동산 계정 카드에 "평가액 갱신" 다이얼로그, 평가 기준일 표시, 목표 달성 현황 카드(진행바, 추가/수정/삭제, 빈 상태 문구)
- `frontend/src/components/transactions/TransactionCalendar.tsx` — 신규: 네이티브 Date 기반 월 그리드(일자별 수입/지출 합계, 오늘 강조, 날짜 선택)
- `frontend/src/pages/TransactionsPage.tsx` — 테이블↔캘린더 토글, 캘린더 월 이동, 선택일 거래 목록(수정/삭제 포함), 캘린더에서 거래 추가 시 선택일 프리필, 월 필터 비어 있으면 현재 월로 자동 설정

## 주요 결정
- **평가액 잔액 규칙**: 평가액이 1건 이상 있는 계정은 "최신 평가액 단독"(평가일 이후 거래 미가산) — 사용자 확정(AskUserQuestion). models.py·analytics.py 주석에 명시.
- **중복 평가액**: PUT upsert로 같은 날짜 재기록 시 값 갱신 — 사용자 확정.
- **목표 기준**: 총자산 ÷ 목표금액, 달성률 계산은 프론트(`AssetsPage`)에서 수행 — 사용자 확정. 백엔드는 순수 CRUD만 제공.
- **음수 평가액 불허**: `value: int = Field(ge=0)` — 사용자 확정.
- **평가액 API 경로**: 계정 하위 중첩(`/accounts/{id}/valuations`)으로 설계. 계정 소속이 명확하고 교차 계정 접근(다른 계정의 평가액 id 삭제 시도)은 404 처리.
- **trend 계산 변경**: 기존 전체 합산 → 계정별 계산으로 변경. 평가액 없는 계정만 있으면 결과는 기존과 수학적으로 동일(검증: 기존 시드 계정 2개의 balance/total 변화 없음).
- **캘린더**: 신규 라이브러리 없이 네이티브 Date로 구현(research.md 권고). 캘린더 뷰에서도 구분/카테고리 필터가 합계에 반영됨(거래 스토어 공유).

## 자체 검증 결과
- `npm run build` (frontend) → **통과** (tsc -b + vite build. 번들 500kB 경고는 기존부터 존재하는 echarts 번들 크기 경고)
- `npm run lint` (frontend) → **통과** (에러 0. 경고 1건은 기존 `useReactTable` 호출에 대한 react-compiler 호환성 경고로 본 변경과 무관)
- `python -m py_compile` (변경된 백엔드 7개 파일) → **통과**
- 임시 venv에서 `from app.main import app` 임포트 + 라우트 확인 → **통과** (`/api/v1/accounts/{account_id}/valuations`, `/api/v1/goals` 등록 확인)
- `docker compose up -d --build` → 기존 데이터가 있는 DB에 **0002→0003 마이그레이션 정상 적용**, 서버 기동 성공
- 라이브 API 스모크 테스트 → **전부 통과**:
  - stock 계정 생성 → 평가액 기록(500만) → 같은 날짜 재기록(550만) 시 동일 id로 갱신(upsert)
  - `/analytics/assets`: balance=5,500,000, valued_at=2026-06-10, total 합산, trend 반영
  - 목표 생성/삭제, 목표금액 0 → 422, 없는 계정 평가액 → 404, 음수 평가액 → 422
  - 계정 삭제 시 평가액 CASCADE 삭제, 정리 후 기존 시드 계정 잔액 변화 없음(회귀 확인)
- 참고: `frontend/package-lock.json`이 로컬 npm(11.x)과 어긋나 `npm ci` 실패(기존 문제, 본 변경과 무관 — package.json 미수정). `npm install`로 설치 후 lock 파일은 `git checkout`으로 원복함.

## 성공 기준 자가 체크
- [x] AC-1: 주식/부동산 유형 계정 생성 — API 스모크 테스트로 확인 (UI 셀렉트에도 라벨 추가)
- [x] AC-2: 평가액 기록·갱신·삭제 API(/accounts/{id}/valuations) + AssetsPage "평가액 갱신" 다이얼로그
- [x] AC-3: 최신 평가액이 잔액·총자산에 반영 — 스모크 테스트로 balance=최신 평가액, total 합산 확인
- [x] AC-4: 평가액 없는 계정은 기존 계산 유지 — 기존 시드 계정 2개의 balance 변화 없음 확인
- [x] AC-5: trend에 월말 기준 최신 평가액 반영 — 2026-06-10 평가액이 2026-06 포인트에 반영됨 확인
- [x] AC-6: 같은 날짜 중복 기록은 upsert로 일관 처리 — 동일 id로 값 갱신 확인
- [x] AC-7: /goals CRUD + 목표금액 0 이하 422 확인
- [x] AC-8: 자산 페이지에 달성률(총자산÷목표금액) 진행바 표시 — 코드 구현, 빌드 통과 (브라우저 육안 확인은 QA 단계)
- [x] AC-9: 100% 초과 시 진행바 캡(min(rate,1)) + 실제 % 수치 표시 — `AssetsPage.tsx` 구현
- [x] AC-10: 목표 0건일 때 빈 상태 문구 표시 — 구현
- [x] AC-11: 테이블↔캘린더 토글, 일자별 수입/지출 합계 그리드 — 구현, 빌드 통과
- [x] AC-12: 날짜 선택 시 해당 일 거래 목록 표시(수정/삭제 버튼 포함) — 구현
- [x] AC-13: 캘린더 월 이동(연도 경계는 기존 `addMonths` 재사용) — 구현
- [x] AC-14: 월 필터 비어 있을 때 캘린더 전환 시 현재 월 자동 설정 — `switchView`에서 처리
- [x] AC-15: 기존 테이블 뷰 기능 보존 — 테이블 JSX·로직 미변경(조건부 렌더링으로만 감쌈), 빌드·린트 통과
- [x] AC-16: `npm run build`·`npm run lint` 통과
- [x] AC-17: 리비전 0003 체인 추가, 기존 데이터 있는 DB에 비파괴 적용 확인 (downgrade 정의 포함)

## 보류/미완 항목
- 없음. (UI 동작의 브라우저 육안 검증은 /qa 단계 몫 — 백엔드는 라이브 API로, 프론트는 빌드/린트로 자체 검증함)

---

# 2차: QA 이슈 수정 (qa-report.md 후속)

- 날짜: 2026-06-11
- 대상: 1차 QA(CONDITIONAL PASS)의 Medium 2건 + Low 3건 전부

## 변경 파일
- `backend/app/routers/valuations.py` — [Medium] upsert의 생 `db.commit()`을 `commit_or_conflict`로 교체 (동시 PUT 경합 시 409, 레포 컨벤션 준수)
- `frontend/src/pages/AssetsPage.tsx` — [Medium] 목표 조회/삭제 실패를 페이지 전역 `error` 대신 목표 카드 내 인라인 `goalListError`로 표시 (자산 페이지 전체가 사라지지 않음, 성공 시 자동 해제). [Low] 평가액 기준일 입력에 `max=오늘` + 미래 날짜 클라이언트 검증 추가
- `backend/app/routers/analytics.py` — [Low] 전체 평가액 적재 + 월×계정×이력 중첩 순회 제거: `row_number()` 윈도우로 계정·월별 최신 평가액만 조회(계정당 월 1행)하고, trend는 포인터 워크로 계산
- `backend/app/schemas.py` — [Low] `ValuationUpsert.date`에 미래 날짜 422 거부 검증 추가 (잔액 즉시 반영 vs trend 월말 기준의 비일관을 입력 차단으로 통일)
- `frontend/src/pages/TransactionsPage.tsx` — [Low] 조건부 블록 안 테이블/페이지네이션 JSX 들여쓰기 정렬 (동작 무변경)

## 주요 결정
- **미래 날짜 평가액 규칙 통일**: QA가 제시한 두 선택지(입력 차단 vs trend 규칙 일치) 중 **입력 차단**을 채택. 가계부에서 미래 시점 평가액은 의미가 없고, 차단이 비일관을 원천 제거함. 백엔드 422 + 프론트 input max/검증의 이중 방어.
- **analytics 최적화 방식**: DB 윈도우 함수(`row_number() over (partition by account, month order by date desc)`)로 월별 최신값만 가져오고, 12개월 워크는 계정별 포인터로 진행 — 평가 이력이 누적돼도 조회·계산량이 월 단위로 상한.

## 자체 검증 결과
- `npm run build` → **통과** / `npm run lint` → **통과** (에러 0, 기존 `useReactTable` 경고 1건만)
- `docker compose up -d --build backend` → 기동 정상
- 라이브 API 스모크 테스트 → **전부 통과**:
  - 같은 월에 6/01(400만)·6/10(550만) 기록 시 월별 최신(6/10) 채택 — 잔액 5,500,000, valued_at=2026-06-10
  - trend: 2026-03~05 = 1,000,000(과거 평가액 이월), 2026-06 = 5,500,000 — 최적화 전과 동일 결과
  - 미래 날짜(2027-01-01) 평가액 → **422**
  - upsert 정상 경로 유지(같은 날짜 재기록 시 값 갱신)
  - 검증 데이터 정리 후 total=0, 기존 계정 2개 무변화 (회귀 없음)
- 동시 PUT 경합(409 경로)은 단일 클라이언트로 재현이 어려워 코드 수준 확인(기계적 치환, `goals.py`·`budgets.py`와 동일 패턴)

## 보류/미완 항목
- 없음
