# 작업 이력: 날짜·월 입력을 shadcn 피커로 교체

- **날짜**: 2026-06-11
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

네이티브 `<input type="date">`/`<input type="month">`를 shadcn 스타일 DatePicker(Popover+Calendar, react-day-picker)·커스텀 MonthPicker(연도 내비게이션+12개월 그리드)로 교체. 문자열 value/onChange 인터페이스를 유지해 페이지 상태·제출 로직은 변경하지 않았다.

## 변경 파일 목록

- `frontend/package.json`, `frontend/package-lock.json` - `react-day-picker`, `date-fns` 추가
- `frontend/src/components/ui/popover.tsx`, `calendar.tsx` - 신규 (shadcn CLI 생성, calendar는 타입 키 1건 수정)
- `frontend/src/components/ui/date-picker.tsx`, `month-picker.tsx` - 신규 공용 래퍼 컴포넌트
- `frontend/src/pages/TransactionsPage.tsx` - 거래 날짜·조회 월 필터·가져올 월 입력 교체
- `frontend/src/pages/AssetsPage.tsx` - 평가 기준일(미래 비활성)·목표일(해제 가능) 입력 교체

## 상세 변경 내용

상세: [docs/tasks/2026-06-11-shadcn-date-picker](../tasks/2026-06-11-shadcn-date-picker/) 참조

## 테스트 방법

- `npm run build` (tsc 포함) 통과
- 수동: 거래 등록 날짜, 조회 월(전체 기간 해제), 엑셀 업로드 월, 자산 평가 기준일(미래 선택 불가), 목표일(선택 해제) 각 피커 동작 확인
