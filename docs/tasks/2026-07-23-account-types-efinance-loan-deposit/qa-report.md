# QA Report: 자산 계정 유형 추가 — 전자금융자산 · 대출 · 보증금

- 날짜: 2026-07-23 (작업 폴더명의 날짜)
- 작업 폴더: docs/tasks/2026-07-23-account-types-efinance-loan-deposit
- 판정: PASS

## 검토 범위 주의
작업 트리에 이 작업(account-types)과 **다른 작업(transaction-linking-transfer-refund)의 변경이 섞여 있음**. `schemas.py`/`models.py`에는 이 작업의 `AccountType` 값 추가와 함께 `LinkType`·`TransactionLink`·`TransactionLinkCreate` 등 타 작업 코드가 동시에 존재하고, `analytics.py`(144줄)·`transactions.py`(83줄)·`TransactionsPage.tsx`(286줄)·`0010_transaction_links.py`·store/format 변경은 모두 타 작업 소유. 본 QA는 account-types AC만 채점한다(타 작업 코드는 별도 /qa 대상). 이 섞임 자체는 아래 발견 이슈에 [Low] 관찰로 기록.

이 작업의 실제 변경 파일: `backend/app/schemas.py`(AccountType Literal), `backend/app/models.py`(주석), `frontend/src/types.ts`(union), `frontend/src/pages/SettingsPage.tsx`(ACCOUNT_TYPES), `frontend/src/pages/AssetsPage.tsx`(ACCOUNT_TYPE_LABEL).

## 성공 기준 채점
- ✅ AC-1: 브라우저에서 설정 > 자산 계정 > 계정 추가 폼의 유형 드롭다운을 열어 옵션 11종을 실측 — `[은행,현금,카드,간편결제,전자금융자산,투자,주식,부동산,보증금,대출,기타]`. 신규 3종 한글 라벨 노출 확인. 각 유형 저장은 API로 생성 성공(아래 AC-2).
- ✅ AC-2: 라이브 백엔드 `POST /api/v1/accounts`에 `e_money`/`deposit`/`loan` 각각 전송 → **201**, 응답 `linked_account_id: null`. OpenAPI(`/openapi.json`)의 AccountType enum = 11값 전체 포함. 엣지: `e_money`+`linked_account_id` 지정 → **422**(스키마 model_validator 정상).
- ✅ AC-3: `e_money` 계정(개설 0)에 수입 100,000 + 지출 30,000 거래 생성 → assets에서 잔액 **70,000**(= 0+100,000−30,000). easy_pay처럼 연결 계정으로 빠져 0으로 수렴하지 않음(자체 보유) 확인.
- ✅ AC-4: `loan` 개설 -1,000,000 생성 → 계정 잔액 **-1,000,000**, grand_total이 baseline 463,600,200에서 정확히 4,070,000 증가(= deposit 5,000,000 − loan 1,000,000 + e_money 70,000). 대출 단독 기여분 −1,000,000 확인. 자산 페이지에 "-1,000,000원" 표시(라이브 UI 실측).
- ✅ AC-5: `deposit` 개설 5,000,000 → 잔액 **5,000,000**(고정), 평가액 입력 UI 없음(VALUATION_TYPES 미포함), 자산 페이지에 '보증금' 그룹 카드 분리 표시.
- ✅ AC-6: 백엔드 Literal(11값) == 프론트 union(11값) == 라이브 OpenAPI enum(11값), 신규 3값 동일 문자열 존재. `cd frontend && npm run build`(tsc -b + vite) EXIT 0, 타입 오류 없음(3672 modules).
- ✅ AC-7: 자산 페이지에 '간편결제' 그룹 헤더 **없음**(HIDDEN_GROUP_TYPES 유지, easy_pay 계정은 그룹 미노출). `VALUATION_TYPES=["stock","real_estate"]`·`LINKABLE_TYPES`·`HIDDEN_GROUP_TYPES` diff상 불변, 주식/부동산 그룹 정상 렌더.
- ✅ AC-8: 레시피 A(iframe 375px)로 `/assets`·`/settings` 실측 → `pageHasHorizontalScroll=false`, `unclippedOffenders=[]` (양쪽 docScrollWidth 360 ≤ 375). 신규 보증금/대출 그룹 카드(음수 -1,000,000원 포함) 오버플로 없음.

## 검증 시나리오
- 스택 상태: docker compose 기동 중이었으나 라이브 OpenAPI enum이 구값이라 **작업 트리와 불일치** 확인(served JS `index-7s4y` vs 신규 빌드 `index-B8vqCZgh`). 레시피 규칙에 따라 `docker compose up --build -d` **1회 재빌드**(EXIT 0) 후 OpenAPI enum·served JS가 현재 트리와 일치함을 재확인하고 검증 수행.
- 실데이터 보호: 검증 전 accounts 24건·transactions 184건 조회. 거래는 **2019-01** 과거 월·수동 생성(POST)만 사용(delete-then-insert 엑셀 경로 미사용). 계정/거래 생성은 가산적.
- API 검증: 계정 3건 생성(id 26/27/28) → 거래 2건(id 243/244) → assets 잔액·grand_total 검산 → 전부 DELETE(계정 3×204, 거래 2×204).
- 정리 확인: accounts **24**, transactions **184**(baseline 복귀), `QA_%_zzz` 계정 **0**, 2019-01-15/16 거래 **0**, grand_total **463,600,200**(baseline 정확 복귀). 파생 생성물 없음.
- 브라우저 실측: 설정 폼 라디스 Select 옵션 열람, 자산 그룹 헤더·금액 텍스트 검사, 375px iframe 오버플로 측정. iframe 정리(`qa-vp` remove).

## 발견 이슈
- [Low] 작업 트리 오염 — account-types 변경과 transaction-linking 변경이 같은 워킹 트리/공유 파일(`schemas.py`,`models.py`)에 섞여 있어 단일 작업 격리 리뷰·커밋이 어려움. /git-commit에서 작업별 분리 커밋 필요(구현 결함 아님, 프로세스 관찰).
- [Low] `frontend/src/pages/SettingsPage.tsx:37-48` vs `frontend/src/pages/AssetsPage.tsx:32-44` — 두 유형 목록의 꼬리 순서가 불일치: 폼(ACCOUNT_TYPES)은 `...deposit, loan, other`, 그룹 라벨(ACCOUNT_TYPE_LABEL)은 `...deposit, other, loan`. 각각 "대출을 자산 그룹 맨 끝" vs "기타를 폼 catch-all 끝"이라는 서로 다른 의도로 방어 가능하나, 유지보수 시 혼동 소지. 동작 영향 없음.

## QA 중 적용한 수정 (Low 한정)
- 없음. 위 두 Low는 모두 국소 오타/문서 정정이 아니라 (1) 커밋 분리는 QA 권한 밖 프로세스, (2) 드롭다운/그룹 순서 변경은 **UI에 보이는 순서를 바꾸는 동작 변경**이라 "동작 불변" 범위를 벗어남 → 자동 수정 대상 아님(Action Item에도 Medium/High가 아니므로 미기재, 관찰로만 유지).

## 수정 Action Items (FAIL/CONDITIONAL 시)
- 해당 없음(PASS).

## 다음 단계
PASS — /git-commit 진행 가능. 단, 커밋 시 account-types 변경과 transaction-linking 변경을 **별도 커밋으로 분리**할 것.
