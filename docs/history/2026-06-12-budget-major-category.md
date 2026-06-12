# 작업 이력: 예산을 지출 대분류 단위로만 설정·집계

- **날짜**: 2026-06-12
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

예산의 키를 소분류(category_id FK)에서 지출 대분류(major 문자열)로 개편했다. 마이그레이션 0007이 기존 소분류 지정 예산을 삭제하고 '미분류' 예산을 대분류로 백필하며, spent 집계는 대분류 아래 모든 소분류 합산으로 동작한다(구성원 필터 유지). 예산/대시보드 UI도 대분류 행 기준으로 변경.

## 변경 파일 목록

- `backend/alembic/versions/0007_budget_major_only.py` - budgets.major 추가, category_id/FK 제거, (year_month, major) 유니크
- `backend/app/models.py`, `schemas.py` - Budget을 major 키 기반으로 변경
- `backend/app/routers/budgets.py` - 생성 검증을 "해당 major의 expense 카테고리 존재"로 교체
- `backend/app/routers/analytics.py` - 예산 spent를 대분류 집계(expense_rows) 재사용으로 산출
- `backend/app/routers/categories.py` - 삭제 409 메시지에서 '예산' 문구 제거
- `frontend/src/types.ts`, `stores/budgets.ts`, `pages/BudgetsPage.tsx`, `pages/DashboardPage.tsx` - major 기반 타입·CRUD·위젯

## 상세 변경 내용

상세: [docs/tasks/2026-06-12-budget-major-category](../tasks/2026-06-12-budget-major-category/) 참조 (research.md / implementation.md)

## 테스트 방법

- `docker compose up -d --build backend` 후 마이그레이션 0006→0007 적용 로그 확인
- `POST /api/v1/budgets {major:"교통"}` 201 / 중복 409 / 수입·미존재 대분류 422
- 대분류 아래 소분류 거래 합산이 dashboard `budgets[].spent`에 반영되는지 확인 (구현 단계 API 검증 완료, 브라우저 확인은 /qa 미수행 상태)
