# Implementation: 대시보드 카테고리별 지출 트리맵 차트 전환

- 날짜: 2026-06-11
- 기반 명세: docs/tasks/2026-06-11-dashboard-category-treemap/research.md

## 변경 파일
- `frontend/src/pages/DashboardPage.tsx` — `donutOption`(pie 시리즈)을 `treemapOption`(treemap 시리즈)으로 교체. 백엔드·타입·스토어 변경 없음 (명세대로).

## 주요 결정
- **데이터 매핑 유지**: 기존 `expense_by_category` → `{name, value}` 매핑을 그대로 재사용. 백엔드는 이미 금액 내림차순 정렬을 제공.
- **단일 레벨 UX**: `roam: false`, `nodeClick: false`, `breadcrumb: { show: false }`로 줌·드릴다운·브레드크럼 비활성화 (AC-3).
- **라벨**: 사각형 안에 `대분류명\n금액(formatKRW)` 표시. 작은 사각형은 ECharts 기본 동작대로 라벨이 잘리지만 툴팁으로 확인 가능.
- **차트 배치는 `left/top/right/bottom: 0`으로 명시**: 처음에 `width/height: '100%'`로 구현했으나, 브라우저 검증에서 트리맵 박스가 캔버스 대비 오프셋되어 우측·하단 노드(교통, 카페/간식, 문화/여가, 의료/건강)가 **잘려서 아예 보이지 않는 버그**를 발견. `left: 0, top: 0, right: 0, bottom: 0` 명시로 교체해 해결 (새로고침 후에도 재현되던 실제 버그였음).
- **색상**: 다크 테마 기본 팔레트가 1레벨 노드에 인덱스 순으로 배정됨을 브라우저로 확인 — 별도 levels 설정 불필요.
- 도넛에 있던 `legend`는 제거 — 트리맵은 사각형 내 라벨이 범례 역할을 대체.

## 자체 검증 결과
- 실행 명령: `npm run lint` → 통과 (0 errors; TransactionsPage 기존 경고 2건은 본 변경과 무관)
- 실행 명령: `npm run build` (tsc -b && vite build) → 통과
- 백엔드: docker-compose로 기동 중인 기존 인스턴스 사용, `GET /api/v1/analytics/dashboard?month=2026-04` 정상 응답(대분류 11종) 확인 — 코드 변경 없음
- 브라우저(vite dev 서버 + Chrome): 아래 자가 체크 참조. 검증 후 dev 서버 종료.

## 성공 기준 자가 체크
- [x] AC-1: 2026-04에서 트리맵 렌더링, 식비(11,653,527원)가 최대 면적으로 표시되고 11개 대분류 전부 표시됨 — 스크린샷 확인
- [x] AC-2: 사각형에 대분류명+금액 라벨, 호버 시 툴팁("식비 11,653,527원", "교통 792,957원" 등 원화 포맷) — 스크린샷 확인
- [x] AC-3: 식비 사각형 클릭 시 줌/드릴다운 없음, 브레드크럼 미표시 — 클릭 후 스크린샷으로 레이아웃 불변 확인
- [x] AC-4: 지출 없는 2026-06에서 "이번 달 지출이 아직 없어요. 맑은 밤하늘이네요 🌌" 빈 상태 유지 — 스크린샷 확인
- [x] AC-5: ◀/▶ 월 이동 시 트리맵 갱신 (2026-04 ↔ 2026-05, 5월은 생활 2,373,165원 최대로 데이터 상이함 확인) — 스크린샷 확인
- [x] AC-6: `git status` 결과 수정 파일은 `frontend/src/pages/DashboardPage.tsx` 1개 — 백엔드 무변경
- [x] AC-7: `npm run build`·`npm run lint` 통과 (최종 코드 기준 재실행)

## 보류/미완 항목
- 없음
