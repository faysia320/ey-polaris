# Implementation: 예산을 지출 대분류 단위로만 설정·집계 (2차 — QA FAIL 수정 반영)

- 날짜: 2026-06-12
- 기반 명세: docs/tasks/2026-06-12-budget-major-category/research.md

## 2차 수정 (QA 2차 FAIL의 Action Items 반영)

- **AC-4 계약 정합 [High]**: research.md AC-4를 사용자 결정(2026-06-12 /implement 입력: "개발 테스트 단계라 소분류 지정 예산은 삭제해도 됨")에 맞게 개정 — "소분류 지정 예산 삭제 + '미분류' 예산만 백필"로 갱신, 개정 사유·출처 병기. **코드 무변경** (QA 권고 옵션 a).
- `frontend/src/pages/BudgetsPage.tsx` [Low]: 헤더 라벨 "지출 카테고리" → "지출 대분류". 모바일 퍼스트 개선 — '현재 예산' 컬럼을 `hidden sm:table-cell`로 데스크톱 전용화하고 모바일에서는 대분류 셀 보조 줄로 표시, 입력 컬럼 `w-64` → `w-28 sm:w-64`, 액션 컬럼 고정폭 `w-32` 제거 (375px에서 내부 가로 스크롤 의존 제거).
- `backend/app/schemas.py` [Low]: `BudgetCreate.major`에 strip 검증 추가 — `" 교통 "` → `"교통"` 정규화 저장(201 확인), 공백만 입력 → 422 한국어 메시지 (API 재검증 후 테스트 데이터 삭제).
- 별개 작업(assets-page-horizontal-scroll) 변경 3개 파일 혼재 [Medium]: 이 작업 범위 밖 — /git-commit 단계에서 커밋 스코프 분리 필요 (메모만 남김).
- AC-5~7 브라우저 실측 [Medium]: implement 단계 규칙상 브라우저 E2E는 /qa 전담 — qa-evaluator가 브라우저 도구(Chrome MCP)가 있는 환경에서 실측 필요. frontend는 http://localhost:3000 에 변경 반영 재빌드 완료.

## 변경 파일
- `backend/alembic/versions/0007_budget_major_only.py` — 신규 마이그레이션: budgets.major 추가, 소분류 지정 예산 삭제, '미분류' 예산 대분류 백필, category_id/FK/기존 유니크 제거, (year_month, major) 유니크 추가. downgrade 포함
- `backend/app/models.py` — Budget을 major 문자열 키로 변경 (category FK·relationship 제거)
- `backend/app/schemas.py` — BudgetCreate/BudgetOut/BudgetProgress를 major 기반으로 변경 (category_id·category_name 제거)
- `backend/app/routers/budgets.py` — 생성 검증을 "해당 major의 expense 카테고리 존재"로 교체, `_to_out` 제거 (from_attributes 직렬화)
- `backend/app/routers/analytics.py` — 예산 spent를 대분류 단위로 집계 (도넛용 대분류 집계 `expense_rows` 재사용 — 별도 쿼리 제거), 미사용 selectinload import 제거
- `backend/app/routers/categories.py` — 삭제 409 메시지에서 '예산' 문구 제거 (예산은 더 이상 FK로 삭제를 막지 않음)
- `frontend/src/types.ts` — Budget/BudgetProgress 타입을 major 기반으로 변경
- `frontend/src/stores/budgets.ts` — save 키를 categoryId → major 문자열로 변경
- `frontend/src/pages/BudgetsPage.tsx` — 행을 지출 대분류 고유 목록으로 변경 (소분류·nature 태그 제거), drafts 키를 major로 변경
- `frontend/src/pages/DashboardPage.tsx` — 예산 스택바·범례의 키와 색상 매핑을 b.major로 변경

## 주요 결정
- **기존 소분류 예산은 삭제** (research.md는 합산 병합이었으나, 사용자가 /implement 입력에서 "개발 단계라 소분류 지정 예산은 삭제해도 됨"으로 결정) — '미분류' 소분류 예산만 대분류로 백필
- 필드 네이밍은 `major`로 통일 (BudgetOut의 category_name 제거) — 미해결 질문의 구현 재량 사항. 도넛 차트(`expense_by_category.category_name`)는 기존 유지
- major 이름 변경 시 예산 동기화는 하지 않음 (research.md 권장안) — 대신 BudgetsPage 행 목록을 "지출 대분류 ∪ 현재 월 예산의 major"로 구성해 옛 이름 예산도 표시·수정·삭제 가능하게 함
- analytics의 spent 집계는 기존 도넛용 대분류 집계(`expense_rows`)를 재사용 — member 필터(`in_month`)가 동일하게 적용되므로 의미 동일, 쿼리 1개 감소
- FK 제약 이름은 0001에서 무명 생성 → Postgres 자동 명명 `budgets_category_id_fkey`로 drop (프로젝트는 Postgres 전용)

## 자체 검증 결과
- 실행 명령: `cd frontend && npm run build` → **통과** (tsc + vite, 청크 크기 경고는 기존부터 존재)
- 실행 명령: `cd frontend && npm run lint` → 에러 0, 경고 2 (모두 미변경 파일 TransactionsPage.tsx의 기존 경고)
- 실행 명령: `python -m compileall app alembic/versions` → 통과
- 실행 명령: `docker compose up -d --build backend frontend` → **마이그레이션 0006→0007 정상 적용** (로그 확인). 적용 전 예산 3건 중 `생활>생필품`(소분류) 1건 삭제, '미분류' 2건은 `생활`/`식비` 대분류로 백필됨 (DB 직접 조회로 확인)
- API 검증 (curl/Invoke-WebRequest):
  - `POST /api/v1/budgets {major:"교통"}` → 201 (교통은 '미분류' 소분류 행이 없는 대분류 — 대표 행 불필요 확인)
  - 동일 요청 재호출 → 409
  - `{major:"급여"}`(수입 전용) → 422, `{major:"없는대분류"}` → 422
  - 식비 예산 + `식비>배달` 12,000 / `식비>식재료` 30,000 거래 생성 후 dashboard → `{"major":"식비","spent":42000}` (소분류 합산 확인, DB 합계와 일치)
  - `member_id=1` 필터 → `spent:12000` (구성원 필터 유지 확인)
  - 검증용 거래 2건·예산 2건은 검증 후 삭제 (DB는 마이그레이션 직후 상태)

## 성공 기준 자가 체크
- [x] AC-1: 대분류 단위 입력, 비지출/미존재 대분류 422 — API 호출로 확인 (위 검증 결과)
- [x] AC-2: (연월, 대분류) 중복 409 — API 호출로 확인
- [x] AC-3: spent가 대분류 아래 모든 소분류 합산, member 필터 유지 — API 호출 + DB 합계 대조로 확인
- [x] AC-4 (개정판 기준): 소분류 지정 예산 삭제 + '미분류' 예산 백필 — DB 조회로 확인, research.md AC-4를 결정 출처와 함께 개정해 계약·구현 일치
- [ ] AC-5: 예산 페이지 대분류 목록·CRUD — 코드 구현 완료, npm build 통과. 브라우저 실확인은 /qa에 위임
- [ ] AC-6: 대시보드 위젯 대분류 표시·색상 매핑 — 코드 구현 완료. 브라우저 실확인은 /qa에 위임
- [ ] AC-7: 375px 모바일 — 2차에서 모바일 전용 레이아웃 적용(현재 예산 컬럼 통합·고정폭 축소). 브라우저 실확인은 /qa에 위임
- [x] AC-8: `npm run build` 통과 (2차 수정 후 재실행 — tsc+vite 통과, lint 에러 0/경고 2는 별개 작업 파일)

## 보류/미완 항목
- AC-5~7의 브라우저 실측 검증 — /qa 단계에서 수행 (스택은 http://localhost:3000 에 2차 변경 반영 재빌드 완료). 직전 /qa 환경에 브라우저 도구가 없었으므로, 브라우저 도구(Chrome MCP) 가용 환경에서 /qa 실행 필요
- 커밋 시 별개 작업(2026-06-12-assets-page-horizontal-scroll)의 변경 파일(EChart.tsx/AppLayout.tsx/TransactionsPage.tsx)과 스코프 분리 필요
