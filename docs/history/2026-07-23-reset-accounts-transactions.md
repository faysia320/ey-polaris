# 작업 이력: 자산 계정·입출금 거래 전체 초기화 + 자산 계정 목록 소유자별 정렬

- **날짜**: 2026-07-23
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
당초 "기준정보 자산 계정을 소유자별로 정렬 + 6월 내역 기준 재정리" 요청이 조사 중 방향 전환되어, (1) 자산 계정·입출금 거래·자산 평가를 전량 초기화(1회성 운영 작업)한 뒤 사용자가 엑셀을 재업로드하는 흐름과 (2) 기준정보 관리의 자산 계정 목록을 소유자별로 정렬하는 UI 변경을 수행했다.

## 변경 파일 목록
- `frontend/src/pages/SettingsPage.tsx` - 자산 계정 목록을 소유자 → 유형 → 이름 순으로 정렬(`sortedAccounts` memo) — *별도 커밋*
- `docs/tasks/2026-07-23-reset-accounts-transactions/` - 초기화 작업 파이프라인 산출물(research/implementation/qa)

## 상세 변경 내용
- **데이터 초기화(코드 diff 없음)**: 실행 중 DB에 대해 `TRUNCATE accounts, transactions, asset_valuations RESTART IDENTITY CASCADE` 실행. 삭제 전 accounts 28·transactions 184·asset_valuations 4 → 실행 후 전부 0. members·categories·budgets·goals·app_settings는 보존. 사용자 명시 확인 후 백업 없이 진행. 자세한 조사·구현·QA: [docs/tasks/2026-07-23-reset-accounts-transactions](../tasks/2026-07-23-reset-accounts-transactions/) 참조.
- **자산 계정 목록 정렬**: `AccountsTab`에서 소유자(구성원 이름, ko) → 유형(`ACCOUNT_TYPES` 표시 순) → 이름(ko) 순 표시 전용 정렬 추가. 원본 데이터·다른 로직 불변.

## 테스트 방법
- 초기화 검증: `SELECT count(*)`로 대상 테이블 0, 보존 테이블 불변 확인(QA에서 재현). QA에서 실제 엑셀 재업로드 시 계정 재생성(created_accounts) 확인.
- 정렬 검증: `npm run build`(tsc+vite) EXIT=0, `npm run lint` 에러 0. 계정이 생기면(재업로드) 소유자·유형·이름 순으로 표시.
