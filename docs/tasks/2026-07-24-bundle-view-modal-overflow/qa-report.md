# QA Report: 묶음 보기 모달 콘텐츠 오버플로 수정

- 날짜: 2026-07-24
- 작업 폴더: `C:\WorkSpace\repos\ey-polaris\docs\tasks\2026-07-24-bundle-view-modal-overflow`
- 판정: PASS

평가 대상 변경: `frontend/src/pages/TransactionsPage.tsx:1876` — 묶음 보기 다이얼로그 콘텐츠 wrapper `<div>`에 `min-w-0` 추가 (`space-y-3 text-sm` → `min-w-0 space-y-3 text-sm`). 단일 클래스 추가, 동작 로직 변경 없음.

## 성공 기준 채점

- ✅ **AC-1** (지출/수입 다리 텍스트가 모달을 넘지 않고 말줄임 처리): 실제 앱에서 묶음 보기 모달을 열고 지출/수입 다리 `<p class="truncate">`에 매우 긴 계정명을 주입해 **A/B 실측**. `min-w-0` 없을 때(현재 :3000 dev 서버가 서빙 중이던 구버전 상태) truncate `<p>`가 right=949로 확장되어 모달(right=682)을 267px 뚫고 나감(모달 밖 요소 15개). `min-w-0` 적용 시 truncate가 right=657로 모달 내부에 머물고 오버플로 요소 0개. research.md가 기술한 버그가 재현되고 수정이 해소함을 확인.
- ✅ **AC-2** (카테고리명·금액 겹침 없음, 금액 우측 정렬·미잘림): 375px에서 상단 카테고리 줄에 긴 문자열을 주입해도 금액 `-6,900`이 right=327로 모달(right=351) 내부에 완전히 보이고, 카테고리 span의 right ≤ 금액 span의 left (겹침 없음). 금액은 `shrink-0`으로 우측 고정 유지.
- ✅ **AC-3** (375px 모바일): 레시피 A(iframe 375px)로 **수정된 코드를 서빙하는 신규 dev 서버**(:3007)에 대해 실측. `pageHasHorizontalScroll=false`, `docScrollWidth=375=viewport`, 모달 밖 오버플로 요소 0개(긴 계정명 주입 시에도 0개), wrapper `computedMinWidth=0px`. 모달 left=25/right=351/width=326으로 375px 뷰포트 안에 여백 두고 안착.
- ✅ **AC-4** (기존 동작 회귀 없음): 모달 내 `묶음 해제`·`닫기`·`Close(X)` 버튼 모두 렌더, 효과 요약 문구("지출에서 환불액을 뺀 순지출 0원만 통계에 반영돼요.") 렌더. 모달 열림/닫힘 정상(Escape로 닫힘을 스크린샷으로 확인). 변경이 순수 CSS 클래스 추가라 close/unlink 핸들러(React state `viewOpen`)에 구조적으로 영향 불가. **데이터 보호를 위해 `묶음 해제`(파괴적)는 클릭하지 않음.**
- ✅ **AC-5** (`npm run build` 성공): 직접 실행 → EXIT 0, `✓ built in 1.91s`, 3672 모듈 변환, tsc/vite 오류 없음. 빌드 산출물(`dist/static/index-*.js`)에 수정 클래스 `"min-w-0 space-y-3 text-sm"` 1회 포함, CSS에 `.min-w-0{min-width:0}` 규칙 존재 — 배포 아티팩트에 수정 반영 확인.

## 검증 시나리오

- `cd frontend && npm run build` → EXIT 0 (AC-5). 빌드 1회만 수행.
- `cd frontend && npm run lint` → 0 errors, 2 warnings. 두 경고는 `TransactionsPage.tsx:527`/`:530`(useMemo deps, TanStack useReactTable 비호환 라이브러리)로 **이번 변경과 무관한 기존 경고**. 이 diff는 새 경고 유발 없음.
- API 교차 확인: `GET /api/v1/transactions?limit=1000` → 총 129건, 링크 거래 4건(link_id 7 이체 x2, link_id 8 환불 x2). 긴 계정명 케이스(`우리직장인재테크 저축예금(수수료우대형`, 5천만원 이체 묶음)가 실데이터에 존재함을 확인, AC-1 근거 데이터로 사용.
- 브라우저 E2E: 묶음 보기 모달을 실제로 열어(환불 묶음 행의 눈 아이콘) 데스크톱·375px 양쪽에서 `getBoundingClientRect` 기반 오버플로 실측. 엣지 케이스로 계정명/카테고리명에 초장문 문자열을 DOM 주입(세션 한정, 저장 안 됨)해 truncate 한계 스트레스.
- **A/B 결정 검증**: 동일 모달에서 `min-w-0` 클래스 제거/추가를 토글하며 오버플로 요소 수를 측정 → 제거 시 15개(버그 재현), 추가 시 0개(수정 확인). `min-w-0`이 load-bearing임을 입증.

### 환경 특이사항 (판정에 영향 없음, 근거 보강용 기록)

- 사용자가 기동 중이던 dev 서버(:3000)는 **수정 이전 코드를 서빙**하고 있었음(HMR 미반영). 렌더된 wrapper className이 `space-y-3 text-sm`(min-w-0 없음, computed min-width auto)로 확인됨. 이는 코드 결함이 아니라 서버 stale 상태.
- 이를 우회해 **현재 작업 트리를 서빙하는 신규 dev 서버(:3007)를 별도 포트로 기동**(사용자 :3000 미간섭)하고, 수정 반영(`min-w-0`, computed min-width 0px)을 확인한 뒤 이 서버로 AC-1~4를 실측. 프로덕션 빌드(dist)에도 수정 포함 확인. 검증 후 신규 서버(:3007) 및 임시 preview 서버(:4188) 모두 종료함.
- 브라우저 하네스가 창 크기를 호출 간 915px↔1450px로 임의 변동시켜 좌표 기반 클릭/스크린샷이 불안정했음. 좌표 비의존 방식(DOM 측정, iframe 뷰포트, Escape)으로 우회. 포털된 다이얼로그 콘텐츠에 대한 프로그램적 `.click()`은 React 루트 리스너에 도달하지 못해(포털 이벤트 델리게이션) 닫기 실패로 보였으나, 실제 앱 동작 문제 아님(스크린샷으로 최종 닫힘 확인).
- **QA 도중 작업 트리에 타 태스크 변경 유입(범위 밖)**: QA 시작 시 스냅샷은 `TransactionsPage.tsx` 1줄(`min-w-0`)만 M이었으나, 세션 종료 시점 `git status`에 `TransactionsPage.tsx:590`의 `body.append('member_id', importMemberId)` 추가 및 backend(`models.py`, `accounts.py`, `routers/transactions.py`, 신규 alembic `0012_account_composite_identity.py`) 변경이 함께 존재. 이는 병행 진행 중인 `account-composite-identity` 태스크의 산출물로, **본 QA 대상(묶음 보기 모달 오버플로)과 무관**하며 평가하지 않음. 평가자(본 에이전트)가 만든 변경은 아님(본 에이전트는 research.md·implementation.md 두 문서만 Edit). 커밋 시 태스크 단위로 분리 권장.

## 데이터 영향

- 없음. 검증은 전부 조회/모달 열람이며 파괴적 기능(`묶음 해제`, 엑셀 업로드, 월 전체 삭제)은 실행하지 않음. 검증 전/후 거래 129건·링크 4건 동일. 신규 데이터 생성 없음.

## 발견 이슈

- [Low] `docs/tasks/2026-07-24-bundle-view-modal-overflow/research.md:7`, `implementation.md:10` — 문서가 이 모달의 유효 최대 폭을 `sm:max-w-sm`으로 서술하나, 실제 묶음 보기 `DialogContent`는 `className="sm:max-w-md"`(`TransactionsPage.tsx:1863`)로 오버라이드되어 sm+ 에서 `max-w-md`(448px)임(데스크톱 실측 width=448로 확인). 근본 원인 분석(grid item min-width) 자체는 유효하고 수정 정확성에 영향 없음 — 문서-코드 사실 불일치. (dialog.tsx 기본값을 서술한 `research.md:14`의 `sm:max-w-sm`은 기본 컴포넌트 기준이라 정확함)

## QA 중 적용한 수정 (Low 한정)

- `docs/tasks/2026-07-24-bundle-view-modal-overflow/research.md:7` — 이 모달의 유효 폭 서술을 `sm:max-w-sm` → `sm:max-w-md`로 정정(실제 :1863 오버라이드 반영). 근본 원인/수정 로직 서술은 그대로 유지.
- `docs/tasks/2026-07-24-bundle-view-modal-overflow/implementation.md:10` — "모달 폭(`sm:max-w-sm`)" → "모달 폭(`sm:max-w-md`)"로 정정.
- 수정 후 재검증: 두 수정은 마크다운 문서 전용으로 tsc/vite 빌드·eslint 그래프(`src/`)에 포함되지 않아 회귀 불가. 기저 검증(`npm run build` EXIT 0, `npm run lint` 0 errors)은 이미 green. 소스 코드 미변경.

## 수정 Action Items (FAIL/CONDITIONAL 시)

- 해당 없음 (PASS).

## 다음 단계

PASS — `/git-commit` 진행 가능. (참고: 커밋 후 사용자 dev 서버(:3000)는 stale 상태이므로 재시작하면 최신 수정이 반영됨. 코드 자체는 이상 없음.)
