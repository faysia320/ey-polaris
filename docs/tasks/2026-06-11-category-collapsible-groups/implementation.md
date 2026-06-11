# Implementation: 기준정보관리 > 카테고리 — 대분류별 접기/펼치기

- 날짜: 2026-06-11
- 기반 명세: docs/tasks/2026-06-11-category-collapsible-groups/research.md

## 변경 파일
- `frontend/src/pages/SettingsPage.tsx` — `CategoriesTab`에 (kind, major) 그룹핑·접힘 상태(Set)·그룹 헤더 행(셰브론+대분류명+구분 배지+소분류 개수, 클릭 토글)을 추가하고 기존 `·` 의사 그룹 표시를 제거. `Fragment`, `ChevronDown`, `ChevronRight` import 추가.

## 주요 결정
- 백엔드가 `kind → major → minor` 순으로 정렬해 응답하므로(`backend/app/routers/categories.py:14-18`) 프런트에서 재정렬 없이 연속 구간을 그대로 그룹으로 묶었다.
- 접힘 상태는 `"{kind}:{major}"` 문자열 키의 `Set<string>`으로 관리. 기본값 빈 Set = 전체 펼침(AC-4). CRUD 후 `fetchAll()`로 배열이 교체되어도 이름 기반 키라 상태가 유지된다(AC-5).
- 그룹 헤더 행은 `colSpan={5}` 단일 셀로 구현하고 행 전체를 클릭 영역으로 했다(`cursor-pointer`, `bg-muted/50`). 별도 collapsible 컴포넌트나 라이브러리는 추가하지 않았다.
- 소분류 행의 대분류 열은 빈 셀로 두었다(구현 재량 항목). 소분류·구분·성격·행 액션 열은 기존과 동일하게 유지(AC-6).
- 구분 배지는 그룹 헤더에도 표시하지만, 명세가 소분류 행의 기존 열 유지를 요구하므로 소분류 행에서도 그대로 둔다.

## 자체 검증 결과
- 실행 명령: `npm run build` (tsc -b && vite build) → **통과** (✓ built in 925ms; 청크 크기 경고는 기존부터 존재하는 빌드 정보성 경고)
- 실행 명령: `npm run lint` → **통과** (오류 0건, 경고 2건 — `useReactTable` 관련으로 이번 변경과 무관한 다른 파일의 기존 경고. SettingsPage는 TanStack Table 미사용)
- 자동 테스트 스위트는 프로젝트에 없음 (`package.json` scripts: dev/build/lint/preview만 존재)

## 성공 기준 자가 체크
- [x] AC-1: groups 파생 데이터로 (kind, major)마다 헤더 행 1개 렌더링 — 대분류명·구분 배지·`소분류 N개` 표시 포함
- [x] AC-2: 헤더 행 `onClick={() => toggleGroup(g.key)}`, 펼침 시 ChevronDown / 접힘 시 ChevronRight, `!isCollapsed`일 때만 소분류 행 렌더링
- [x] AC-3: 키 단위 Set 토글이므로 그룹별 독립 상태
- [x] AC-4: `collapsed` 초기값이 빈 Set → 최초 진입 시 전체 펼침
- [x] AC-5: `"{kind}:{major}"` 이름 기반 키라 fetchAll로 배열이 교체돼도 접힘 상태 유지
- [x] AC-6: 소분류 행의 RowActions(수정/삭제)·추가 다이얼로그 코드는 변경하지 않음
- [x] AC-7: 키에 kind가 포함되고 그룹핑 조건도 `major && kind` 동시 비교 → 같은 이름이라도 구분이 다르면 별개 그룹
- [x] AC-8: `npm run build` 통과

※ AC-1~7의 브라우저 육안 확인은 수행하지 못했다(개발 서버 미기동). 코드 수준 근거만 기재했으며 최종 판정은 /qa에 위임한다.

## 보류/미완 항목
- 없음
