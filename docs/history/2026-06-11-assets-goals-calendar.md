# 작업 이력: 주식·부동산 자산 + 목표금액 달성 현황 + 거래 캘린더 뷰

- **날짜**: 2026-06-11
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
가계부 2차 기능 3종 추가. (1) 계정 유형에 주식/부동산을 추가하고 날짜별 평가액 스냅샷으로 잔액·총자산·12개월 추이를 계산(평가액 단독 규칙, 같은 날짜 upsert, 미래 날짜 차단), (2) 목표금액 CRUD와 총자산 대비 달성률 진행바, (3) 지출/수입 내역에 테이블↔캘린더 토글(일자별 수입/지출 합계, 날짜 선택 상세, 연도 경계 월 이동). QA 1차 CONDITIONAL PASS → 이슈 5건(Medium 2, Low 3) 수정 후 재검증 PASS (AC 17/17).

## 변경 파일 목록
- `backend/app/models.py`, `backend/alembic/versions/0003_asset_valuations_and_goals.py` - AssetValuation(계정 FK CASCADE, (계정,날짜) 유니크)·Goal 테이블 추가
- `backend/app/routers/valuations.py`, `goals.py`, `main.py` - `/accounts/{id}/valuations` upsert API, `/goals` CRUD 신설·등록
- `backend/app/routers/analytics.py` - 평가액 있는 계정은 최신 평가액을 잔액으로, trend는 계정·월별 최신 평가액(윈도우 함수) 기반 포인터 워크로 계산
- `backend/app/schemas.py` - AccountType 확장(stock/real_estate), 평가액·목표 스키마, 미래 날짜 422 검증
- `frontend/src/pages/AssetsPage.tsx`, `stores/goals.ts` - 평가액 갱신 다이얼로그, 목표 달성 현황 카드(100% 초과 캡, 인라인 에러)
- `frontend/src/components/transactions/TransactionCalendar.tsx`, `pages/TransactionsPage.tsx` - 월 캘린더 그리드(신규 라이브러리 없음), 뷰 토글·선택일 거래 목록·날짜 프리필
- `frontend/src/types.ts`, `pages/SettingsPage.tsx` - 타입·계정 유형 라벨 확장
- `docs/tasks/2026-06-11-assets-goals-calendar/` - 파이프라인 산출물 (research / implementation / qa-report)

## 상세 변경 내용
상세: [docs/tasks/2026-06-11-assets-goals-calendar](../tasks/2026-06-11-assets-goals-calendar/) 참조 (research.md → implementation.md(2차 수정 포함) → qa-report.md, 판정 PASS)

## 테스트 방법
```
docker compose up --build
# 자산 상태: 주식/부동산 계정 생성 → 평가액 갱신 → 총자산·추이 반영 확인
# 자산 상태: 목표 추가 → 달성률 진행바 확인
# 지출/수입 내역: 캘린더 토글 → 일자별 합계·날짜 클릭 상세 확인
```
