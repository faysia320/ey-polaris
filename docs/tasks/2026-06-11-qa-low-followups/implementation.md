# Implementation: 이전 사이클 QA Low 이슈 3건 후속 개선

- 날짜: 2026-06-11
- 기반 명세: `docs/tasks/2026-06-11-qa-low-followups/research.md`

## 변경 파일
- `frontend/src/pages/AssetsPage.tsx` — (1) `submitValuation`에 빈/공백 금액 가드 추가(`Number` 변환 전 거부, 명시적 0원은 계속 허용). (2) 평가액 갱신 다이얼로그에 평가 이력 섹션 추가: 열 때 `GET /accounts/{id}/valuations` 조회, 기준일·금액·삭제 버튼 목록(최대 높이 스크롤), 삭제 시 `DELETE` 후 이력·자산 동시 재조회, "이력을 모두 삭제하면 거래 기반으로 돌아가요" 안내. 이력 조회/삭제 실패는 다이얼로그 내 `valuationError`로만 표시(페이지 전역 에러로 흘리지 않음).
- `frontend/src/pages/TransactionsPage.tsx` — 캘린더 뷰 월 이동 헤더 아래에 구분/카테고리 필터 활성 시 안내 문구 추가(적용 중인 필터 이름 명시, 예: "지출 · 식비 필터가 적용된 거래만 합산하고 있어요"). 둘 다 "전체"면 미표시.

백엔드 변경 없음 (research.md 확인대로 필요 API 전부 기존재).

## 주요 결정
- **이력 UI 위치**: 별도 다이얼로그 대신 기존 "평가액 갱신" 다이얼로그 안에 통합 — 진입점이 1개로 유지되고 기록·이력·삭제가 한 화면에서 끝남 (research Action Item의 구현 재량 범위).
- **이력 표시 개수**: 전체 표시 + `max-h-40` 스크롤. 가계부 특성상 계정당 이력이 많지 않고, 잘라내면 "모두 삭제로 거래 기반 복귀" 시나리오가 불편해짐.
- **에러 채널**: 이력 조회/삭제 실패를 기존 `valuationError`(다이얼로그 내) 재사용 — 1차 사이클 Medium-2(전역 에러 오염)와 동일 원칙, 상태 추가 최소화.
- **필터 안내 문구**: 동작 변경 없이 안내만 추가 (QA 권고 그대로). 필터 이름을 문구에 포함해 무엇이 적용 중인지 바로 보이게 함.

## 자체 검증 결과
- 실행 명령: `npm run build` (frontend) → **통과** (tsc -b + vite. 500kB 청크 경고는 기존 echarts 번들 경고)
- 실행 명령: `npm run lint` (frontend) → **통과** (에러 0, 경고 1건은 기존 `useReactTable` react-compiler 경고)
- `docker compose up -d --build frontend` → 재빌드·기동 정상 (백엔드는 무변경이라 재빌드 불필요)
- 브라우저 육안 검증은 /qa 단계 몫 — 이번 변경은 전부 프론트엔드 UI이므로 빌드/린트 + 컨테이너 반영까지가 자체 검증 범위

## 성공 기준 자가 체크
- [x] AC-1: 빈/공백 평가액 제출 시 `'평가액을 입력해주세요'` 에러 후 즉시 return — API 호출 코드에 도달하지 않음
- [x] AC-2: 가드가 `trim() === ''`만 거부하므로 명시적 `0` 입력은 기존대로 통과(`value < 0`만 거부)
- [x] AC-3: 다이얼로그 열 때 이력 조회(API가 날짜 내림차순 반환, `valuations.py:18`) 후 기준일·금액 목록 표시
- [x] AC-4: 이력 항목 삭제 버튼 → DELETE 후 `loadValuationHistory` + `fetchAssets` 동시 재조회로 잔액·총자산 갱신
- [x] AC-5: 모든 이력 삭제 시 백엔드가 거래 기반 잔액 + `valued_at: null` 반환(기존 로직) → 카드의 "평가 기준일" 표기는 `a.valued_at` 조건부라 자동 소멸
- [x] AC-6: `(filters.kind || filters.category_id)` 조건부 렌더 — 둘 다 null(전체)이면 미표시
- [x] AC-7: 기록(upsert) 흐름·캘린더 합계·테이블 뷰 로직 미변경(가드 1줄, 이력 섹션·안내 문구는 추가만) — 빌드/린트 통과
- [x] AC-8: `npm run build`·`npm run lint` 통과

## 보류/미완 항목
- 없음
