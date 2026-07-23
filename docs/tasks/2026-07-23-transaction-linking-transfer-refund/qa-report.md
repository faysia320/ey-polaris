# QA Report: 거래 묶기(연결) — 계좌 간 이체·카드 환불 쌍 연결 + 통계 상쇄 (재검증 3회차)

- 날짜: 2026-07-23 (작업 폴더명 기준)
- 작업 폴더: docs/tasks/2026-07-23-transaction-linking-transfer-refund
- 판정: PASS

모든 AC(1~9) 충족, High 0건, Medium 0건, Low 3건. 2회차 QA가 지적한 Medium 1건(묶인 거래를
PUT 수정할 때 묶음 제약을 재검증하지 않아 통계가 조용히 왜곡되던 문제)이 현재 작업 트리에서
**수정됨을 직접 실행으로 확인**했다 — 재검증 로직(`transactions.py:194-216`)이 환불>지출·수입/지출
구분 파괴 등을 422로 거부하고, 묶음 무관 필드(메모)만 바꾸는 수정은 허용한다. 새로 발견한
Medium/High는 없다.

## 검증 환경
- 실행 스택: docker compose (db/backend/frontend 기동 중). backend 컨테이너는 3분 전 재기동된
  상태이며, **컨테이너 내부 코드가 현재 작업 트리와 일치함을 확인** — `transactions.py:194` 묶인
  거래 재검증 분기·`_check_link_pair`(148) 존재, `analytics.py:91` 환불 앵커=`in_month(expense_leg)`.
  재빌드 불필요.
- frontend: 서빙 번들 `index-B8vqCZgh.js`에 링크 UI(`거래 묶기`·`묶음 유형`·`transactions/link`)
  포함 확인. 브라우저 접근은 기동 중 Cloudflare quick tunnel 사용(로컬 브라우저가 localhost:3000에
  직접 도달 불가 — chrome-error 확인 후 tunnel로 전환).
- API 베이스: `http://localhost:8000/api/v1`.
- 실데이터: 전 거래 184건 모두 2026-06, linked 0건. 검증 데이터는 **빈 과거 월(2019-03~08)** 에만
  생성했고 기존 계정·카테고리만 재사용(파생 계정/카테고리 미생성). 정리 후 수치로 무손상 확인.

## 성공 기준 채점
- ✅ **AC-1** 원본 보존 + 묶음 표시: 이체 묶기(2019-03, 두 계정) 후 두 원본이 목록에 그대로
  존재하고 두 건 모두 `link_type=transfer`. 배지는 AC-9에서 375px 렌더 실측.
- ✅ **AC-2** 이체 상쇄 + 잔액 불변: 묶기 전 dashboard(2019-03) income/expense 50,000,000 →
  묶은 후 income 0 / expense 0 / `expense_by_category` `[]`. `assets.grand_total` 463,600,200
  (묶음 상태 vs 해제 상태 동일).
- ✅ **AC-3** 환불 순지출: 지출 40,000 + 환불 30,000(같은 계정) → income 0 / expense 10,000 /
  교통 대분류 10,000. 엣지(환불 40,000=지출 40,000) → expense_total 0, 교통 대분류 표시 제외.
- ✅ **AC-4** 해제 복원: `DELETE /transactions/link/{id}`(204) 후 dashboard income/expense
  50,000,000 복귀. 원본 2건 보존.
- ✅ **AC-5** 거부 규칙: 1건/3건(스키마 min/max 422), 수입+수입 422, 이체 금액 불일치 422,
  같은 계정 이체 422, 환불>지출 422, 이미 묶임 422 — 총 7케이스. 거부 후 대상 거래 linked 0건
  (데이터 불변).
- ✅ **AC-6** 단일 트랜잭션: 코드 검토 — `link_transactions`/`unlink_transactions`/`delete_transaction`
  모두 `db.commit()` 1회, 위반은 커밋 전 예외라 원자적.
- ✅ **AC-7** 리포트=대시보드 일치: 컨테이너에서 `_month_stats` vs `_income_expense_stats` 직접
  대조 — 2026-06(140,733,157 / 60,196,250), 2019-07(0/0) 모두 MATCH. dashboard도 같은 헬퍼 호출
  (`analytics.py:111`).
- ✅ **AC-8** 마이그레이션 up/down: `alembic downgrade -1`(0010→0009) 후 `transactions.link_id`
  컬럼·`transaction_links` 테이블·`ix_transactions_link_id` 인덱스 부재 확인 → `alembic upgrade head`로
  전부 복원 확인. 오류 없음, 실데이터 184건 무손상.
- ✅ **AC-9** 모바일 375px: 레시피 A(iframe 실측).
  - 기본 `/transactions`·`/`·`/assets` 모두 `pageHasHorizontalScroll=false`, `unclippedOffenders=[]`.
  - 선택 액션 바: 실데이터 2건(수입+지출) 체크 시 노출, 오버플로 없음.
  - 묶기 다이얼로그: width 326, left 25/right 351(뷰포트 내), `묶음 유형` 셀렉트 + 효과 미리보기
    포함, 오버플로 없음.
  - 링크된 데이터(2019-03 이체 묶음): `이체 묶음` 배지 렌더, 묶음 해제 버튼 4개(표+카드), 묶인
    행 체크박스 disabled 4개, 초장문 한글 메모 포함해 가로 스크롤·offender 0.

## 검증 시나리오
- 백엔드 API 통합 검증(스크래치패드 `qa_link3.py`, urllib): **34/34 체크 PASS** — AC-1~5 대표+엣지,
  월 넘는 환불(2019-07 결제/2019-08 환불 → 결제월 순지출 0), 그리고 2회차 Medium(묶인 거래 PUT
  재검증) 3케이스:
  - 환불 묶음(지출 40,000/환불 30,000)에서 환불 income leg를 PUT으로 999,999로 → **422 거부**
    (`환불 금액이 지출 금액보다 클 수 없습니다`), dashboard expense 10,000 유지(과거처럼 0으로
    소멸하지 않음).
  - 지출 leg의 kind를 income으로 PUT → **422 거부**(`묶인 거래는 수입/지출 구분을 유지해야
    합니다`).
  - 묶인 거래의 메모만 PUT → **200 허용**, expense 10,000 유지.
- AC-7 직접 실행: `docker exec ... analytics._month_stats` vs `_income_expense_stats` 대조.
- AC-8: `alembic downgrade -1` + `upgrade head`, psql로 컬럼/테이블/인덱스 부재→복원 확인.
- AC-9: 브라우저 iframe 375px 오버플로 계측 + 선택 바/다이얼로그(취소로 실데이터 무변경)/링크 배지·
  해제·disabled 체크박스 렌더(2019-03 전용 데이터).
- 프론트 `npm run lint`: **0 errors, 2 warnings**(exhaustive-deps 1 + TanStack incompatible-library 1)
  — implementation.md 주장과 일치, 독립 재실행으로 확인.
- 검증 데이터 정리: link 삭제 3건 + tx 삭제 후 총 184건 / 2026-06 외 0건 / linked 0건 /
  `transaction_links` 0행 확인(실데이터 무손상).

## 발견 이슈
- [Low] `frontend/src/pages/DashboardPage.tsx:59`, `frontend/src/stores/budgets.ts:19`,
  `frontend/src/stores/transactions.ts:47`, `frontend/src/lib/format.ts:36-38` — **AC 범위 밖 동작
  변경(스코프 크리프)**. 대시보드·예산·거래 목록 기본 조회 월을 `currentMonth()`→`previousMonth()`로
  바꾸고 `previousMonth()` 헬퍼 신설. research.md는 거래 묶기만 계약하며 기본 월 변경은 어떤 AC에도
  없다. 기능 파손은 아니며(전월 데이터 위주 사용에 부합) implementation.md:20에 기록됨. 2회차에서
  이미 지적한 항목이 그대로 유지됨.
- [Low] `frontend/src/pages/TransactionsPage.tsx:407` — `columns` `useMemo` 의존성 배열이
  `openEdit`/`doUnlink`를 누락(eslint `react-hooks/exhaustive-deps` 경고, 재실행으로 재현). `selected`
  변화로 columns가 자주 재메모돼 실사용 stale 위험은 낮음. 훅 의존성 변경은 메모이제이션 동작을
  바꾸는 비국소 수정이라 QA에서 고치지 않고 문서화만 함.
- [Low] 작업 트리 혼입 — `frontend/src/types.ts`·`AssetsPage.tsx`·`SettingsPage.tsx`·
  `backend/app/models.py`의 계정 유형(e_money/deposit/loan) 변경은 **다른 작업**
  (`docs/tasks/2026-07-23-account-types-efinance-loan-deposit/`)의 산출물이 이 작업의 diff에 함께
  섞여 있다. 본 작업 코드 정확성에는 영향 없으나, 이 작업만 깔끔히 커밋하기 어렵게 만든다
  (git 위생 문제 — /git-commit 단계에서 분리 필요).

## QA 중 적용한 수정 (Low 한정)
- 없음. Low 3건 모두 QA 안전 수정 범위 밖 — (1)(2)는 동작·메모이제이션을 바꾸는 비국소 변경,
  (3)은 git 작업 트리 상태라 Edit으로 고칠 수 없음. 문서화/Action Item으로 남김.

## 수정 Action Items
- 없음(Medium/High 0건). 참고용: 위 Low (1)(2)는 구현 재량, Low (3) 트리 혼입은 커밋 분리로 해소.

## 다음 단계
PASS — `/git-commit` 진행 가능. 단, 커밋 시 이 작업(거래 묶기)과 계정 유형 작업의 변경을 분리해
각각 커밋할 것(Low 3 참조).
