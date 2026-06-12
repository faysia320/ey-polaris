# QA Report: 대시보드 개편 — 카드 정리, 소진율 스택바, 카테고리별 지출 풀폭·드릴다운·가독성 개선 (3차 QA)

- 날짜: 2026-06-12
- 작업 폴더: docs/tasks/2026-06-12-dashboard-redesign
- 판정: PASS
- 차수: 3차 — 2차 QA(CONDITIONAL PASS: Medium 1 = 모바일 AC 계약 누락, Low 2) 후 3차 수정분 재평가. 이전 이슈는 아래와 같이 **모두 해소 확인**.

## 이전 차수 이슈 수정 확인 (재검증)

- ✅ [Medium→해결] 모바일 AC 계약 누락 — `research.md`에 AC-11(375px) 추가 확인(53행). 구현도 동반: `DashboardPage.tsx:167` 헤더 행 `flex flex-wrap … gap-y-3`, `AppLayout.tsx` 사이드바 `hidden md:flex` + 모바일 하단 내비(`fixed inset-x-0 bottom-0 z-40 … md:hidden`) + `main` `p-4 pb-20 md:ml-60 md:p-8`. 상세 검증은 AC-11 참조.
- ✅ [Low→해결] 라벨 대비 임계값 — `DashboardPage.tsx:45` 임계 0.6→0.5. 팔레트 11색 전수 검산(스크립트 직접 실행): 이제 전 색이 어두운 라벨(`#1f2329`)을 받으며 대비 4.42~11.46:1. 2차 QA에서 지적한 4색(#73a373 2.5→5.42, #759aa0 2.6→5.17, #dd6b66 2.8→4.79, #7289ab 3.1→4.42) 모두 개선. (#7289ab만 AA 4.5:1에 근소 미달 — Low 참조)
- ✅ [Low→해결] 헤더 행 375px — `flex-wrap gap-y-3`로 2줄 줄바꿈 허용. 수치 검산: 컨트롤 그룹(아이콘 버튼 36×2 + 월 표시 `w-24` 96 + gap 24 + 구성원 셀렉트 `w-32` 128 ≈ 320px) + 제목 ≈ 416px > 콘텐츠 343px(375−p-4×2) → 줄바꿈 발동, 겹침 없음.
- ➖ [Low→이월] `fetchDashboard` stale 응답 가드 — 미적용(`DashboardPage.tsx:74-78`, `stores/analytics.ts`). 2차 QA에서 "기존 코드 사항, 별도 과제 분리 무방"으로 명시한 선택 항목이므로 Low로 유지(판정 비차단).

## 성공 기준 채점

- ✅ AC-1: "최근 거래" 카드 미렌더링 — `DashboardPage.tsx` 전체 읽기로 JSX 부재 확인. 백엔드 응답에서도 제거(live `GET /analytics/dashboard?month=2026-05` 키 목록에 `recent_transactions` 부재), 서빙 번들 grep 0건.
- ✅ AC-2: "카테고리별 예산 진행" 카드 미렌더링 — 전체 읽기로 부재 확인. `budgets`는 소진율 카드(스택바·범례)에서만 사용.
- ✅ AC-3: 소진율 스택바 — 세그먼트 폭 `spent / max(budget_total, budget_spent)`(224행), `title` 툴팁 + 색점·이름·spent/amount 범례(233-259행). live 데이터(2026-06: budget_total 100,000 / 생활 > 생필품) 정합 확인. 브라우저 렌더링은 implementation.md 2·3차 실확인 기록을 정황 증거로 채택(수치가 내 독립 API 검증과 일치).
- ✅ AC-4: 예산 없는 월 — `budgetTotal > 0 ? % : '—'`(215행), `stackDenom > 0` 가드(224행), 범례 조건부(233행). live 2026-05: `budget_total=0, budgets=[]` → 세그먼트·범례 미렌더, 0 나눗셈 경로 없음.
- ✅ AC-5: 풀폭 — 2열 그리드 부재, 트리맵 카드가 `space-y-6` 루트 직계 단독 섹션(264-277행), 높이 400.
- ✅ AC-6: 드릴다운 — `handleTreemapClick`(seriesType·name 가드) → `GET /transactions?month=&kind=expense&major=(&member_id=)` → Dialog(날짜·소분류·메모·금액 + 월·건수·합계). live 재검증: 생활 20건/2,360,820원, 미분류 6건/1,363,405원 = 트리맵 집계와 정확히 일치. member_id=1 교차(대시보드 빈 집계 ↔ 드릴다운 0건) 일관. 응답 날짜 내림차순 정렬 확인.
- ✅ AC-7: 명시적 11색 팔레트 + 휘도 라벨(임계 0.5) + 테두리 `#171717`. 전 색 대비 검산 결과 최소 4.42:1(종전 최악 2.5:1 → 명백 개선).
- ✅ AC-8: 조회 실패 시 Dialog 내 에러 문구(290-294행), try/catch + seq 가드로 페이지 비파괴. live 엣지: 없는 major → `[]`(빈 상태 문구 경로), `month=BAD` → 422.
- ✅ AC-9: `EChart.onClick` 옵셔널(미지정 시 바인딩만 no-op) — 사용처 grep 2곳, `AssetsPage.tsx:342`는 onClick 미전달로 무영향. `GET /analytics/assets` 200 확인, 빌드 통과.
- ✅ AC-10: `npm run lint` → 0 errors(경고 2건은 `TransactionsPage.tsx` 기존 건), `npm run build` → 통과(✓ built in 1.03s) — 모두 직접 실행.
- ✅ AC-11: 모바일 375px — (정적, 전수) 헤더 `flex-wrap`(수치 검산상 2줄 줄바꿈), 요약 카드 `grid-cols-1 md:grid-cols-3`, 스택바 % 폭, 범례 `min-w-0/truncate/shrink-0`, Dialog `max-w-[calc(100%-2rem)]`(모바일) + 내부 `max-h-80 overflow-y-auto`, 트리맵 ResizeObserver, 사이드바 `hidden md:flex`로 240px 압착 해소, 하단 내비 5항목 flex-1(≈75px/항목, 라벨 11px 한 줄, 터치 영역 ≈75×56px), `main pb-20`(80px)으로 내비(≈56px) 가림 방지, Dialog z-50 > 내비 z-40. 고정폭 초과 요소 미발견. (동적) 브라우저 도구 부재로 픽셀 검증은 불가 — implementation.md 3차의 실측 기록(scrollWidth 360 ≤ 375, Dialog 화면 내 표시, 데스크톱 1528px 회귀 확인)이 내 정적 검산과 모두 부합해 채택. 동적 미확인 사실은 제약으로 명시.

## 검증 시나리오

- `npm run lint` / `npm run build` (frontend) — 직접 실행, 통과 (0 errors / built 1.03s)
- `python -m py_compile app/routers/analytics.py app/schemas.py` (backend) — exit 0. 백엔드 테스트 스위트 부재(tests 폴더 없음)
- **서빙 코드 = 작업 트리 검증**: 컨테이너 가동 확인(frontend 5분 전 재기동) 후 서빙 번들 해시 `index-C4CxnXRX.js`가 내 로컬 빌드 산출물 해시와 **일치**. 번들 grep: `recent_transactions` 0건, 신규 에러 문자열 1건
- live API: 대시보드 2026-05(예산 없음)/2026-06(예산 있음)/member_id=1, 드릴다운 생활(20건/2,360,820)·미분류(6건/1,363,405)·없는 major(`[]`)·`month=BAD`(422)·member_id 필터(0건) — 모두 기대대로
- 라벨 대비: 팔레트 11색 × 임계 0.5 분기 × WCAG 대비비를 스크립트로 전수 검산(레포 외 stdin 실행, 파일 생성 없음)
- 375px 수치 검산: 헤더 행 폭 합산, 하단 내비 항목 폭/높이, `pb-20` vs 내비 높이, z-index 충돌(Dialog 50 > nav 40) — 상기 AC-11 참조
- **제약**: 브라우저 자동화 도구가 없어 시각 렌더링·실클릭·375px 뷰포트는 동적 미확인. implementation.md의 브라우저 기록은 자가 보고이나, 검증 가능한 수치(드릴다운 20건/2,360,820원 등)가 내 독립 API 검증과 일치해 정황상 신뢰하고 정적 검산을 병행함
- QA 종료 시 `git status`로 레포 무변경 확인(빌드 산출물 `dist/`는 gitignore)

## 발견 이슈

- [Low] `frontend/src/pages/DashboardPage.tsx:45` — `#7289ab` 블록의 어두운 라벨 대비 4.42:1로 WCAG AA(4.5:1, 13px 일반 텍스트) 근소 미달. 단 밝은 라벨 대안(3.1:1)보다 우수하고 종전 최악(2.5:1) 대비 명백 개선이라 AC-7 충족 판정에는 영향 없음. 완전 해소하려면 해당 색만 라벨 `#15181d`급으로 더 어둡게 하거나 팔레트에서 교체.
- [Low] `frontend/src/stores/analytics.ts:17-22` + `DashboardPage.tsx:74-78` — (기존 코드, 2차 QA Low 이월) `fetchDashboard` stale 응답 가드 부재. 월/구성원 빠른 연속 변경 시 늦은 응답·실패가 최신 화면을 덮어쓸 수 있음. 드릴다운에 적용된 seq 가드와 동일 패턴 적용 가능 — 별도 과제 분리 무방.
- [Low] `frontend/src/components/layout/AppLayout.tsx:51` — 모바일 하단 내비에 iOS 안전 영역(`env(safe-area-inset-bottom)`) 미반영. 홈 인디케이터 기기에서 하단 터치 영역이 제스처 바와 일부 겹칠 수 있음. CLAUDE.md 375px 기준(가로 스크롤·겹침·잘림)의 명시 요건은 아니므로 Low. `pb-[env(safe-area-inset-bottom)]` 추가로 해소 가능.
- 참고(이슈 아님): 작업 트리에 본 과제와 무관한 변경(`.claude/skills/*`, `CLAUDE.md`, transfer/import/card 관련 3개 과제 파일 — `models.py`, `transactions.py`, `excel_import.py`, `TransactionsPage.tsx` 대부분 등)이 섞여 있음. 커밋 시 과제별 분리 권장(1·2차 보고서 동일 지적 유지). 본 평가는 dashboard-redesign 해당분(DashboardPage·EChart·AppLayout·types.ts/schemas.py/analytics.py의 recent_transactions 제거)만 채점.

## 수정 Action Items

- 없음 (판정 비차단 Low 3건은 후속 과제로 선택 처리 — 위 발견 이슈 참조)

## 다음 단계

/git-commit 진행 가능. 단, 작업 트리에 4개 과제 변경이 혼재하므로 dashboard-redesign 해당 파일만 선별 커밋하거나 과제별 순차 커밋을 권장.
