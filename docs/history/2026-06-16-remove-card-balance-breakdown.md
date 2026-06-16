# 작업 이력: 자산 카드의 '잔액 구성' 분해 제거

- **날짜**: 2026-06-16
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

직전 작업에서 추가한 자산 카드의 '잔액 구성'(usage_breakdown) 분해 표시를 제거했다. 카드값 상환(이체)은 '직접 사용' 계정으로만 들어오고 간편결제 채널로는 들어오지 않아 채널 항목이 차감 없이 음수만 누적되는 모순이 있었고, 카드 잔액 자체가 현 시점 누적액이라 분해가 불필요하다는 판단이다. 간편결제(easy_pay) 유형·연결·패스스루 잔액 귀속은 그대로 유지하며, 제거 대상은 분해 "표시"뿐이다.

## 변경 파일 목록

- `backend/app/routers/analytics.py` — usage_breakdown 산출 블록·easy_by_target·분해용 중간 맵 제거. net_by_account(패스스루)는 간결한 라우팅 형태로 복원
- `backend/app/schemas.py` — `UsageSource` 모델·`AccountBalance.usage_breakdown` 필드 제거
- `frontend/src/types.ts` — `UsageSource` 인터페이스·`usage_breakdown` 필드 제거
- `frontend/src/pages/AssetsPage.tsx` — '잔액 구성' 렌더 블록 제거 및 관련 주석 정리

## 상세 변경 내용

상세: [docs/tasks/2026-06-16-remove-card-balance-breakdown](../tasks/2026-06-16-remove-card-balance-breakdown/) 참조 (research.md / implementation.md / qa-report.md).

## 테스트 방법

- `cd frontend && npm run build && npm run lint` 통과
- QA(qa-report.md, CONDITIONAL PASS → Low 주석 이슈 후속 수정 완료): `/analytics/assets` 응답에 `usage_breakdown` 키 부재, `UsageSource` grep 0건, 패스스루 검산(card 잔액 = own + easy_pay 채널 합산 일치) 확인
