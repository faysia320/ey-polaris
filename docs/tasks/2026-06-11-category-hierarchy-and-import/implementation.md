# Implementation: 카테고리 대/소분류 개편 + 뱅크샐러드 엑셀 월별 업로드

- 날짜: 2026-06-11
- 기반 명세: `docs/tasks/2026-06-11-category-hierarchy-and-import/research.md`

## 변경 파일

### 백엔드
- `backend/requirements.txt` — openpyxl(엑셀 파싱), python-multipart(FastAPI 멀티파트 폼) 추가
- `backend/app/models.py` — Category를 major/minor 2단계로 변경(유니크 `(major, minor, kind)`), `display_name` 프로퍼티 추가, Transaction에 `source`('manual'|'import') 추가
- `backend/alembic/versions/0004_category_hierarchy_and_import.py` — 신규: name→major 변환·minor backfill·제약 교체, 엑셀 전수(지출 56쌍+수입 3쌍)+'환불' 시드, 기존 시드 재매핑(매핑 표대로 거래·예산 UPDATE 후 구 행 삭제), 미참조 '교통>미분류' 정리, transactions.source 추가
- `backend/app/schemas.py` — CategoryCreate에 major/minor, CategoryAmount를 대분류 집계용으로 단순화(category_id 제거), ImportResult/ImportSkippedRow 추가
- `backend/app/excel_import.py` — 신규: "가계부 내역" 시트 파서(시트/필수컬럼 검증 → ExcelFormatError, 날짜 시리얼/datetime 모두 처리, 이체·0원·KRW외·부호모순 스킵+사유, 지출+양수는 환불로 income 전환·원분류 memo 보존), 결제수단 type 휴리스틱
- `backend/app/routers/transactions.py` — `POST /transactions/import`(월 검증→파싱→해당월 import 거래 삭제→카테고리/계정 get-or-create→일괄 삽입, 단일 트랜잭션, ImportResult 반환), GET에 `major` 필터 추가, `_month_range` 헬퍼 추출, category_name을 display_name으로
- `backend/app/routers/categories.py` — 정렬(kind, major, minor) 및 409 메시지 2단계 표기
- `backend/app/routers/analytics.py` — expense_by_category를 대분류 집계로 분리, 예산 진행용 spent는 카테고리 행 단위 별도 쿼리, display_name 적용
- `backend/app/routers/budgets.py` — category_name을 display_name으로

### 프론트엔드
- `frontend/src/types.ts` — Category major/minor, CategoryAmount 단순화, ImportResult/ImportSkippedRow 추가
- `frontend/src/lib/format.ts` — `categoryLabel()` (백엔드 display_name과 동일 규칙)
- `frontend/src/lib/api.ts` — `api.upload()` multipart 메서드(Content-Type 자동 설정)
- `frontend/src/stores/masterData.ts` — CategoryInput major/minor
- `frontend/src/stores/transactions.ts` — 필터에 major 추가
- `frontend/src/pages/SettingsPage.tsx` — 카테고리 탭: 대분류/소분류 컬럼(연속 대분류 그룹 표시), 다이얼로그 대분류(datalist 자동완성)+소분류 입력
- `frontend/src/pages/TransactionsPage.tsx` — 거래 폼 대분류→소분류 2단계 셀렉트, 필터 대분류+소분류(대분류 선택 시 노출), 캘린더 필터 안내에 대분류 반영(기존 미커밋 변경 보존), 엑셀 업로드 버튼·다이얼로그(파일/월 선택, 교체 경고, 결과 요약·스킵 사유, 성공 시 거래+기준정보 재조회)
- `frontend/src/pages/BudgetsPage.tsx` — 카테고리 표시를 categoryLabel로

## 주요 결정
- **단일 테이블 + major/minor 컬럼** (research 권장안): 거래·예산 FK 불변, 가져오기 자연 키와 1:1.
- **환불 행 → income + '환불>미분류' 카테고리**, 원래 분류는 memo `[환불: 대분류 > 소분류]`로 보존 (research 설계 그대로).
- **GET /transactions에 `major` 쿼리 파라미터 추가** — research에 명시되지 않은 소폭 확장. 대분류만 선택한 필터가 소분류 전체를 포괄하려면 백엔드 필터가 필요했음(AC-9의 "필터할 수 있다" 충족 목적).
- **research.md AC-5의 "2026-04 환불 16건"은 표본 추정 오류** — 엑셀 실측은 2026-04 환불 7건(연간 48건은 정확). 구현은 7건 전부를 환불 카테고리 income으로 등록했고 96+53=149로 월 전체 행수와 일치하므로 AC-5의 의도(환불→수입 반영·memo 보존)는 충족.
- 0002 시드 이력은 불변으로 두고 0004에서 변환·재시드·재매핑. downgrade는 구조 복원만(소분류 제거 시 (name,kind) 중복 가능성 때문에 구 유니크 제약은 복원하지 않음).
- 카테고리 목록 정렬은 DB 컬레이션(바이트순)이라 한글 가나다순은 아니지만 대분류 그룹핑은 유지됨 — 허용 범위로 판단.

## 자체 검증 결과
- `npm run build` → 통과 (1.59MB 청크 경고는 기존 echarts)
- `npm run lint` → 통과 (0 errors, 경고 2건은 기존 TanStack Table 패턴)
- `docker compose up -d --build backend/frontend` → 정상 기동, `alembic upgrade 0003 → 0004` 성공
- API 검증 (curl/Invoke-RestMethod):
  - GET /categories: 60건(지출 56 + 수입 4, '환불' 포함), fixed 9건이 명세 제안과 일치, 미참조 '교통>미분류' 정리됨
  - 마이그레이션 전 생성한 수동 거래·예산('생활용품')이 '생활 > 생필품'으로 재매핑되어 보존
  - import 2026-05: 생성 65+스킵 27=92(엑셀 실측 일치), 신규 카테고리 0건(시드 완전 일치 방증), 신규 계정 8건
  - 동일 월 재업로드: deleted=65/created=65, 총 건수 불변, 수동 거래 보존
  - import 2026-04: 생성 96+스킵 53=149(실측 일치), 환불 7건이 kind=income·카테고리 '환불'·memo `[환불: ...]`로 등록
  - 중복 카테고리 409("이미 존재하는 카테고리입니다: 식비 > 미분류"), 참조 중 삭제 409, 비정상 파일 422, 빈 월 422 + 기존 데이터 불변
  - dashboard 2026-04: expense_by_category가 대분류 11건 집계, 합계가 엑셀 원본과 일치(식비 11,653,527원 — 1,128만원 결혼식장 결제 포함 확인), assets 정상
- 브라우저 검증 (localhost:3000): 거래 목록 표시명, 대분류/소분류 필터 연동, 거래 폼 2단계 셀렉트(식비→배달/미분류/식재료), 엑셀 업로드 다이얼로그로 2026-03 실제 업로드(등록 89·건너뜀 12 요약+사유 표시, 목록 자동 갱신), 설정 페이지 대/소분류 테이블, 대시보드 대분류 도넛, 예산 페이지 표시명 모두 확인

## 성공 기준 자가 체크
- [x] AC-1: GET /categories 60건(56+4), 명세 표와 일치 — curl 대조 완료
- [x] AC-2: 마이그레이션 전 거래·예산이 '생활 > 생필품'으로 보존 — API 확인
- [x] AC-3: 중복 생성 409, 참조 중 삭제 409 — Swagger 동등(REST) 확인
- [x] AC-4: 2026-05 업로드 생성+스킵=92, 이체 스킵 사유 보고 — 응답 확인
- [x] AC-5: 환불 행이 income·'환불' 카테고리·memo 보존으로 등록 — 2026-04 업로드 확인 (명세의 "16건"은 명세 측 집계 오류, 실측 7건 전부 처리)
- [x] AC-6: 재업로드 중복 없음 + 수동 거래 보존 — 2회 업로드 비교
- [x] AC-7: 결제수단 8종 자동 생성·거래 연결 — GET /accounts 확인
- [x] AC-8: 비정상 파일/빈 월 422 한국어 메시지 + 기존 거래 불변 — 확인
- [x] AC-9: 브라우저에서 2단계 셀렉트 생성·필터 동작 — 스크린샷 확인
- [x] AC-10: 설정 페이지 대/소분류 관리 UI 표시·동작(생성/수정/삭제 API는 AC-3에서 검증) — 확인
- [x] AC-11: 업로드 다이얼로그→결과 요약→목록 자동 갱신 — 실제 파일(2026-03)로 확인
- [x] AC-12: 대시보드 대분류 도넛 + 예산 페이지 회귀 없음 — 확인
- [x] AC-13: build/lint 통과, backend 기동 — 실행 기록 위와 같음

## 보류/미완 항목
- 없음. (참고: 검증 과정에서 DB에 2026-03/04/05 가져오기 거래, 수동 테스트 거래 1건('생활 > 생필품', memo "마이그레이션 보존 테스트"), 2026-06 예산 1건(100,000원)이 남아 있음 — 실데이터 업로드 전 정리하거나 그대로 사용 가능)
