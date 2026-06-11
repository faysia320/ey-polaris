# QA Report: 자산 상태 카드 유형별 그룹핑 + 구성원 필터 + 계정 소유자 필수화

- 날짜: 2026-06-11
- 작업 폴더: docs/tasks/2026-06-11-assets-grouping-member-filter
- 판정: PASS

## 성공 기준 채점

- ✅ AC-1: 브라우저(localhost:3000/assets)에서 유형별 그룹 카드(제목=한글 라벨) 안에 계정 카드가 중첩 렌더링됨을 스크린샷으로 확인 (은행/현금/카드/기타 그룹과 내부 계정 카드).
- ✅ AC-2: 그룹 순서 은행→현금→카드→주식→기타로 표시(임시 주식 계정 생성 후 카드와 기타 사이에 '주식' 그룹이 삽입됨 = ACCOUNT_TYPE_LABEL 고정 순서 준수). 계정 없는 유형(투자/부동산, 평시 주식)은 미표시. 각 그룹 헤더 우측에 소계 금액(은행 9,140,263원, 카드 -22,089,128원 등) 표시 확인.
- ✅ AC-3: 음수 잔액 rose 색상 표시 확인. 임시 주식 계정 생성 후 '평가액 갱신' 버튼이 주식 그룹 내 카드에 표시되고 클릭 시 "평가액 갱신 — QA주식계좌" 다이얼로그(기준일/평가액 입력)가 열림을 브라우저로 확인. 평가 기준일·비활성 배지는 코드상 내부 카드 마크업에 보존됨(diff 검토 — 해당 상태의 데이터가 없어 화면 표시는 미관측).
- ✅ AC-4: 대시보드/자산 상태/지출·수입 내역 세 페이지 모두 최상단 우측에 구성원 select 표시 확인(스크린샷). 옵션은 "전체/으니/영이"로 GET /members 결과 동적 구성. 구성원 추가 시 반영은 코드로 확인 — `masterData.createMember` → `fetchAll()` → `MemberFilterSelect`가 같은 스토어의 `members`를 구독.
- ✅ AC-5: 자산 상태에서 "영이" 선택 → 대시보드 이동 → 지출/수입 내역 이동, 세 페이지 모두 select가 "영이"로 유지되고 데이터가 필터된 상태임을 브라우저로 확인 (zustand 전역 스토어 `memberFilter.ts`).
- ✅ AC-6: member 1/2 거래 각 1건 생성 후 `GET /transactions?month=2026-05&member_id=1` → 해당 1건만, `member_id=2` → 다른 1건만 반환 확인. UI에서도 "영이" 선택 시 해당 거래만 표시. (검증 거래는 삭제로 정리)
- ✅ AC-7: `GET /analytics/dashboard?month=2026-05&member_id=1` → expense=11000(으니 거래만), `member_id=2` → expense=22000, recent_transactions도 해당 구성원 것만, expense_by_category도 필터 반영. 예산 amount(100,000원)는 불변, spent만 필터됨. member_id=null인 기존 import 거래는 필터 시 제외 — 명세 의미상 올바름.
- ✅ AC-8: (a) 기준정보 관리 계정 다이얼로그에 소유자 select 존재, 미선택 후 추가 클릭 시 "소유자를 선택해주세요" 검증 에러 표시(스크린샷). (b) `POST /accounts` member_id 누락 → 422, member_id=999 → 404 확인. PUT에서도 존재하지 않는 member → 404 확인.
- ✅ AC-9: `alembic current` = 0005 (head). `GET /accounts` 10건 전부 `member_id: 1`(으니) — NULL 없음. 기준정보 관리 계정 테이블에 '소유자' 컬럼 표시 확인(전부 '으니', 임시 계정은 '영이').
- ✅ AC-10: 계정 소유 구성원(member 2, 임시 계정 소유) 삭제 시도 → 409 + "거래 또는 계정(소유자)에서 참조 중인 구성원은 삭제할 수 없습니다".
- ✅ AC-11: 업로드 다이얼로그에 "새 계정 기본 소유자" select + 안내 문구 확인(스크린샷). 미존재 계정명("QA신규테스트계좌")이 포함된 테스트 xlsx를 `default_member_id=2`로 업로드 → 신규 계정이 `member_id: 2`로 생성됨을 `GET /accounts`로 확인. default_member_id 누락 → 422, 존재하지 않는 구성원 → 404 (데이터 변경 전 검증). (테스트 데이터 전부 삭제로 정리)
- ✅ AC-12: member 2 소유 계정(개설잔액 5,000원) 생성 후 `GET /analytics/assets?member_id=2` → accounts 1건(해당 계정만), total=5000, trend도 해당 계정만 반영(trend_last=5000). 브라우저에서도 "영이" 선택 시 소유 계정 그룹만 표시, 상단 총자산이 필터 값으로 변경됨 확인.
- ✅ AC-13: 목표 카드는 "영이" 선택 시에도 항상 표시되고 "부부 공동 목표 — 전체 자산 기준" 라벨 표기. `?member_id=2` 응답에도 grand_total이 전체값(-17,310,994 = 전체 -17,315,994 + 신규 5,000)으로 항상 포함 — 필터와 무관하게 동일. FE는 `assets.grand_total` 기준으로 달성률 계산 (`AssetsPage.tsx`).
- ✅ AC-14: member_id 미전달 시 `/analytics/assets` 10건·total=grand_total 동일, `/analytics/dashboard` 기존 구조·값 그대로(추가 필드는 assets의 grand_total뿐). `/transactions`는 백엔드 무변경 경로.

## 검증 시나리오

- `npm --prefix frontend run build` → 통과 (tsc -b + vite; 500kB chunk 경고는 기존)
- `npm --prefix frontend run lint` → 0 errors / 2 warnings (둘 다 이번 변경과 무관한 기존 TransactionsPage 경고)
- `docker exec ey-polaris-backend-1 python -m compileall app alembic` → 통과, `alembic current` → 0005 (head)
- API 실검증 (localhost:8000, docker 기동 중인 dev DB):
  - accounts 10건 백필(member_id=1), assets all/m1/m2 비교, dashboard all/m1/m2 비교
  - 구성원 거래 2건 생성→필터 검증→삭제, member 2 계정 생성→assets 필터·409 삭제 차단 검증→삭제
  - openpyxl로 테스트 xlsx 생성(컨테이너 내 /tmp) 후 import 422/404/정상(신규 계정 소유자 지정) 검증 → 생성된 거래·계정·카테고리 전부 삭제로 원복
- 브라우저(localhost:3000) 검증: 자산 그룹핑·소계·순서, 평가액 갱신 다이얼로그, 세 페이지 select 표시·"영이" 선택 유지, 목표 카드 항상 표시, 계정 다이얼로그 소유자 필수 검증 에러, 업로드 다이얼로그 소유자 select, 계정 테이블 소유자 컬럼
- 엣지 케이스: member_id 누락(422)/존재하지 않는 member(404, accounts POST·PUT 및 import), 소유 계정 없는 구성원 필터(assets 0건·total 0·grand_total 유지), member_id=null 거래의 필터 제외, 빈 유형 그룹 미표시
- 정리 확인: `git status` — 구현 변경분 외 무변경, dev DB의 QA 데이터 잔존 0건 확인

## 발견 이슈

- [Low] `frontend/src/stores/transactions.ts:23` — `if (filters.member_id)` truthy 체크라 id가 0인 구성원은 필터되지 않음. Postgres serial은 1부터 시작하므로 실제 발생 불가이며 기존 `category_id` 처리와 동일한 관례. 영향 없음.
- [Low] `backend/app/routers/transactions.py:119` — `default_member_id`가 필수 Form이 되어 import API의 하위호환이 깨짐(구버전 클라이언트는 422). 프론트가 함께 배포되는 단일 사용자 앱이라 실질 영향 없음(구현 노트에도 명시됨).
- [Low] `frontend/src/stores/memberFilter.ts` — 구성원 선택이 메모리 상태라 브라우저 새로고침 시 '전체'로 초기화됨. AC-5는 페이지 이동 유지만 요구하므로 충족이나, 유지 기대가 있다면 localStorage persist 고려 가능 (개선 제안).

High/Medium 이슈는 발견하지 못함. 시도한 결함 탐색: 대시보드 4개 집계 경로의 필터 누락 여부(전수 코드 추적 + API 교차 검증), assets의 grand_total/trend가 visible·전체 계정을 혼용하는 버그 가능성(코드 추적 + 신규 계정 생성 전후 값 비교), SQLAlchemy select에 `.limit()` 이후 `.where()` 체이닝 동작(실행으로 정상 확인), 마이그레이션의 구성원 0명 가드(코드 검토 — 시드상 도달 불가), import 404가 데이터 변경 전에 발생하는지(실행 확인), 미존재 member_id 필터(빈 결과, 에러 없음).

## 수정 Action Items (FAIL/CONDITIONAL 시)

- 해당 없음 (Low 이슈는 선택적 개선 사항)

## 다음 단계

/git-commit 진행 가능
