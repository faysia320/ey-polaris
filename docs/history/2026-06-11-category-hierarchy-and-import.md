# 작업 이력: 카테고리 대/소분류 개편 + 뱅크샐러드 엑셀 월별 업로드

- **날짜**: 2026-06-11
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

카테고리 기준정보를 뱅크샐러드 엑셀("가계부 내역")과 완전 일치하는 대분류/소분류 2단계 체계로 개편하고(마이그레이션 0004: 재시드 + 기존 거래·예산 재매핑), 매달 엑셀에서 지정 월만 가져오는 업로드 기능을 추가했다. 이체는 스킵(이중 계산 방지), 환불(지출+양수)은 수입 '환불' 카테고리로 반영하며 재업로드 시 가져오기 출처 거래만 교체되어 수동 입력이 보존된다.

## 변경 파일 목록

- `backend/app/models.py` - Category major/minor 구조, Transaction.source 추가
- `backend/alembic/versions/0004_category_hierarchy_and_import.py` - 구조 전환·엑셀 전수 재시드·재매핑 마이그레이션
- `backend/app/excel_import.py` - 엑셀 파서(신규)
- `backend/app/routers/transactions.py` - POST /transactions/import, major 필터
- `backend/app/{schemas.py, routers/{categories,analytics,budgets}.py}` - 2단계 대응·대분류 집계·ImportResult
- `backend/requirements.txt` - openpyxl, python-multipart
- `frontend/src/pages/{TransactionsPage,SettingsPage,BudgetsPage}.tsx` - 2단계 셀렉트·필터, 업로드 다이얼로그, 대/소분류 관리
- `frontend/src/{types.ts, lib/{api,format}.ts, stores/{masterData,transactions}.ts}` - 타입·multipart·라벨 헬퍼·필터
- `.gitignore` - 개인 금융 데이터(*.xlsx) 커밋 금지

## 상세 변경 내용

상세: [docs/tasks/2026-06-11-category-hierarchy-and-import](../tasks/2026-06-11-category-hierarchy-and-import/) (research/implementation/qa-report) 및 선행 조사 [docs/tasks/2026-06-11-monthly-excel-import](../tasks/2026-06-11-monthly-excel-import/) 참조.

## 테스트 방법

1. `docker compose up -d --build` 후 거래 페이지 → "엑셀 업로드"로 뱅크샐러드 xlsx와 월 선택 → 결과 요약(등록/교체/건너뜀) 확인
2. 같은 월 재업로드 시 중복 누적 없음, 수동 입력 거래 보존 확인
3. QA 상세 절차: qa-report.md 참조 (AC 13/13 PASS)
