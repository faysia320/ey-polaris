# Implementation: 이체(transfer) 거래 도입 + 엑셀 업로드 이체 검토 흐름

- 날짜: 2026-06-12
- 기반 명세: `docs/tasks/2026-06-12-import-transfer-review/research.md` (+ 선행 명세 `docs/tasks/2026-06-12-transfer-transactions/research.md`)

## 변경 파일

### 백엔드
- `backend/alembic/versions/0006_transfer_transactions.py` — (신규) counter_account_id FK 컬럼 + 이체 카테고리 시드(이체 > 내계좌이체/카드대금/저축/투자/미분류)
- `backend/app/models.py` — Transaction.counter_account_id 컬럼·관계, kind 주석 확장, Account.transactions에 foreign_keys 명시(FK 2개로 인한 모호성 해소)
- `backend/app/schemas.py` — CategoryKind에 "transfer", TransactionCreate/Out 상대 계정 필드, ImportReviewRow/ImportPreview/ImportDecision 신설, ImportResult에 transfer_count/converted_count
- `backend/app/routers/transactions.py` — _validate_refs 이체 검증(상대 계정 필수·존재·출금≠입금, 비이체는 상대 계정 금지), _to_out 상대 계정 직렬화, POST /transactions/import/preview 신설, POST /transactions/import에 decisions 처리(전환·이체 적재·스킵, 페어 1건 병합, 원자 커밋)
- `backend/app/routers/analytics.py` — 현재 잔액·월별 추이에 이체 입금 다리(+) 가산 (kind 필터 덕에 대시보드 집계는 무변경)
- `backend/app/excel_import.py` — "이체" 행을 스킵 대신 ReviewRow로 분리 반환(부호·원본 분류·결제수단 보존), 내계좌이체 1:1 자동 페어링(`_pair_own_transfers`)

### 프론트엔드
- `frontend/src/types.ts` — TransactionKind 'transfer', 거래 타입 상대 계정 필드, 임포트 미리보기/결정/결과 타입
- `frontend/src/lib/format.ts` — KIND_LABEL 공용 라벨 추가
- `frontend/src/pages/TransactionsPage.tsx` — 거래 폼(구분 '이체', 출금/입금 계정, 검증, 편집 복원), 테이블·일별 목록(이체 배지, 하늘색 무부호 금액, "출금 → 입금" 표기), 구분 필터, 업로드 다이얼로그 미리보기→검토→확정 흐름(행별 결정, 페어 자동 표시, 상대 계정 Select(기존 계정만), 카드대금 지출 경고, 결과 요약 확장)
- `frontend/src/pages/SettingsPage.tsx` — 카테고리 구분 배지 KIND_LABEL 적용, 카테고리 폼 kind에 '이체' 옵션(이체 카테고리 편집 시 kind 변질 방지)
- `frontend/src/components/transactions/TransactionCalendar.tsx` — 일별 수입/지출 합계에서 transfer 제외

## 주요 결정

- **미해결 질문 해소(사용자 확인)**: 검토 화면의 상대 계정은 **기존 계정 선택만** 허용 (즉석 생성 없음 — AskUserQuestion으로 확정).
- **무상태 2단계 임포트**: 미리보기와 확정 모두 파일을 재전송. 서버 세션 상태 없음, 확정은 기존과 동일하게 단일 트랜잭션(예외 시 get_db close가 롤백 → 원자성).
- **결정 없는 검토 행은 보수적 스킵** ("검토 결정 없음 — 건너뜀" 사유로 결과에 표기).
- **페어 병합 규칙**: 양쪽 다리 모두 action=transfer & 상대 계정 미지정일 때만 1건으로 병합(출금 다리 기준). 한쪽이라도 다르게 결정하면 자동 해제 — 남은 다리는 명시 상대 계정 필요(클라이언트가 사전 검증, 서버도 422).
- **created_count 의미 확장**: 일반 행 + 전환 행 + 이체 건의 총합. transfer_count/converted_count는 부가 정보.
- **이체 카테고리 매핑**: 원본 대분류가 시드 소분류(내계좌이체/카드대금/저축/투자)면 그대로, 그 외(이체/현금/미분류)는 '미분류'.
- **downgrade 정책**: 이전 스키마가 이체를 표현할 수 없으므로 transfer 거래·카테고리를 삭제(파괴적임을 마이그레이션 독스트링에 명시).
- **명세와의 차이**: 선행 명세가 언급한 analytics 최근 거래(recent) 처리는 불필요해짐 — 조사 시점 이후 해당 데드코드가 이미 제거되어 현재 코드에는 존재하지 않음.

## 자체 검증 결과

- `python -m py_compile` (백엔드 6개 파일) → 통과
- `npm run build` (tsc -b && vite build) → 통과
- `npm run lint` → 0 errors (경고 2건은 기존 useReactTable 라이브러리 호환성 경고)
- `docker compose up -d --build` → alembic 0006 적용, `GET /categories`에 transfer 카테고리 5종 시드 확인
- 수동 이체 API 검증 스크립트 → **18/18 PASS** (잔액 양다리·grand_total 불변·대시보드 불변·구성원별 total/trend 이동·kind 필터·직렬화·422 4종·정리 후 원복)
- 임포트 API 검증 스크립트(실제 xlsx, 2026-01, 구성원 2) → **전 항목 PASS** (미리보기 DB 무변경·검토 6행 반환·페어 상호 참조·기본 제안 규칙·상대 계정 누락 422+원자성·확정 시 이체 2/전환 1/스킵 2·memo 흔적·재업로드 교체·수동 거래 보존) — 테스트 데이터는 종료 후 삭제(총 거래 수 250 원복)
- 브라우저(:3000) → 거래 폼 '이체' 선택 시 출금/입금 계정 노출(입금 목록에서 출금 계정 제외), 검토 화면(27행, 페어 "자동 페어 ↔ ..." 표기, 카드대금 이체 기본 제안, 지출 선택 시 이중 계산 경고), UI로 이체 등록 → 테이블에 이체 배지·하늘색 금액·"우리집 통장 → ALL 우리카드 Infinite" 표기 확인 후 삭제
- 모바일: 브라우저 창 최소 폭 제약(OS 스케일링 150% + Chrome 최소 폭)으로 **정확한 375px 뷰포트 재현 불가** → 대체 검증으로 검토 다이얼로그를 375px 뷰포트 상당(343px)으로 강제한 구조 검사 수행: 가로 넘침 요소 **0건** (flex-wrap 동작 확인)

## 성공 기준 자가 체크

본 명세 (import-transfer-review):
- [x] AC-1: 미리보기 DB 무변경 + 검토 행 전체 반환(행번호·날짜·분류·부호 금액·결제수단·페어·제안) — API 검증 PASS
- [x] AC-2: 내계좌이체 페어 자동 제안·확정 시 1건의 이체로 적재(카카오페이 머니→WON 통장) — API 검증 PASS
- [x] AC-3: 행별 결정 반영(이체→양다리 잔액, 수입/지출→대시보드 포함, 건너뛰기→결과 표기) — API 검증 PASS
- [x] AC-4: 상대 계정 누락/동일 계정 422 + 원자성(실패 시 DB 무변경) — API 검증 PASS
- [x] AC-5: 이체 행 없는 월은 검토 단계 없이 기존 흐름(빈 review면 즉시 확정) — 코드 경로 + 프론트 분기 확인 (review.length===0 → 바로 commit)
- [x] AC-6: 재업로드 교체(deleted=이전 created) + 수동 거래 보존 — API 검증 PASS
- [x] AC-7: 검토 화면 행별 4종 선택·카드대금 이체 기본 제안·지출 경고 — 브라우저 확인 PASS
- [x] AC-8 (모바일): 343px(375 뷰포트 상당) 강제 구조 검사로 넘침 0건 — 단, 실제 375px 뷰포트 스크린샷은 도구 한계로 미확보(보류 항목 참조)
- [x] AC-9: 전환 행 memo에 원본 분류 흔적(`[이체→수입: 이체]`) — API 검증 PASS

선행 명세 (transfer-transactions):
- [x] AC-1~5: 잔액 양다리·대시보드 불변·구성원별 이동·422 4종·추이 반영 — API 검증 18/18 PASS
- [x] AC-6~8: 폼 등록/표시/삭제·캘린더 제외·구분 필터 — 브라우저 + 코드 확인 (캘린더 transfer 제외는 코드 분기, 빌드 통과)
- [x] AC-9: alembic upgrade 성공 + 이체 카테고리 시드 + 기존 집계 회귀 없음(검증 전후 총 거래 250 유지)
- [x] AC-10: → 본 명세의 검토 흐름으로 대체됨 (이체 행은 스킵 대신 검토 대상)

## 보류/미완 항목

- AC-8의 "실제 375px 뷰포트" 브라우저 확인: 검증 환경의 OS 디스플레이 스케일링(150%)과 Chrome 최소 창 폭 제약으로 정확한 375px 재현이 불가하여, 다이얼로그 343px 강제 + 넘침 요소 전수 검사(0건)로 대체했다. QA에서 devtools 기기 에뮬레이션(375×812)으로 최종 확인 권장.
- 캘린더 일별 합계의 transfer 제외(선행 AC-7 일부)는 코드 분기 + 빌드로 확인했고, 브라우저에서 이체 거래가 있는 상태의 캘린더 뷰 육안 확인은 생략(검증 데이터 정리 우선). QA에서 확인 가능.
