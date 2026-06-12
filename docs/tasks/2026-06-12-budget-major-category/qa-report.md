# QA Report: 예산을 지출 대분류 단위로만 설정·집계 (2차)

- 날짜: 2026-06-12
- 작업 폴더: docs/tasks/2026-06-12-budget-major-category
- 판정: **FAIL**

> 2차 평가 주의: 1차 QA(FAIL, 11:26) 이후 **이 작업의 코드·계약 문서가 전혀 수정되지 않은 상태**에서 /qa가 재호출됨 (예산 작업 파일 mtime 11:01~11:03 < 1차 보고서 11:26, research.md 10:56 그대로). 1차 Action Items(계약 갱신 또는 병합 구현, 헤더 라벨)가 미수행이므로 동일 사유로 FAIL이 유지된다. 아래는 1차 보고서를 신뢰하지 않고 전 항목을 독립 재검증한 결과다.

## 성공 기준 채점

- ✅ AC-1: 대분류 단위 입력 + 422 — curl로 직접 확인. `POST /api/v1/budgets {major:"교통"}` → 201(id 10), `{major:"급여"}`(수입 전용) → 422, `{major:"없는대분류"}` → 422, `{major:""}` → 422(pydantic min_length), `" 교통 "`(공백 패딩) → 422.
- ✅ AC-2: 중복 409 — 동일 (2026-09, 교통) 2회 호출 → 두 번째 409 `"2026-09의 해당 대분류 예산이 이미 존재합니다"`.
- ✅ AC-3: 대분류 합산 spent + member 필터 — `교통>철도` 12,000(member 1) + `교통>택시` 30,000(member 2) 거래 생성 후 `GET /analytics/dashboard?month=2026-09` → `{"major":"교통","spent":42000}` (소분류 2종 합산 일치, `expense_by_category`의 교통 42,000과도 일치). `member_id=1` → `spent:12000`. 검증 데이터는 전부 삭제 후 무잔류 확인(`expense_total:0`, budgets 마이그레이션 직후 2건).
- ❌ AC-4: **계약 미충족.** research.md AC-4는 "기존 예산을 유실 없이 보존 — 같은 대분류 소분류 예산 여러 건이면 금액 **합산 병합**, 업그레이드 전후 `budget_total` 동일"인데, `backend/alembic/versions/0007_budget_major_only.py:26-32`는 소분류 지정 예산(`minor <> '미분류'`)을 **DELETE**한다. implementation.md는 "/implement 입력에서 사용자가 삭제 허용"이라 기록했으나 계약 문서(research.md)가 갱신되지 않았고, 독립 평가자로서 구두 결정은 검증 불가 — 문서상 계약 기준 미충족. 마이그레이션 적용 자체는 확인: `alembic current`=0007(head), budgets 스키마 `major NOT NULL` + `uq_budgets_month_major`, '미분류' 예산 2건(생활 2,000,000 / 식비 500,000)이 대분류로 백필되어 존재 (psql 직접 조회).
- ❌ AC-5: 예산 페이지 대분류 목록·CRUD를 "브라우저에서 확인"하는 AC — **브라우저 도구 부재로 실측 불가**(미확인은 충족 증거가 아님). 백엔드 CRUD는 API로 직접 확인(생성 201/수정 200/삭제 204/재삭제 404/미존재 PUT 404). 정적 분석에서 결함 미발견: `BudgetsPage.tsx:32-37` 지출 대분류 고유 목록 ∪ 현재 월 예산 major(옛 이름 예산도 표시·삭제 가능).
- ❌ AC-6: 대시보드 위젯 대분류 표시·색상 일치 — 브라우저 실측 불가로 미확인. 정적·API 확인: `DashboardPage.tsx:81-87` colorByName이 `expense_by_category.category_name`(=major)과 `budgets[].major`를 같은 이름 키로 배색하고, API 응답에서 두 값이 동일("교통")함을 확인 — 로직상 일치.
- ❌ AC-7: 375px 모바일 — 브라우저 실측 불가로 미확인(동적 미확인 명시). 정적 점검: 예산 테이블은 shadcn Table 래퍼(`components/ui/table.tsx:9` `overflow-x-auto`)가 페이지 가로 스크롤을 방지하고, 대시보드 위젯은 % 폭 스택바 + `truncate`/`min-w-0`/`shrink-0` 범례로 이번 diff에 신규 겹침 요인 없음(행 수만 감소).
- ✅ AC-8: `npm run build` → 통과 (tsc + vite, 1,685kB 청크 경고는 기존). `npm run lint` → 에러 0, 경고 2(TransactionsPage.tsx — 이 작업이 아닌 별개 작업의 변경 파일) 직접 실행.

## 검증 시나리오

- 정적: 변경 파일 전체 diff + 신규 마이그레이션 0007 + analytics.py 전문 정독. 백필 충돌 가능성 점검(기존 예산은 expense 검증을 거쳤고 카테고리 유니크로 (year_month, major) 충돌 불가), downgrade 역매핑('미분류' 없는 major는 삭제 — research Action Item의 "구현 재량" 범위) 확인.
- 동적 (docker 스택, alembic 0007 적용 상태): AC-1~3 전부 + 엣지 — `amount:0` → 422, `year_month:"2026-9"` → 422, `" 교통 "` → 422, PUT `amount:-5` → 422, PUT/DELETE 미존재 id → 404, DELETE 재호출 → 404. `GET /budgets?month=` 필터 정상.
- 정리: 검증용 거래 2건·예산 1건 삭제 → `GET /budgets` = 마이그레이션 직후 2건, `dashboard?month=2026-09` expense_total 0 — 무잔류. `git status`로 레포 파일 무변경 확인.
- 빌드/검사: `npm run build` 통과, `npm run lint` 에러 0, backend `python -m compileall app alembic/versions` 통과 (docker exec).
- **불가 항목**: AC-5~7의 브라우저 실측 — 평가 환경에 브라우저 도구 없음(playwright/puppeteer/cypress 미설치, 에이전트 도구셋에도 없음). frontend(:3000)는 HTTP 200으로 기동 확인. 정적 분석 + API 검증으로 대체했고 결함은 못 찾았으나, AC가 명시한 확인 방법을 수행하지 못해 보수적으로 ❌.

## 발견 이슈

- [High] `backend/alembic/versions/0007_budget_major_only.py:26-32` — 계약(AC-4) 위반: 소분류 지정 예산을 합산 병합 대신 DELETE. 실데이터 환경이면 비가역 데이터 유실 마이그레이션. implementation.md의 사용자 승인 주장이 계약 문서에 반영되지 않아 검증 불가. 승인이 사실이면 **코드 수정 없이 research.md AC-4 갱신**으로 해소 가능.
- [Medium] AC-5~7이 요구하는 브라우저 실측이 파이프라인 어느 단계에서도 수행되지 않음 (구현 단계는 /qa에 위임, /qa 환경엔 브라우저 도구 부재) — UI를 아무도 실측하지 않은 채로 남음. 사용자 수동 확인 또는 브라우저 도구 환경에서의 재실행 필요.
- [Medium] 워킹 트리에 **별개 작업의 변경이 혼재** — `EChart.tsx`/`AppLayout.tsx`/`TransactionsPage.tsx`(mtime 11:22~11:23)는 `docs/tasks/2026-06-12-assets-page-horizontal-scroll` 작업 소속으로 이 계약과 무관. /git-commit 시 커밋 스코프 분리 필요 (이 보고서는 해당 3개 파일을 평가하지 않음).
- [Low] `frontend/src/pages/BudgetsPage.tsx:99` — 테이블 헤더가 여전히 "지출 카테고리". 행이 대분류로 바뀌었으므로 "지출 대분류"가 정확 (1차 지적 후 미수정).
- [Low] `frontend/src/pages/BudgetsPage.tsx:101-102` — 입력 컬럼 `w-64`(256px)+`w-32` 고정폭으로 375px에서 내부 가로 스크롤에 의존 (래퍼가 처리하므로 깨짐은 아니나 모바일 퍼스트 관점 개선 여지).
- [Low] `backend/app/routers/budgets.py:23-29` — major 공백 정규화(strip) 없음. 정규 이름만 보내는 프론트에는 영향 없으나 API 직접 호출 시 `" 교통 "`이 일반 422로만 안내됨.

## 수정 Action Items (FAIL/CONDITIONAL 시)

- [ ] AC-4 불일치 해소 (둘 중 하나):
  - (a) 사용자 결정이 맞다면 `research.md` AC-4를 "소분류 지정 예산은 삭제, '미분류' 예산만 대분류 백필"로 갱신해 계약과 구현을 일치 (코드 변경 없음).
  - (b) 원 계약 유지 시 0007을 (year_month, major) 합산 병합으로 수정 — 이미 0007이 적용된 DB가 있으므로 downgrade → 수정 → upgrade 재적용 절차 포함.
- [ ] `BudgetsPage.tsx:99` 헤더 라벨 "지출 카테고리" → "지출 대분류".
- [ ] AC-5~7 브라우저 실측 — 사용자가 http://localhost:3000 에서 375px 포함 직접 확인하거나, 브라우저 도구가 있는 환경에서 /qa 재실행.
- [ ] (커밋 전) 별개 작업(assets-page-horizontal-scroll) 변경 3개 파일과 커밋 스코프 분리.

## 다음 단계

/implement docs/tasks/2026-06-12-budget-major-category 로 AC-4 불일치(계약 갱신 또는 병합 구현)와 헤더 라벨을 해소한 후 /qa 재실행. 백엔드 동작(AC-1~3)·빌드(AC-8)는 2차 검증에서도 전부 통과 — 남은 것은 AC-4 계약 정합과 UI 실측뿐.
