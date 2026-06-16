# QA Report: 예산 설정 메뉴 개선 (전월 복사 · 빠른 금액 버튼 · 콤마 placeholder)

- 날짜: 2026-06-16
- 작업 폴더: docs/tasks/2026-06-16-budget-settings-improvements
- 판정: CONDITIONAL PASS

## 평가 환경 메모
- 채점 기준: `research.md`의 AC-1 ~ AC-9 (직접 확인).
- docker 스택의 backend/frontend 컨테이너는 본 변경 이전(약 47분 전) 빌드된 이미지로, `/budgets/copy` 미포함 stale 코드를 서빙 중이었음(서빙 번들 `index-DhaQo9i9.js` ≠ 신규 빌드 `index-D3OKIsEq.js`, openapi에 copy 라우트 없음). 따라서 동적 검증을 위해:
  - backend: 작업 트리의 `budgets.py`/`schemas.py`를 `docker cp`로 컨테이너에만 주입 후 재기동(레포 파일 무변경). 재기동 후 `/api/v1/budgets/copy` 라우트 등록 확인.
  - frontend: `npm run dev`(포트 5191, `/api`→localhost:8000 프록시)로 작업 트리 코드를 직접 서빙해 브라우저 E2E 수행.
- 검증 후 생성한 모든 테스트 예산 데이터 삭제, dev 서버 종료, `git status`로 레포 working tree 무변경 확인(구현 변경분 + task 문서만 존재).
- AC-8(375px)은 `resize_window`가 렌더 뷰포트를 축소하지 못해(뷰포트 1406/1280 유지) **동적 375px 캡처 불가** → 정적 분석으로 갈음(아래 명시).

## 성공 기준 채점
- ✅ AC-1 (전월 복사 기본): 2026-06(빈 상태)에서 "전월 복사" 클릭 → `POST /api/v1/budgets/copy` 200, 표에 2026-05의 3건(교통 100,000 / 생활 2,000,000 / 식비 500,000) 반영, 총 예산 2,600,000원으로 갱신됨(브라우저 시각 + 네트워크 + API 교차 확인).
- ✅ AC-2 (당월 덮어쓰기): 당월 데이터 존재 시 클릭하면 확인 Dialog 표시, 덮어쓰기 후 API에서 정확히 3건·중복 majors 없음(누적 없음). 백엔드 단독 시나리오(소스 변경+타깃전용 항목 추가 후 재복사)에서도 타깃전용 항목 삭제·소스값 반영·유니크 위반 0 확인.
- ✅ AC-3 (빈 전월 안전): prev 월이 빈 2026-08에서 클릭 → `POST /budgets/copy` 422, UI에 "복사할 전월 예산이 없습니다" 표시, 당월/소스 데이터 무변경(조용한 전체 삭제 없음). 백엔드 단독으로도 422 + 타깃 보존 확인.
- ✅ AC-4 (스피너 제거): `type="number"` 유지 + `NO_SPINNER`(appearance:textfield + webkit inner/outer spin-button none). 포커스/값 입력 상태에서 입력란 우측에 증감 화살표 미노출(zoom 시각 확인).
- ✅ AC-5 (빠른 버튼): 각 행에 +100만원/+10만원/+5만원 버튼. +100만원×2 + +5만원 = 입력값 2,050,000 누적 확인. 저장 시 현재 예산에 반영(150,000 저장 → 현재 예산 갱신, POST 201 + GET refresh 네트워크 확인).
- ✅ AC-6 (콤마 placeholder): 현재 예산 150,000원 행의 빈 입력란 placeholder가 "150,000"으로 콤마 포함 표시. 복사 후 행들도 100,000 / 2,000,000 / 500,000 콤마 placeholder 확인. `formatNumber`(접미사 없는 ko-KR NumberFormat) 사용.
- ✅ AC-7 (저장 검증 유지): 현재 예산 존재 행에 "0" 입력 후 저장 클릭 → 네트워크 요청 0건(클라이언트 거부), "예산은 1원 이상의 정수여야 합니다" 에러 표시, 기존 예산(교통 150,000) API상 보존. 백엔드 create amount=0도 422 확인.
- 🟡 AC-8 (모바일 375px): **동적 375px 미확인**(`resize_window`가 렌더 뷰포트를 축소하지 못함). 정적 분석으로는 충족 신호 — Table이 `ScrollArea`+가로 `ScrollBar`로 감싸 넓은 콘텐츠 오버플로를 페이지 레벨이 아닌 컨테이너 내부 스크롤로 처리, 모바일에서 '현재 예산' 컬럼 `hidden sm:table-cell`로 숨기고 보조 줄 노출, 변경금액 셀은 `flex-col`+버튼 `flex-wrap`(size xs, h-6)으로 줄바꿈, 고정 px 페이지 너비 없음. 단, 동적 확인 부재로 잔여 위험 존재(아래 Medium 이슈).
- ✅ AC-9 (빌드·린트): `npm run build`(tsc -b + vite) 성공. `npm run lint` 0 errors(경고 2건은 기존 `TransactionsPage.tsx` 항목, 본 변경 무관). `py_compile`은 컨테이너 재기동으로 라우트 정상 로드 확인으로 갈음.

## 검증 시나리오
- 빌드/린트: `cd frontend && npm run build` → built; `npm run lint` → 0 errors, 2 warnings(TransactionsPage, 무관).
- 백엔드 라우트 등록: 컨테이너에 작업 트리 파일 주입+재기동 후 openapi paths = `['/api/v1/budgets', '/api/v1/budgets/copy', '/api/v1/budgets/{budget_id}']`.
- 백엔드 copy 시나리오(live API): 빈 타깃 복사(AC-1) / 소스변경·타깃전용항목 후 재복사로 덮어쓰기·무중복(AC-2) / 빈 소스 422·타깃 보존(AC-3) / create amount=0 → 422 — 전부 PASS, 테스트 데이터 삭제.
- 브라우저 E2E(dev 서버 5191): 전월 복사(빈/데이터 상태), 확인 Dialog, 빠른 버튼 누적, 0 입력 거부+에러, 콤마 placeholder, 스피너 미노출 — 네트워크 요청·시각 zoom으로 교차 확인.
- 자기검증 중 발견한 false-positive: 저장 버튼 좌표를 휴지통(삭제) 버튼으로 오클릭해 예산이 사라진 것을 일시적으로 "0 저장이 예산을 삭제"로 의심했으나, 네트워크 로그상 `DELETE /budgets/{id}`였음을 확인하고 정확한 저장 버튼 좌표로 재현하여 0 입력은 네트워크 요청 없이 거부됨을 검증(앱 결함 아님).
- 데이터 정리: 2026-06 테스트 예산 전부 삭제, 2026-05(원본 3건)/2026-08(빈) 무변경 확인. 레포 working tree 무변경.

## 발견 이슈
- [Medium] `frontend/src/pages/BudgetsPage.tsx` (AC-8) — 375px 뷰포트 동적 검증 미수행. 브라우저 `resize_window`가 본 환경에서 렌더 뷰포트를 축소하지 못해 실제 375px에서의 가로 스크롤/겹침/잘림·터치 크기를 시각 확인하지 못함. 정적으로는 ScrollArea 오버플로 처리·반응형 컬럼 숨김·flex-wrap 버튼으로 충족 신호가 있으나, 동적 미확인이므로 보수적으로 Medium. (research.md에 모바일 AC가 명시되어 있고 정적 대비책도 존재하므로 계약 누락 이슈는 아님.)
- [Low] `backend/app/routers/budgets.py:42-66` (copy 라우트) — `create_budget`과 달리 복사 시 source major가 현재 지출 카테고리로 존재하는지 재검증하지 않음. 다만 존재하는 예산을 복제하는 동작이고, 프론트도 옛 이름 예산 행을 보존·수정 가능하게 설계되어 있어 기능 요구상 문제 아님(설계 일관). 회귀 위험 낮음.
- [Low] `backend/app/routers/budgets.py:42-66` — copy 라우트는 `commit_or_conflict` 대신 직접 `db.commit()` 사용. 동일 트랜잭션 내 delete→insert로 유니크 충돌을 구조적으로 회피하므로 현 시나리오에서 충돌 없음(테스트로 무중복 확인). 다른 라우트의 충돌 처리 컨벤션과는 다름 — 기능 영향 없음.

## 수정 Action Items (CONDITIONAL)
- [ ] AC-8: 실제 375px 뷰포트(기기 에뮬레이션 또는 dev tools device toolbar)에서 예산 표·빠른 버튼·저장/삭제 버튼의 가로 스크롤/겹침/잘림 부재와 터치 크기를 시각 확인(또는 확인 가능한 환경에서 재검증). 정적 신호상 통과 가능성이 높으나 동적 확인이 남음.

## 다음 단계
CONDITIONAL PASS — AC는 전부 충족하나 AC-8 동적 375px 확인이 환경 제약으로 미수행(Medium 1건). 375px 실측 후 이슈가 없으면 `/git-commit` 진행 가능. 동적 확인이 필요하면 `/qa <폴더>`를 375px 캡처 가능한 환경에서 재실행 권장.
