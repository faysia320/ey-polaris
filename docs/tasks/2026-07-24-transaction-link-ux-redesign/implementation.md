# Implementation: 거래 묶음 UX 재설계 — 수정 모달 진입 + 병합 행 표시

- 날짜: 2026-07-24
- 기반 명세: docs/tasks/2026-07-24-transaction-link-ux-redesign/research.md

## 변경 파일
- `backend/app/models.py` — `TransactionLink.transactions` 역참조 관계 추가, `Transaction.link`에 `back_populates` 연결 (짝 다리 로딩용, 컬럼 변경 없음)
- `backend/app/schemas.py` — `TransactionLinkPartner` 응답 스키마 추가, `TransactionOut.linked_partner` 필드 추가
- `backend/app/routers/transactions.py` — `_partner_of()` 헬퍼 추가·`_to_out()`에서 `linked_partner` 채움, 목록 쿼리에 짝 다리(계정·카테고리) selectinload 체인 추가 (N+1 방지)
- `frontend/src/types.ts` — `TransactionLinkPartner` 인터페이스 추가, `Transaction.linked_partner` 필드 추가
- `frontend/src/pages/TransactionsPage.tsx` — 선택 체크박스/액션 바 제거, 병합 표시 행 파생(`displayRows`)·columns accessorFn 전환, 수정 모달 footer "묶음" 버튼, "연결할 거래 선택" 다이얼로그, "묶음 보기" 다이얼로그, 모바일 카드·캘린더 일별 목록 병합 렌더

## 주요 결정
- **파트너 임베드로 병합 렌더 안정화**: `TransactionOut.linked_partner`에 짝 다리 요약(id·date·time·kind·amount·category_name·account_name·memo)을 실어, 짝이 현재 조회 필터 밖(다른 달)이어도 병합 행과 묶음 보기가 완전한 정보로 렌더된다. DB 컬럼 추가는 없어 Alembic 마이그레이션 불필요.
- **병합 앵커 규칙**: `displayRows`에서 `link_id`당 1행만 노출. 양다리가 모두 items에 있으면 지출 leg를, 한쪽만 있으면 그 leg를 앵커로 삼는다(`anchorByLink`).
- **병합 행 표시값**(`bundleDisplay`): 이체 묶음 = `출금계정 → 입금계정`·거래 금액(청색/무부호), 환불 묶음 = 순지출(지출 − 환불, 적색/− 부호).
- **표 컬럼 전환**: `data`를 `displayRows`로 바꾸고 date/amount를 `accessorFn`(id 지정) 기반으로, 나머지는 display 컬럼(정렬 없음)으로 전환. 기존에도 정렬은 date/amount만 가능했으므로 동작 동일.
- **묶음 진입 UX**: 수정 모달의 "묶음" 버튼은 편집 중 + 미묶임 + 비이체(수입/지출)일 때만 노출. 클릭 시 수정 모달을 닫고 "연결할 거래 선택" 다이얼로그로 전환(현재 목록의 반대 구분·미묶임·비자기 후보만). 후보 선택 시 계정 일치 여부로 유형 기본 제안, 기존 유형/효과 미리보기 UI 재사용.
- **묶음 보기 = 확인·해제만**(사용자 확정): 병합 행 액션은 "묶음 보기" 단독(수정/삭제 없음). 각 다리 수정·삭제는 먼저 해제 후 개별 행에서. 이미 묶인 거래의 수정 모달에는 "묶음" 버튼 대신 "해제한 뒤 수정" 안내(방어적 — 병합 행에는 수정 진입점이 없어 정상 흐름에선 도달하지 않음).
- **후보 범위 = 현재 목록만**(사용자 확정): `linkCandidates`는 로드된 `items`에서만 필터. 별도 후보 검색 엔드포인트 없음. 후보가 없으면 "조회 월·필터를 옮기라"는 안내 노출.
- **엣지(미저장 수정)**: "묶음"은 저장된 거래 기준으로 동작하며, 클릭 시 수정 모달을 닫아 미저장 폼 값이 묶기에 영향을 주지 않음을 명확히 함(별도 저장 강제는 하지 않음 — 링크는 폼과 독립).

## 자체 검증 결과
- 실행 명령: `npm run lint` → 통과 (exit 0, 0 errors / 2 warnings). 경고 2건은 기존 코드에도 있던 성격: (1) columns `useMemo`의 `openEdit` 의존성 경고 — 기존 columns도 openEdit를 dep 없이 참조하던 패턴, (2) `useReactTable` incompatible-library(React Compiler skip) — TanStack Table 고유.
- 실행 명령: `npm run build` (tsc -b && vite build) → 통과 (exit 0, 3672 모듈 변환, 타입 오류 없음). chunk 크기 경고는 기존부터 있던 번들 경고.
- 백엔드: `python -c "import ast; ast.parse(...)"` 3개 파일 문법 통과. 전체 import/매퍼 검증은 로컬에 SQLAlchemy 미설치(백엔드는 Docker 실행)로 불가 → Docker/CI 위임. `back_populates` 일대다 관계와 selectinload 체인은 표준 패턴이며 신규 컬럼이 없어 마이그레이션 불필요.
- 백엔드 테스트 스위트: `backend/**/test_*.py` 없음 — 실행 대상 없음.
- 브라우저 E2E 확인은 /qa 위임(구현 단계 역할 아님).

## 성공 기준 자가 체크
- [x] AC-1: 수정 모달 footer 좌측에 "묶음" 버튼(`editing && !link_id && kind !== 'transfer'`), 추가 모달(editing null)에는 미노출 — 코드상 조건부 렌더.
- [x] AC-2: 이미 묶인 거래(`editing.link_id`)의 수정 모달은 "묶음" 버튼 대신 "묶음을 해제한 뒤 수정할 수 있어요" 안내. 병합 행에는 수정 진입점이 없어 정상 흐름상 묶인 거래 수정 모달 자체가 열리지 않음.
- [x] AC-3: "묶음" 클릭 → `linkPickerOpen` 다이얼로그. `linkCandidates` = 현재 items 중 반대 구분·`link_id==null`·비자기.
- [x] AC-4: 후보 선택 시 유형/효과 미리보기 표시, "묶기" → `link([source.id, target.id], type)` → `POST /transactions/link` 호출, 성공 시 목록 재조회로 병합 행 반영.
- [x] AC-5: `confirmLink`가 이체(금액 불일치/같은 계정)·환불(환불>지출) 위반 시 서버 호출 전에 `linkError` 메시지로 차단.
- [x] AC-6: `displayRows`가 `link_id`당 1행만 emit(지출 leg 앵커). `bundleDisplay`로 이체=출금→입금·금액, 환불=순지출 + 묶음 배지 렌더.
- [x] AC-7: 병합 행 액션은 "묶음 보기"(Eye)뿐. 보기 모달에서 지출/수입 두 다리(날짜·시각·금액·계정·카테고리·메모) 표시 + "묶음 해제"(`unlink`) → 성공 시 목록 재조회로 개별 행 복원.
- [x] AC-8: `select` 컬럼·`selected`/`toggleSelect` 상태·상단 묶기 액션 바·`setSelected` 초기화 모두 제거(grep로 잔여 참조 없음 확인).
- [~] AC-9(모바일): 375px 대응 — 카드/모달 모두 기존 모바일 패턴(flex-wrap·truncate·`touchTarget`·min-w-0) 유지, footer는 `flex-col-reverse`/`sm:justify-between`로 세로 적층. 브라우저 실측은 /qa 위임.
- [x] AC-10: analytics·묶기/해제 서버 계약 불변 → 통계 상쇄 로직 그대로. 병합은 표시 계층 한정.
- [x] AC-11: `npm run build`·`npm run lint` 통과(위 자체 검증).

## 보류/미완 항목
- AC-9 모바일 뷰포트 실측(375px 가로 스크롤·겹침·잘림)은 /qa 브라우저 도구로 확인 예정 — 구현 단계에서는 코드 수준(반응형 클래스)까지만 확인.
- 백엔드 매퍼/쿼리 런타임 검증은 Docker/CI 위임(로컬 SQLAlchemy 미설치).
