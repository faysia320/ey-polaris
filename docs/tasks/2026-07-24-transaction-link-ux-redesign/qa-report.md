# QA Report: 거래 묶음 UX 재설계 — 수정 모달 진입 + 병합 행 표시

- 날짜: 2026-07-24
- 작업 폴더: `docs/tasks/2026-07-24-transaction-link-ux-redesign`
- 판정: PASS

## 검증 환경 메모
- 실행 중이던 docker compose 스택(backend/frontend/db)이 **커밋 시점(약 50분 전) 코드로 빌드**돼 있어, 작업 트리의 변경(`linked_partner`·`time` 필드)이 서빙되지 않고 있었다(라이브 `/api/v1/transactions` 응답에 `linked_partner`·`time` 키 부재). 레시피 C·검증 규칙에 따라 서빙 코드와 트리 불일치를 확인한 뒤 `docker compose up -d --build`로 재기동해 현재 트리 코드로 검증했다. 재기동 시 백엔드 Dockerfile의 `alembic upgrade head`가 마이그레이션 `0011_transaction_time`(nullable `time` 컬럼 추가 — 비파괴·가역)을 적용했다. DB 볼륨은 유지되어 기존 184건(2026-06) 데이터 보존.
- 이 작업 폴더의 변경(models/schemas/transactions.py)은 형제 작업 `2026-07-24-transaction-time-and-loan-import`의 변경(`time`·대출 import)과 **작업 트리에서 얽혀** 있다. 본 QA는 링크 UX 재설계 계약(`linked_partner`, `_partner_of`, back_populates 관계, selectinload 체인, `TransactionsPage.tsx`, `types.ts`)에 한정해 채점했다.

## 데이터 영향
- 검증 데이터는 **실데이터가 없는 2019-03**(검증 전 0건 확인)에만 생성. 개별 거래 7건 생성 → 링크/해제/삭제까지 전량 정리. 최종 2019-03 = **0건**, 2026-06 = **184건(변경 전과 동일, linked 0)** 재확인. 손상·유실 없음.

## 성공 기준 채점
- ✅ AC-1: 브라우저에서 수입 거래 수정 모달 footer에 "묶음" 버튼 확인(`footerBtns`에 묶음/취소/수정). 거래 추가 모달은 취소/추가만, `hasMukgiButton=false`. 코드 조건 `editing && !editing.link_id && editing.kind !== 'transfer'`(TransactionsPage.tsx:1380).
- ✅ AC-2: 코드상 `editing?.link_id` 분기에서 "묶음을 해제한 뒤 수정할 수 있어요" 안내, 묶음 버튼 미노출(TransactionsPage.tsx:1384-1387). 단, 병합 행에는 수정 진입점이 없어 이 경로는 정상 UI로 **도달 불가능한 방어 코드**다(설계 결정과 일치). AC가 명시한 "묶음 보기→수정 경로"는 존재하지 않음 — 아래 [Low] 참조.
- ✅ AC-3: "묶음" 클릭 시 "연결할 거래 선택" 모달 오픈. 수입 소스에 대해 반대 구분(지출) 후보 140건 나열, 전부 음수(지출)·미묶임, 자기 자신 제외. 프롬프트 "현재 목록에서 연결할 지출 거래를 고르세요" 확인.
- ✅ AC-4: 라이브 `POST /api/v1/transactions/link`로 이체·환불 묶음 생성 성공(각각 `{"id":3,...}`,`{"id":4,...}`). 목록 재조회 시 `link_id`/`link_type`/`linked_partner` 반영. 파트너 임베드가 계정명·카테고리명까지 정확히 채워짐(예: partner `account_name:"WON 통장", category_name:"교통 > 철도"`).
- ✅ AC-5: 서버 검증 직접 확인 — 이체 같은 계정 422("출금·입금 계정이 서로 달라야 합니다"), 이체 금액 불일치 422, 환불 income>expense 422. 클라이언트 `confirmLink`가 동일 규칙을 서버 호출 전에 차단(TransactionsPage.tsx:744-751).
- ✅ AC-6: 브라우저에서 2019-03의 4개 다리 → **정확히 2개 병합 행**. 이체 행 `WON 통장 → ALL 우리카드 Infinite`·50,000(무부호/이체색), 환불 행 순지출 -20,000(=30000-10000)·"환불 묶음" 배지. `displayRows` link_id당 1행, 지출 leg 앵커.
- ✅ AC-7: 병합 행 액션은 "묶음 보기"만(수정/삭제 없음). 모달에서 지출/수입 두 다리의 날짜·금액·계정·카테고리·메모 개별 확인. "묶음 해제" 클릭 시 환불 묶음이 개별 2행(수입 +10,000 / 지출 -30,000, 각각 수정/삭제 액션)으로 복원됨을 브라우저로 확인.
- ✅ AC-8: 표 헤더 = [날짜,구분,카테고리,금액,계정,구성원,메모,∅]. `table input[type=checkbox]` 없음, "선택됨/선택 해제/묶기" 액션 바 없음. 코드에서 `selected`/`toggleSelect`/`canLink` 등 잔여 참조 grep 0건.
- ✅ AC-9(모바일): 레시피 A 375px iframe 실측 — 기본 페이지, 병합 모바일 카드, 묶음 보기 모달, 수정 모달 footer(묶음/취소/수정), 연결 대상 선택 모달 모두 `pageHasHorizontalScroll=false` 및 `unclippedOffenders=[]`. 가로 스크롤·겹침·잘림 없음.
- ✅ AC-10: `analytics.py`·링크/해제 서버 계약은 diff에 없음(변경 없음). 링크/해제가 `link_type`만 조작함을 라이브로 확인 → 집계 상쇄 로직 그대로. 병합은 표시 계층 한정.
- ✅ AC-11: `npm run build`(tsc+vite) exit 0(3672 모듈), `npm run lint` 0 errors / 2 warnings(둘 다 기존 성격: columns useMemo openEdit 의존성, TanStack useReactTable incompatible-library). 직접 실행 확인.

## 검증 시나리오
- 라이브 API(재빌드 후): 2019-03에 이체 쌍(50000/50000, 다른 계정)·환불 쌍(지출30000/환불10000, 같은 계정) 생성 후 `POST /link` → `linked_partner` 임베드가 양다리에서 상대 정보(id·kind·amount·account_name·category_name)로 정확히 채워짐 확인.
- 서버 유효성: 이체 같은계정/금액불일치, 환불 초과 3케이스 모두 422 + 한국어 메시지.
- `DELETE /link/{id}` 204 → link_id 복원 확인. 개별 거래 삭제 204(병합 자동 해제 포함).
- 브라우저(localhost:3000): AC-1/3/8 데스크톱 실측, AC-6/7 2019-03 필터로 병합 행·묶음 보기·해제 복원 실측.
- 모바일 레시피 A: /transactions를 375px iframe으로 로드, 월 필터 2019-03로 이동해 병합 카드/각 모달 오버플로 측정(전부 clean).
- 엣지: 후보 없음 시 안내 문구 존재(코드), 빈/잘못된 입력은 submit·confirmLink 가드로 차단.

## 발견 이슈
- [Low] `TransactionsPage.tsx:1384-1387` (AC-2) — 묶인 거래 수정 모달의 "해제 후 수정" 안내 분기는 정상 UI로 **도달 불가능한 방어 코드**다. 병합 행은 "묶음 보기"만 노출하고 거기서 수정으로 가는 경로가 없어, research.md AC-2가 명시한 "묶음 보기→수정 경로로 열어 확인"이 실제로 불가능하다. 코드는 설계 결정(묶인 거래는 해제 후 수정)과 일치하므로 기능 결함은 아니며, AC 문구와 구현의 검증 경로가 어긋난 사양-문서 불일치다.
- [Low] `TransactionsPage.tsx:1767-1804` (AC-3) — 연결 대상 선택 모달이 반대 구분 후보 **전체를 스크롤 목록으로만** 제공한다(테스트 월에서 140건). research.md Action Item "연결 대상 선택 모달: … 검색/스크롤(후보 많을 때) 처리" 중 스크롤만 구현되고 검색 입력은 없다. 후보가 많은 달에서 상대 거래를 찾기 번거롭다(동작은 정상, 성능 문제 아님).
- [Low] `TransactionsPage.tsx:697-704` — 수정 모달에서 "묶음" 클릭 시 `setDialogOpen(false)`로 폼의 **미저장 변경이 조용히 폐기**된다(묶기는 저장된 `editing` 값으로 동작). implementation.md는 의도된 동작으로 기록했으나, 편집값이 버려진다는 명시적 안내는 없다. 링크는 저장값으로 올바르게 동작하므로 데이터 정합성 문제는 아니다.
- (관찰, 이슈 아님) `TransactionCalendar.tsx:29-40` 월별/일별 셀 합계는 다리별(income/expense) 단순 합이라, 환불 묶음의 셀 합계(+환불 & −전액)와 일별 상세의 병합 순지출 표시가 달라 보인다. 이번 작업 이전부터의 동작이고 research가 "합계 로직 불변"으로 명시 — 범위 밖.

## QA 중 적용한 수정 (Low 한정)
- 없음. 발견한 Low 3건은 모두 국소적·동작 불변 수정 범위를 벗어난다(검색 입력 추가·미저장 안내 추가는 기능 변경, AC-2는 계약 파일 문구 관련이라 코드 수정 대상 아님). Action Item에도 넣지 않는다(Low).

## 수정 Action Items (FAIL/CONDITIONAL 시)
- 해당 없음(PASS).

## 다음 단계
PASS — `/git-commit` 진행 가능. (참고: 작업 트리에 형제 작업 `transaction-time-and-loan-import`의 변경이 함께 스테이지되어 있으니 커밋 분리 여부를 확인할 것.)
