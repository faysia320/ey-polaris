# QA Report: '으니영이의 북극성' 가계부 웹앱 1차 구현 (스캐폴드 + 핵심 화면)

- 날짜: 2026-06-10 (작업 폴더명 기준)
- 작업 폴더: docs/tasks/2026-06-10-polaris-app-scaffold
- 판정: **PASS**

## 성공 기준 채점

- ✅ AC-1: `docker compose down -v` 후 `docker compose up --build -d` 1회로 3컨테이너(db healthy, backend, frontend) 기동 — 직접 수행. `curl http://localhost:3000/` 200, `/api/v1/health` `{"status":"ok"}` 확인. 헤드리스 Chrome으로 `/` 실제 렌더링 확인(대시보드 카드·가이드 메시지·사이드바 표시).
- ✅ AC-2: 5개 라우트(`/`, `/assets`, `/transactions`, `/budgets`, `/settings`) 모두 nginx 200 + 헤드리스 Chrome(`--headless=new --dump-dom`)으로 실제 렌더링 — 각 화면의 핵심 텍스트(제목·탭·테이블 헤더) 모두 DOM에 존재, 콘솔/페이지 에러 0건, 사이드바 5개 메뉴가 모든 화면에 존재.
- ✅ AC-3: 카테고리·계정·구성원 생성/수정/삭제 API 전부 동작(201/200/204) + `docker compose restart` 후 데이터 보존 확인. 같은 이름 중복 409, 빈 이름 422, 같은 이름·다른 kind 카테고리 201(유니크 제약이 (name, kind)로 정확). 설정 화면 렌더링에 시드 데이터 표시 확인. (다이얼로그 클릭 수준 조작은 아래 '검증 한계' 참조 — 폼 제출 로직은 정적 분석으로 동일 페이로드임을 확인)
- ✅ AC-4: 당월 거래 2건(지출 15,000 / 수입 3,000,000) 등록 → `/transactions` 렌더링 DOM에 두 건(메모 'QA 장보기'/'QA 급여', 구성원 으니/영이 포함) 표시, 대시보드 DOM에 수입 3,000,000원·지출 15,000원·도넛 차트 canvas 렌더링 확인.
- ✅ AC-5: 예산(2026-06 식비 400,000) 입력 → 대시보드 DOM에 소진율 4%(=15,000/400,000 반올림), 진행 바 행 "15,000원 / 400,000원", 가이드 메시지 "북극성이 밝게 빛나고 있어요"(소진율 3.75% < 월 경과율 36.7%×0.8 — 로직과 정확히 일치) 표시 확인.
- ✅ AC-6: 자산 상태 — 우리집 통장 잔액 2,985,000원 = 개설 0 + 수입 3,000,000 − 지출 15,000 수동 계산과 일치(API + 렌더링 DOM 양쪽 확인). 음수 잔액(−4,500원 현금 지갑)도 정상 계산·표시. 12개월 추이 마지막 점 2,980,500 = 총자산과 일치.
- ✅ AC-7: 필터 — `month`(기간)·`kind`·`category_id` 쿼리 조합 모두 정확한 부분집합 반환(직접 curl), 잘못된 month(`2026-13`) 422. 그리드 기본 월 필터로 당월 거래만 렌더링 확인. 정렬·페이지네이션은 TanStack `getSortedRowModel`/`getPaginationRowModel` 클라이언트 구현(정적 확인 + 빌드·린트 통과) — 클릭 토글은 미수행(검증 한계 참조).
- ✅ AC-8: `grep create_all backend/` 0건 — Alembic 0001(스키마)·0002(시드)로만 생성. `down -v` → `up` 클린 기동 시 카테고리 16·구성원 2·계정 2·거래 0 시드 확인. backend 단독 재시작(alembic upgrade head 재실행) 후에도 16/2/2 — 중복 시드 없음(2회 검증).
- ✅ AC-9: 데이터 입력 상태에서 `docker compose restart` → 거래 3건·예산 1건·수정한 기준정보 전부 보존 확인.
- ✅ AC-10: `http://localhost:8000/docs` 200, openapi.json에 13개 경로(5개 리소스 CRUD + analytics/dashboard + analytics/assets + health) 노출 확인.
- ✅ AC-11: `frontend/package.json`에 react ^19.2.6 / zustand ^5.0.14 / @tanstack/react-table ^8.21.3 / echarts ^6.1.0 / tailwindcss ^4.3.0 / react-router ^7.17.0, `src/components/ui/` shadcn 컴포넌트 10종, `backend/requirements.txt`에 fastapi~=0.136.3 / sqlalchemy~=2.0.50 / alembic>=1.16 — 파일 확인. ECharts는 직접 래핑(`EChart.tsx`, research 권장안).
- ✅ AC-12: 음수 금액 422, 0 금액 422, 문자열·소수 금액 422, 없는 카테고리 ID 404(+한국어 메시지), kind 불일치 422, 잘못된 날짜(2026-02-30) 422, 중복 예산 409, 수입 카테고리 예산 422, 참조 중 카테고리/계정 삭제 409 — curl/Python으로 11케이스 전부 직접 확인.

## 검증 시나리오

실행 환경: Docker Compose v5.1.4, Windows 호스트. 모든 명령 직접 실행.

1. `docker compose down -v` → `docker compose up --build -d` — 3컨테이너 기동, db healthy, alembic 0001→0002 로그 확인
2. 시드 검증: 카테고리 16(지출 12/수입 4), 구성원 2(으니/영이), 계정 2 — implementation.md 주장과 일치
3. SPA 라우트 5종 + 존재하지 않는 경로 — 모두 200 (SPA 폴백 정상, `/assets` 301 문제 재발 없음)
4. 헤드리스 Chrome(`chrome --headless=new --virtual-time-budget=8000 --dump-dom`)으로 5개 화면 실제 렌더링 — 빈 상태 메시지("이번 달 지출이 아직 없어요" 등) 및 데이터 주입 후 반영 모두 확인, JS 에러 0
5. CRUD/집계/엣지 케이스 — 위 AC-3~7, AC-12에 기재한 케이스 전부 (UTF-8 한글 메모 왕복 무손상 확인 포함)
6. 영속성: `restart`(보존) / `down -v`(초기화) / backend 단독 재시작(중복 시드 없음) 3종
7. `npm run lint` 재실행 — 오류 0, 경고 1(TanStack `useReactTable` React Compiler 비호환 — 라이브러리 특성, implementation.md 주장과 일치). 프론트 빌드는 docker 빌드 스테이지(`tsc -b && vite build`) 성공으로 독립 확인됨
8. 검증 후 테스트 데이터 전부 삭제 — DB를 시드 전용 클린 상태로 복원, `git status`로 레포 무변경 확인(이 보고서 제외)

**검증 한계**: 마우스 클릭 수준의 UI 조작(다이얼로그 제출 버튼, 정렬 헤더 토글, 사이드바 클릭 내비게이션)은 브라우저 자동화 도구가 이 세션에서 사용 불가(다중 Chrome 연결로 사용자 선택 필요)하여 직접 수행하지 못했다. 대신 ① 헤드리스 Chrome 실제 렌더링(데이터 반영 포함), ② UI가 호출하는 모든 API 경로의 전수 검증, ③ 폼 제출/정렬 코드 정적 분석으로 대체했다. 이 갭에서 발견된 결함은 없다.

## 발견 이슈

High/Medium 없음. 위 검증 시나리오(60여 개 요청, 11개 엣지 케이스, 3종 영속성 시나리오, 5화면 렌더링)에서 기능 결함은 발견하지 못했다.

- [Low] `backend/app/routers/members.py:38` — 구성원 삭제가 `commit_or_conflict(db, "거래에서 참조 중인 구성원은 삭제할 수 없습니다")`로 감싸져 있으나 FK가 `ON DELETE SET NULL`이라 이 409 경로는 도달 불가(실측: 참조 중 구성원 삭제 → 204, 거래의 member가 null로 전환). 동작 자체는 implementation.md의 의도("태그 성격이라 SET NULL")와 일치하지만, 도달 불가 에러 메시지가 코드를 오독하게 만든다.
- [Low] `frontend/package.json:21` — CLI 도구인 `shadcn`(^4.11.0)이 runtime `dependencies`에 포함. devDependencies로 옮겨야 한다 (번들에는 미포함되나 docker 빌드 설치 무게 증가).
- [Low] `backend/app/routers/transactions.py:42` — `GET /transactions`에 서버측 페이지네이션/limit 없음 (전체 행 반환). 부부 가계부 규모에서는 무해하나 수년 누적 시 응답이 커진다.
- [Low] `backend/app/routers/analytics.py:127` — 자산 추이 12개월 창이 컨테이너 시간(UTC) `date.today()` 기준. KST 매월 1일 00~09시에 창이 한 달 이전으로 표시될 수 있다 (표시 전용, 데이터 손상 없음).
- [Low] `backend/app/routers/analytics.py:74-82` — 대시보드 '최근 거래'가 선택한 월과 무관하게 전체 최신 5건. 과거 월 조회 시 해당 월과 무관한 거래가 보인다 ("최근 거래" 명칭상 의도일 수 있음).
- [Low] `frontend/README.md` — create-vite 템플릿 기본 내용 그대로 (프로젝트 설명 아님).
- [Low] `docker-compose.yml:5-6` / `backend/app/main.py:14-19` — DB 자격증명 평문(polaris/polaris) + CORS `allow_origins=["*"]`. 로컬 전용 전제(코드 주석에 명시)에서는 수용 가능하나 외부 노출 시 재검토 필요.

## 수정 Action Items

(PASS — 필수 수정 없음. 아래는 후속 단계에서 처리 권장)

- [ ] `members.py` 삭제 핸들러의 도달 불가 409 메시지 제거 또는 RESTRICT로 정책 통일
- [ ] `shadcn`을 devDependencies로 이동
- [ ] `frontend/README.md`를 프로젝트 설명으로 교체 (CLAUDE.md `/init` 재실행과 함께)

## 다음 단계

/git-commit 진행 가능. (참고: CLAUDE.md의 "빈 저장소" 문구가 무효화되었으므로 커밋 후 `/init` 재실행 권장 — implementation.md에도 기재됨)
