# 작업 이력: 모바일 친화성 전방위 개선

- **날짜**: 2026-07-23
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
휴대폰 사용을 전제로 한 앱의 모바일 UI/UX를 전방위 점검하고 개선했다. 기반(뷰포트 메타·모바일 하단 내비·테이블 가로 스크롤·반응형 다이얼로그·차트 폭 대응)은 견고했고, 조작성·가독성 위주로 다음을 개선했다: (1) 작은 아이콘 액션 버튼의 터치 히트영역을 44px로 확대, (2) 필드 많은 거래 추가/수정 다이얼로그에 세로 스크롤 도입, (3) 지출/수입 내역 테이블을 모바일(sm 미만)에서 카드 목록으로 대체, (4) 자산·설정 일부 헤더/행의 좁은 폭 빠듯함 해소, (5) 캘린더 셀 금액 넘침 방지, (6) 팝오버 캘린더 날짜 셀 확대.

## 변경 파일 목록
- `frontend/src/lib/utils.ts` - 공통 `touchTarget` 클래스 추가(시각 크기 유지, 의사요소로 히트영역 44px 확장)
- `frontend/src/components/ui/calendar.tsx` - 팝오버 캘린더 셀 28px→36px 상향
- `frontend/src/pages/TransactionsPage.tsx` - 거래 폼 다이얼로그 세로 스크롤, sm 미만 거래 카드 뷰 신설, 캘린더 일자 목록 오버플로·터치 타깃 개선
- `frontend/src/pages/AssetsPage.tsx` - 목표 헤더/행 줄바꿈·truncate, 목표·평가이력·계정 삭제 버튼 터치 타깃
- `frontend/src/pages/SettingsPage.tsx` - 카테고리 탭 헤더 줄바꿈, 공통 RowActions 버튼 터치 타깃
- `frontend/src/pages/BudgetsPage.tsx` - 예산 행 삭제 버튼 터치 타깃
- `frontend/src/components/transactions/TransactionCalendar.tsx` - 셀 금액 말줄임(`truncate`+`title`)으로 넘침 방지
- `docs/tasks/2026-07-23-mobile-ux-audit/` - 파이프라인 산출물(research·implementation·qa)

## 상세 변경 내용
상세: [docs/tasks/2026-07-23-mobile-ux-audit](../tasks/2026-07-23-mobile-ux-audit/) 참조 (research.md 성공 기준 계약, implementation.md 구현 결정, qa-report.md 채점).

주요 설계 결정:
- 터치 타깃은 `button.tsx` 사이즈 변형을 바꾸지 않고 공통 `touchTarget`(`after:-inset-2`)로 히트영역만 확장 → 데스크톱 레이아웃 회귀 회피. 인접 클러스터는 `gap-2`로 넓혀 오탭 완화.
- 거래 표는 `hidden sm:block`(데스크톱 전용)으로 두고 모바일은 카드 뷰가 대체. 카드는 동일 `table.getRowModel().rows`를 순회해 정렬·페이지네이션이 그대로 반영됨.
- 다이얼로그 세로 스크롤은 앱에 이미 검증된 import 다이얼로그 패턴(`max-h`+`grid-rows`+`ScrollArea`)을 재사용, 공통 `DialogContent` 기본값은 불변으로 두어 다른 다이얼로그 영향 없음.
- 백엔드·API 변경 없음(순수 프론트엔드 표현 계층).

## 테스트 방법
- `cd frontend && npm run build` (tsc + vite) 통과, `npm run lint` 통과(0 errors).
- 375px 실측: 자동화(Chrome MCP) 브라우저가 dev 서버에 네트워크 도달 불가한 환경 제약으로 QA/후속 확인 모두 미수행. 사용자가 로컬 DevTools 기기 모드(375×667)로 오버플로·오탭·다이얼로그 스크롤·모바일 카드 뷰를 확인해 이슈 없음으로 확정.
