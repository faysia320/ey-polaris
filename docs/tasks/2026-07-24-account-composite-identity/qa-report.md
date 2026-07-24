# QA Report: 자산 계정 식별키 분리 — 이름 전역 유니크 → (이름·소유자·유형) 복합 유니크

- 날짜: 2026-07-24
- 작업 폴더: C:\WorkSpace\repos\ey-polaris\docs\tasks\2026-07-24-account-composite-identity
- 판정: PASS

## 성공 기준 채점

- ✅ AC-1: `pg_constraint` 조회로 `uq_accounts_name_member_type UNIQUE (name, member_id, type)` 존재, 기존 `accounts_name_key`(name 전역 유니크) 부재, `accounts_pkey PRIMARY KEY (id)` 유지 확인. 실행 중인 Docker DB에 직접 쿼리.
- ✅ AC-2: 라이브 API. 으니(member 1) "QA테스트카드"/card → 201(id 35), 영이(member 2) 동명·동유형 → 201(id 36). 서로 다른 소유자의 동명·동유형 계정 공존 확인.
- ✅ AC-3: 으니(1) "QA테스트카드"/card 재생성 → 409 + `같은 소유자·유형의 계정 이름이 이미 있습니다: QA테스트카드`. 복합 기준 메시지 확인.
- ✅ AC-4: 으니(1) "QA테스트카드"/bank(같은 소유자·이름, 다른 유형) → 201(id 38). 유형이 다르면 허용 확인.
- ✅ AC-5: 전제로 영이(2) "QA롯데카드"/card(id 39) 생성 후, 으니(1)로 지정해 "QA롯데카드" 결제수단 거래를 실제 엑셀 임포트. 결과: 신규 으니 소유 "QA롯데카드"(id 40, member_id=1)가 생성되고 거래(id 520)가 여기에 연결됨 — 영이의 id 39에는 붙지 않음. 임포트 계정 매칭이 지정 구성원 스코프 내에서만 동작함을 DB 조회로 확인.
- ✅ AC-6: 동일 파일·월(2019-03)·구성원(1)으로 preview와 import 실행. preview = valuations 1건[QA아파트], liabilities 1건[QA대출]. import = valuation_count 1, loan_count 1, created_accounts에 QA아파트·QA대출 포함. 건수·상품명 목록 일치(파리티). 대출 평가액은 음수(-100000000)로 올바르게 기록됨.
- ✅ AC-7: `alembic downgrade -1`(0012→0011) → composite 제거·`accounts_name_key UNIQUE(name)` 복원 확인, `alembic upgrade head`(0011→0012) → composite 복원·name_key 제거 확인. 왕복 후 계정 25건 그대로(무손실).
- ✅ 모바일 AC(해당 없음): 이 작업의 프론트 변경은 preview FormData에 `member_id`를 append하는 배선 1줄(`TransactionsPage.tsx:592`)뿐으로 레이아웃/컴포넌트 변경 없음. 따라서 375px 실측 대상 아님(레시피 A 미시행 사유 = 이 작업이 도입한 시각적 변경 부재). ※ 같은 파일 diff에 있는 `min-w-0` 클래스 변경(:1878)은 이 작업이 아니라 별개 작업 `bundle-view-modal-overflow` 소유임(아래 Low 참조).

## 검증 시나리오

- 정적: 변경 4파일 + 신규 마이그레이션 전체 read. `models.py`의 `UniqueConstraint` import 확인(models.py:14). import/preview가 동일하게 `select(Account).where(member_id == 업로드 member)`로 스코프됨(transactions.py:431-436, 525-530), `_effective_valuations`/`_effective_liabilities`·평가액/부채 반영 루프가 동일 스코프 `accounts` 딕셔너리를 공유함(transactions.py:675, 707) 확인. 프론트 preview 호출자 유일(TransactionsPage.tsx:593)이며 member_id 전달(:592).
- 실행 중인 스택 재사용: `docker compose ps`로 backend 3분 전 재빌드 확인, `inspect.getsource(preview_import)`에 `member_id` 포함으로 서빙 코드=작업 트리 일치 확인.
- 동적 API(엔드포인트 prefix `/api/v1`): AC-2/3/4 각 1회 curl. AC-5/6은 실제 xlsx 픽스처 생성(컨테이너 openpyxl로 "가계부 내역"+"뱅샐현황" 시트 구성) 후 preview→import 실행.
- 엣지: AC-3에서 동일 조합 재삽입 시 롤백으로 id 시퀀스 1건(id 37) 소진 — 정상 동작. 파괴적 임포트는 사전에 2019-03 거래 0건·CURRENT_DATE 평가액 0건 확인 후 과거 빈 월에서만 수행.
- 마이그레이션 왕복 전 QA 테스트 계정(동명 중복 포함)을 전부 삭제해 downgrade의 name 전역 유니크 복원이 막히지 않도록 처리.
- 교차 확인으로 채택: `cd frontend && npm run build` → exit 0(built in 1.28s, chunk-size 경고만) — implementation.md의 "빌드 통과" 주장과 일치.

## 데이터 정리 결과

- 검증으로 만든 계정 7건(QA테스트카드×3, QA롯데카드×2, QA아파트, QA대출) 및 파생물(거래 1건 id 520, 오늘자 평가액 2건) 삭제.
- 정리 후 수치: accounts 총 25건(기준선과 동일), QA% 계정 0건, 2019-03 거래 0건, CURRENT_DATE 평가액 0건. 실데이터 무손상.

## 발견 이슈

- [Low] `frontend/src/pages/TransactionsPage.tsx:1878` — 작업 트리 diff에 이 작업과 무관한 `min-w-0` 클래스 추가가 섞여 있음(묶음 보기 모달 wrapper). 이는 별개 작업 `docs/tasks/2026-07-24-bundle-view-modal-overflow`의 산출물이며, 그 작업의 정당한 변경이므로 이 작업의 결함은 아님. 다만 두 작업 변경이 한 워킹트리에 공존하므로 `/git-commit` 시 뒤섞이지 않도록 분리 주의 필요. (되돌리지 않음 — 타 작업의 유효 변경)
- [Low] `backend/app/routers/transactions.py:411-416` — `preview_import`는 `member_id`를 받지만 존재 검증(get_or_404)을 하지 않음. `import_transactions`(:491)는 `get_or_404`로 구성원을 검증하는 것과 비대칭. 존재하지 않는 member_id로 preview 호출 시 조용히 빈 스코프(평가액 0건)를 반환. 비파괴적 엔드포인트라 크래시·데이터 영향 없고, 실제 UI는 항상 선택된 유효 구성원만 전달하므로 영향은 직접 API 오용 시로 한정. (수정 시 404 반환으로 동작이 바뀌므로 Low 자동수정 대상 아님 — Action Item으로 이관)

## QA 중 적용한 수정 (Low 한정)

- 없음. 발견한 두 Low 모두 국소적·비동작변경 수정 대상이 아님(#1은 타 작업의 유효 변경이라 되돌리면 안 됨, #2는 404 도입=동작 변경). 규칙에 따라 손대지 않고 기록만 유지.

## 수정 Action Items (FAIL/CONDITIONAL 시)

- 해당 없음(판정 PASS). 참고용 후속 제안:
  - (선택) `preview_import`에 `get_or_404(db, models.Member, member_id, "구성원")`를 추가해 import와 검증 대칭 맞추기 — 동작 변경이므로 별도 결정 필요.
  - `/git-commit` 시 account-composite-identity 변경(models.py, accounts.py, transactions.py, 0012 마이그레이션, TransactionsPage.tsx:592 member_id 배선)과 bundle-view-modal-overflow 변경(TransactionsPage.tsx:1878 min-w-0)을 별도 커밋으로 분리.

## 다음 단계

/git-commit 진행 가능(단, 위 Action Item대로 두 작업을 별도 커밋으로 분리 권장).
