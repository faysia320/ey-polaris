# 작업 이력: 구성원 필터·자산 유형별 그룹·계정 소유자 필수화

- **날짜**: 2026-06-11
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
대시보드/자산 상태/지출·수입 내역 세 페이지에 구성원 필터(전체/으니/영이) select를 추가하고, 자산 상태의 계정 카드를 유형별 그룹 카드 안에 중첩 정렬했다. 모든 계정에 소유자(member_id)를 필수화하고(마이그레이션 0005, 기존 계정은 으니로 백필), 목표 달성 현황은 부부 공동 목표로서 필터와 무관하게 가구 전체 총자산 기준으로 항상 표시한다.

## 변경 파일 목록
- `backend/app/models.py`, `backend/alembic/versions/0005_account_owner_required.py` - Account.member_id NOT NULL FK + 백필 마이그레이션
- `backend/app/schemas.py`, `backend/app/routers/accounts.py`, `backend/app/routers/members.py` - 계정 소유자 필수 검증·구성원 삭제 차단
- `backend/app/routers/transactions.py` - 엑셀 가져오기 기본 소유자(default_member_id) 파라미터
- `backend/app/routers/analytics.py` - dashboard/assets member_id 필터, assets grand_total 추가
- `frontend/src/stores/memberFilter.ts`, `frontend/src/components/members/MemberFilterSelect.tsx` - 전역 구성원 필터 (신규)
- `frontend/src/stores/{analytics,transactions,masterData}.ts`, `frontend/src/types.ts` - member_id/grand_total 연동
- `frontend/src/pages/{DashboardPage,AssetsPage,TransactionsPage,SettingsPage}.tsx` - select 배치, 유형별 그룹 카드, 소유자 UI, 업로드 기본 소유자

## 상세 변경 내용
상세: [docs/tasks/2026-06-11-assets-grouping-member-filter](../tasks/2026-06-11-assets-grouping-member-filter/) 참조 (research.md / implementation.md / qa-report.md)

## 테스트 방법
- `docker compose up -d --build` 후 http://localhost:3000 접속 — 세 페이지 우측 상단 select로 구성원 전환
- `GET /api/v1/analytics/assets?member_id=N` 으로 소유 계정 필터·grand_total 불변 확인
- QA: 14/14 AC PASS (qa-report.md)
