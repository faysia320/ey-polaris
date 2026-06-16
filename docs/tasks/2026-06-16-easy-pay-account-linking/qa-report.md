# QA Report: 간편결제(easy_pay) 계정 유형 추가 및 연결 카드/계좌 기반 자산 집계 구분

- 날짜: 2026-06-16
- 작업 폴더: docs/tasks/2026-06-16-easy-pay-account-linking
- 판정: PASS

## 검증 환경

- 평가 대상 코드는 작업 트리(uncommitted)에 존재하나, 기동 중이던 docker 스택은 3일 전 빌드된 구버전 이미지(alembic 0007, easy_pay 없음)였음 — 작업 트리와 불일치 확인.
- 따라서 backend/frontend 이미지를 각 **1회 재빌드**(`docker compose build`)하고 재기동하여 현재 코드를 서빙. 재빌드/마이그레이션은 레포 파일을 변경하지 않음(빌드 산출물 `frontend/dist`는 gitignore). 최종 `git status --short`로 작업 트리 무변경 확인.
- 동적 검증을 위해 생성한 테스트 계정/거래(easy_pay 28·29, tx 1037·1038)는 모두 삭제하여 DB를 baseline(계정 11건, grand_total -17,303,649)으로 복원함.

## 성공 기준 채점

- ✅ AC-1: `docker compose exec db psql "\d accounts"`로 `linked_account_id integer`(nullable) + `fk_accounts_linked_account_id_accounts ... ON DELETE RESTRICT` 확인. `alembic downgrade -1` 후 컬럼 0개(제거됨), `alembic upgrade head`로 컬럼+FK 복원, 오류 없음. 마이그레이션 체인 0001→…→0008 선형, 0008이 head.
- ✅ AC-2: `easy_pay`가 `schemas.py:26` AccountType, `types.ts:5` 양쪽에 존재. `npm run build`(tsc+vite) 통과.
- ✅ AC-3: `POST /accounts {type:"easy_pay"}` (linked 없음) → HTTP 422 "간편결제 계정은 연결 계정이 필요합니다".
- ✅ AC-4: linked=cash(id 2) → 422 "카드 또는 은행 계정이어야 합니다"; linked=999999(없음) → 404; PUT 자기참조(linked=self id 28) → 422 "자기 자신을 지정할 수 없습니다". 세 위반 모두 거부.
- ✅ AC-5: 구현은 '거부' 채택. `POST {type:"bank", linked_account_id:14}` → 422; `PUT` 동일 → 422. 일관됨.
- ✅ AC-6: easy_pay(28, →card14)에 expense 50,000 생성 후 `/analytics/assets`에서 card14 잔액 -22,003,798 → -22,053,798 (정확히 50,000 감소), easy_pay 잔액은 0 유지(opening_balance).
- ✅ AC-7: 동일 거래로 grand_total -17,303,649 → -17,353,649 (정확히 50,000만 이동, 이중계상/누락 없음). trend의 당월 값(-17,353,649)이 grand_total과 일치 — 라우팅이 trend 경로에도 동일 적용됨.
- ✅ AC-8: card14의 `usage_breakdown` = [{직접 사용, 27,897,830}, {QA_네이버페이, 50,000}] — 직접 지출과 간편결제 채널 지출이 각각 식별됨.
- ✅ AC-9: 브라우저 자산 페이지에서 "ALL 우리카드 Infinite" 카드 내부에 "사용 출처" 분해 라인(직접 사용 27,897,830원 / QA_네이버페이QA 33,000원) 표시 확인.
- ✅ AC-10: 자산 페이지 그룹은 은행/현금/카드/기타만 — `간편결제` 그룹 없음. easy_pay 테스트 계정은 독립 카드로 노출되지 않고 연결 카드의 분해 라인으로만 귀속됨. (기존 type=other인 네이버페이류 계정은 본 작업 범위 밖이라 '기타' 그룹에 그대로 남음 — research §46과 일치)
- ✅ AC-11: 설정>자산계정>계정추가에서 유형=간편결제 선택 시 "연결 계정(카드/은행)" Select 노출. 후보 목록 = 우리집 통장(bank)/Trip to 로카(card)/ALL 우리카드 Infinite(card)/WON 통장(bank)/카드의정석 후불하이패스+(card) — card|bank만, cash/other/easy_pay 등 제외 확인.
- ✅ AC-12: 연결 미선택 + 이름/소유자 입력 후 추가 클릭 → 빨간 폼 에러 "연결 계정을 선택해주세요" 표시, 다이얼로그 미제출(열린 채 유지).
- ✅ AC-13: `npm run build` 통과, `npm run lint` 0 errors (TransactionsPage.tsx 사전 경고 2건은 변경 무관). backend 재기동 시 import/기동 오류 없음(/docs 200, 모든 API 정상 응답).
- ✅ AC-14(모바일): 정적 확인 — 분해 라인 `flex justify-between gap-2 text-xs` + name `truncate` + amount `shrink-0`, 계정 카드 그리드 `grid-cols-1`(모바일), 다이얼로그 base `w-full max-w-[calc(100%-2rem)] sm:max-w-sm`, select base `overflow-x-hidden min-w-36` + 트리거 `w-full`. 고정 px 너비 없음 — 375px 가로 오버플로 위험 없음. (동적 미확인 사유는 아래 이슈 [Low] 참조)

## 검증 시나리오

- 마이그레이션: 컨테이너에서 upgrade(0007→0008) 적용 로그 확인 → 컬럼/FK 검사 → downgrade(-1) → 컬럼 부재 확인 → upgrade head 재적용 → 복원 확인.
- 백엔드 검증 계약(AC-3,4,5): 6개 위반 케이스를 `curl POST/PUT /api/v1/accounts`로 직접 호출, 응답 코드·메시지 검증.
- 패스스루(AC-6,7,8): 유효 easy_pay 생성 → expense 1건 → assets 응답의 잔액·grand_total·breakdown을 거래 전후 수치로 검산. member_id 필터(1/2)별 동작도 확인(grand_total 불변, 필터별 visible 계정 정상).
- 삭제 RESTRICT: easy_pay가 참조 중인 card14 삭제 시 409 확인.
- 브라우저 E2E(AC-9,10,11,12): localhost:3000에서 설정 폼 유형 전환·연결 후보 필터·미선택 검증·자산 페이지 분해/그룹 비노출을 화면으로 확인.
- 빌드/린트: `frontend`에서 build·lint 직접 실행.
- 정리: 테스트 데이터 삭제 후 accounts 11건·grand_total baseline 복원, `git status` 무변경 확인.

## 발견 이슈

- [Low] 동적 375px 모바일 미실측 — `resize_window`로 OS 창은 375px로 줄였으나 스크린샷/렌더 파이프라인이 논리 뷰포트를 1411px 미만으로 반영하지 못해(데스크톱 사이드바·md 3열 그리드 유지) 실제 375px 리플로 캡처에 실패. AC-14는 코드 정적 분석(반응형 유틸·고정폭 부재·shadcn base의 모바일 안전 클래스)으로만 검증함. 코드상 오버플로 유발 요소는 없으나 실측 화면은 미확인.
- [Low] `backend/app/routers/accounts.py:61` 삭제 에러 메시지가 일반 문구("거래에서 참조 중인 계정은 삭제할 수 없습니다")로, easy_pay 연결로 인한 RESTRICT 차단 시에도 동일하게 반환됨. research §43이 메시지 보강을 '선택'으로 명시했으므로 AC 위반 아님(권장 개선).
- [Low] `usage_breakdown`의 '직접 사용' 금액은 expense 절대합인 반면 카드 잔액은 net(expense+income+transfer)이라 분해 합과 카드 잔액이 직접 일치하지는 않음. research §94가 '지출 합계' 표기를 허용했고 AC-9는 채널별 식별/지출 기여 정합만 요구하므로 위반 아님(설계 의도).

## 다음 단계

PASS — /git-commit 진행 가능. (Low 이슈 3건은 모두 AC 위반이 아니며 선택적 개선 사항)
