# QA Report: 기준정보관리 > 카테고리 — 대분류별 접기/펼치기

- 날짜: 2026-06-11
- 작업 폴더: docs/tasks/2026-06-11-category-collapsible-groups
- 판정: PASS

## 성공 기준 채점

- ✅ AC-1: Vite dev 서버(localhost:5175)를 띄워 브라우저로 기준정보 관리 > 카테고리 탭을 직접 확인. (구분, 대분류) 조합마다 그룹 헤더 행 1개(셰브론 + 대분류명 + 수입/지출 배지 + "소분류 N개")가 렌더링됨. 라이브 DB 60건 기준 지출 17개·수입 4개 그룹 모두 정상 표시.
- ✅ AC-2: "교통" 헤더 클릭 → 소분류 3행(철도/택시/대중교통) 숨김 + 셰브론이 ▼→▶로 전환, 재클릭 → 다시 표시 + ▶→▼ 전환을 스크린샷으로 확인.
- ✅ AC-3: "교통"과 "금융"을 각각 접은 상태에서 다른 그룹(구독/생활/식비 등)의 펼침 상태가 변하지 않음을 확인. "교통"만 다시 펼쳐도 "금융"은 접힌 채 유지됨.
- ✅ AC-4: 페이지 새로고침(navigate 재진입) 후 모든 그룹이 펼쳐진 상태로 초기화됨을 확인 (`collapsed` 초기값 빈 Set).
- ✅ AC-5: "금융"을 접은 상태에서 카테고리 추가 2회·수정 1회·삭제 2회(각각 fetchAll로 목록 전체 재조회 발생)를 수행했고, 그 동안 "금융"(및 "QA테스트 지출")의 접힘 상태가 한 번도 풀리지 않음을 확인. `"{kind}:{major}"` 이름 키 기반이라 배열 교체에 영향받지 않음.
- ✅ AC-6: 추가("QA테스트/테스트1" 지출, "QA테스트/테스트수입" 수입), 수정(테스트수입 → 테스트수입수정, 연필 버튼 + 다이얼로그 프리필 정상), 삭제(휴지통 버튼, 두 건 모두) 각각 실제 수행해 정상 동작 확인. 소분류 0개가 된 그룹은 헤더 행도 함께 사라짐(빈 그룹 잔존 없음).
- ✅ AC-7: 대분류 "QA테스트"를 지출/수입 양쪽에 생성 → 별개 그룹 2개로 표시되고, 지출 쪽만 접어도 수입 쪽은 펼쳐진 채 유지됨(독립 토글)을 확인.
- ✅ AC-8: `npm run build`(tsc -b && vite build) 통과 — "✓ built in 1.15s". 청크 500kB 초과 경고는 이번 변경과 무관한 기존 정보성 경고.

## 검증 시나리오

- 정적: `frontend/src/pages/SettingsPage.tsx`의 `CategoriesTab` 전체와 diff, `frontend/src/stores/masterData.ts`(CRUD 후 fetchAll로 배열 교체), `backend/app/routers/categories.py`(`ORDER BY kind, major, minor` → 동일 (kind, major) 행 연속 보장)를 읽어 그룹핑 전제 검증.
- `npm run build` → 통과. `npm run lint` → 오류 0건, 경고 2건(TransactionsPage.tsx의 기존 경고, 이번 변경 파일 아님).
- 동적: 로컬 Vite dev 서버 + 기동 중인 docker backend(localhost:8000, 라이브 DB 60건)로 브라우저(Chrome MCP)에서 AC-1~7 전 항목 실측. 실제 API 응답 순서가 단순 사전순이 아닌 collation(길이 우선처럼 보이는 정렬)임에도 (kind, major) 연속성은 SQL ORDER BY로 보장되어 그룹핑이 깨지지 않음을 실데이터로 확인.
- 콘솔 에러 0건 (`read_console_messages` onlyErrors).
- 검증용으로 생성한 카테고리("QA테스트" 지출/수입 2건)는 검증 후 모두 삭제했고, API 재조회로 60건·QA 잔존 0건 복원 확인. 레포 작업 트리에 임시 파일 생성 없음.
- 엣지 케이스: 같은 대분류명·다른 구분(AC-7), 접힘 상태에서의 CRUD 5회 연속(AC-5), 소분류 1개 그룹 삭제 시 그룹 소멸, 새로고침 후 상태 초기화(AC-4)를 모두 실측.

## 발견 이슈

- [Low] `frontend/src/pages/SettingsPage.tsx:150-153` — 그룹 헤더 행이 `<tr onClick>`만으로 토글되어 키보드 접근이 불가(버튼 role/tabIndex/aria-expanded 없음). AC에 접근성 요구가 없어 Low. 개선 시 셰브론 영역을 `<button>`으로 감싸고 `aria-expanded` 부여 권장.
- [Low] `frontend/src/pages/SettingsPage.tsx:62-70` — 그룹핑이 응답의 연속성에 전적으로 의존. 현재 백엔드 `ORDER BY`가 보장하므로 문제없으나, 정렬이 깨진 응답이 오면 동일 `key`의 그룹이 중복 생성되어 React 중복 key 경고가 발생할 수 있음(방어 코드 없음). 문서화된 전제이므로 Low.
- 참고(이슈 아님): 작업 트리에 다른 작업 폴더(`2026-06-11-shadcn-date-picker`, `2026-06-11-excel-import-transaction-member`) 소속 변경(TransactionsPage.tsx, AssetsPage.tsx, backend/transactions.py, package.json, ui/calendar·date-picker·month-picker·popover.tsx)이 섞여 있음. 본 QA는 해당 변경을 채점 대상에서 제외했으며, 각 작업의 /qa는 별도 수행 필요.

## 수정 Action Items (FAIL/CONDITIONAL 시)

- 해당 없음 (PASS)

## 다음 단계

/git-commit 진행 가능. (단, 작업 트리에 다른 두 작업의 변경이 섞여 있으므로 커밋 분리에 유의)
