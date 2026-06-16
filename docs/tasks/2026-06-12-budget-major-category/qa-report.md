# QA Report: 예산을 지출 대분류 단위로만 설정·집계 (3차)

- 날짜: 2026-06-12
- 작업 폴더: docs/tasks/2026-06-12-budget-major-category
- 판정: CONDITIONAL PASS

## 평가 범위 메모
- 기능 로직은 커밋 `7f27582`/`85aa168`에 반영되어 있고, 현재 워킹 트리의 미커밋 변경은 2차 폴리시(`backend/app/schemas.py`의 strip 검증 + `frontend/src/pages/BudgetsPage.tsx` 모바일 레이아웃)이다. 두 영역 모두 평가했다.
- 동적 검증은 이미 기동 중인 docker compose 스택(backend:8000, frontend:3000, db)을 재사용했다. 서빙 코드가 워킹 트리와 일치함을 교차 확인: backend 컨테이너에 `strip_major` 존재(alembic head=0007), frontend 번들(`/static/index-CIfJ38-s.js`)에 "지출 대분류"·"hidden sm:table-cell" 포함.

## 성공 기준 채점
- ✅ AC-1: `POST /api/v1/budgets` 직접 호출 — `{major:"교통"}`→201, `{major:"급여"}`(수입 전용)→422("예산은 지출 대분류에만 설정할 수 있습니다"), `{major:"없는대분류"}`→422. 근거: `routers/budgets.py:28-34`의 expense 카테고리 존재 쿼리.
- ✅ AC-2: 동일 `(2099-01,"교통")` 재호출 → 409("...해당 대분류 예산이 이미 존재합니다"). `uq_budgets_month_major` 유니크가 DB에 존재함을 `\d budgets`로 확인.
- ✅ AC-3: 식비 예산 + `식비>배달`(member1, 12000) + `식비>식재료`(member2, 30000) 거래 생성 후 `GET /analytics/dashboard?month=2099-04` → 식비 spent=42000(소분류 합산). `member_id=1`→12000, `member_id=2`→30000. `analytics.py:52-77`의 대분류 group by + member 필터(`in_month`) 적용 확인.
- ✅ AC-4: 마이그레이션 적용 후 DB 상태 직접 조회 — `budgets` 테이블에 `category_id` 컬럼/FK 없음, `major` NOT NULL, `uq_budgets_month_major` 존재. 잔존 예산 2건(2026-05 생활/식비) 모두 유효한 expense 대분류이며 소분류 유래 행 없음. 마이그레이션 코드(`0007:26-46`)는 `minor<>'미분류'` DELETE 후 나머지 major 백필 — 로직상 AC-4 부합. 단, 마이그레이션은 이미 1회 적용되어 pre-state 재현 불가(결과 상태로 교차 확인).
- ✅ AC-5: 브라우저 실측(localhost:3000/budgets). 행은 지출 대분류만 나열(교통·구독·금융·생활·식비·미분류·자동차…), 소분류 행 없음. 2026-06에서 교통 77000 저장→현재 예산 77,000원·총예산 갱신·삭제 아이콘 표시 확인, 삭제→0원 복귀. create/update/delete 전 과정 동작. 콘솔 에러 0.
- ✅ AC-6: 브라우저 실측(2026-05 대시보드). 예산 위젯 범례 생활(rose)·식비(orange) 색이 하단 카테고리 트리맵의 동일 대분류 타일 색과 일치. `DashboardPage.tsx:81-86`이 `expense_by_category.category_name`(=major) 기준 `colorByName`을 만들고 위젯이 `b.major`로 조회 — 키 일치.
- ⚠️ AC-7: 정적 검증만 수행. 코드상 모바일 위험 요소 없음(고정폭은 헤더 `w-24`뿐, 입력 컬럼 `w-28 sm:w-64` 반응형, '현재 예산' `hidden sm:table-cell`+모바일 보조줄 `sm:hidden`, 테이블은 ScrollArea로 가로 오버플로 격리, AppLayout `min-w-0`로 가로 스크롤 데드락 방지). **375px 동적 실측은 환경 제약으로 미수행** — 미확인 사실로 명시(아래 시나리오 참조).
- ✅ AC-8: `cd frontend && npm run build`(tsc+vite) 통과. 기존 청크 크기 경고만 출력(신규 에러 없음). build는 `dist/`(gitignore)에만 기록 — 추적 파일 오염 없음.

## 검증 시나리오
- API: AC-1~3 curl 호출 전부 sandbox 월(2099-01~04)에서 수행 후 생성한 예산 3건·거래 2건 전부 DELETE, DB에 2099-* 잔존 0건 확인.
- 브라우저 CRUD: 2026-06에서 교통 예산 생성→삭제로 원복, DB 최종 상태 2026-05 생활/식비 2건만 남음(테스트 데이터 청소 완료).
- 엣지: 공백 패딩 `" 교통 "`→201이며 major가 `"교통"`으로 정규화 저장(2차 strip 검증), 공백만 `"   "`→422(한국어 메시지). `gt=0`/`min_length=1` 스키마 검증 동작.
- AC-7 동적 미확인 사유: `resize_window`를 375/390px로 반복 호출했으나 실제 뷰포트가 1623x750에서 축소되지 않음(OS 창 최소폭 제약, DevTools 기기 에뮬레이션 도구 부재). 375px 가로 스크롤/겹침/잘림을 실측하지 못함. 정적 분석으로 위험 요소는 발견되지 않았으나 동적 확정은 불가.

## 발견 이슈
- [Medium] 워킹 트리 스코프 오염 / 미커밋 의존성 — `frontend/src/components/ui/table.tsx`(working `M`)가 `@/components/ui/scroll-area.tsx`를 import하는데 후자는 **untracked(미커밋)** 이다(HEAD의 table.tsx에는 scroll-area 참조 없음). 추가로 `AssetsPage.tsx`/`DashboardPage.tsx`/`TransactionsPage.tsx`도 working `M` 상태. 이는 별개 작업(`2026-06-12-replace-native-scroll-with-scrollarea`)이 같은 트리에 섞인 것으로, 예산 작업만 커밋하면 빌드가 미추적 `scroll-area.tsx`에 암묵 의존하게 되는 커밋 해저드. 현재 빌드 통과는 로컬 디스크에 파일이 존재하기 때문일 뿐. /git-commit 전 스코프 분리 필요. (implementation.md도 스코프 혼재를 Medium으로 자체 인지함.)
- [Low] `backend/alembic/versions/0007_budget_major_only.py:33-41` — 백필 UPDATE가 `categories`와 조인되는 행만 major를 채운다. `category_id`가 이미 삭제된 카테고리를 가리키는 고아 예산이 있으면 DELETE(`minor<>'미분류'`, 조인 실패 시 미삭제)·UPDATE 모두 건너뛰어 major가 NULL로 남고 `alter_column nullable=False`(`:41`)에서 마이그레이션이 실패한다. 현재 데이터엔 고아 행이 없어 재현되지 않음(category FK가 RESTRICT라 실제 발생 가능성 낮음).
- [Low] AC-7 375px 모바일을 동적으로 확정하지 못함(환경 제약). 정적 근거는 충분하나 실측 미수행 — 기기 에뮬레이션 가능 환경에서 확인 권장.

## 수정 Action Items (CONDITIONAL 해소용)
- [ ] /git-commit 시 예산 작업 파일(`backend/app/schemas.py`, `frontend/src/pages/BudgetsPage.tsx`, 기 커밋된 backend/frontend 변경)과 scroll-area 작업 파일(`table.tsx`, `scroll-area.tsx`, `AssetsPage.tsx`, `DashboardPage.tsx`의 scroll diff, `TransactionsPage.tsx`)을 **별도 커밋으로 분리**. 예산 작업 단독 커밋이 미추적 `scroll-area.tsx` 없이 빌드되는지 확인하거나, scroll-area 작업을 먼저/함께 커밋해 의존성 누락 방지.
- [ ] (선택, Low) 0007 마이그레이션 백필 후 `major IS NULL` 잔존 행을 명시적으로 DELETE하거나 가드를 추가해 고아 예산에서의 NOT NULL 실패를 예방.

## 다음 단계
CONDITIONAL PASS — 기능 AC(1~6,8)는 모두 직접 확인으로 충족, AC-7은 정적으로만 점검(환경상 375px 동적 미확인). 핵심 결함은 없으나 커밋 스코프/미추적 의존성 정리가 필요하다. `/git-commit` 단계에서 스코프 분리 커밋으로 처리하면 되고(코드 수정이 필요하면 `/implement docs/tasks/2026-06-12-budget-major-category` 후 /qa 재실행), 가능하면 375px 동적 실측을 포함해 재검증을 권장한다.
