# QA Report: 엑셀(뱅샐현황) 업로드로 부동산·주식 평가액 자동 갱신

- 날짜: 2026-06-16
- 작업 폴더: `docs/tasks/2026-06-16-excel-asset-valuation-import`
- 판정: PASS

## 검증 환경
- 실행 중인 docker 스택(backend :8000, frontend :3000, db postgres) 재사용.
- 단, 기동된 backend 컨테이너는 **round-1 코드**였음(작업 트리와 불일치 — `_effective_valuations` 부재 확인). 작업 트리의 현재 `excel_import.py`/`transactions.py`/`schemas.py`를 컨테이너에 `docker cp` 후 `docker restart`로 갱신해 **현재 코드로 검증**함(레포 파일은 변경 없음, `git status` 시작 시점과 동일 확인).
- frontend 컨테이너의 서빙 번들 해시(`index-ylfKr7fI.js`)가 `npm run build` 산출 해시와 동일하고 valuation UI 문자열을 포함 → 서빙 프런트가 작업 트리와 일치 확인.
- 참조 파일 `2025-06-11~2026-06-11.xlsx` 존재 확인, 파서·업로드 검증에 사용.

## 성공 기준 채점
- ✅ AC-1: 컨테이너에서 `parse_valuations(ref bytes)` 직접 호출 → 총 11건, real_estate 1건(오산시티자이2단지 355,000,000), stock 10건(SK텔레콤 19,700,000 등). 동산(기아 더 뉴K7)·총자산·순자산 제외 확인.
- ✅ AC-2: `POST /transactions/import`(member_id=1, 2025-07) 확정 후 `GET /accounts/{id}/valuations` → 오산(355,000,000)·SK텔레콤(19,700,000)·종합매매(304) 모두 **2026-06-17(서버 date.today())** 1건 기록 확인.
- ✅ AC-3: 빈 상태(stock/real_estate 계정 0)에서 업로드 후 `GET /accounts` → 8개 계정 자동 생성, 유형 정확(오산=real_estate, 나머지=stock). `GET /analytics/assets` 잔액=평가액 확인.
- ✅ AC-4: 같은 파일 재업로드 → `valuation_count` 8 유지, `created_accounts` 빈 배열, 오산 valuations **1건만**(upsert) 확인.
- ✅ AC-5: 뱅샐현황 시트가 없는 파일(가계부 내역만)을 컨테이너에서 생성해 업로드 → HTTP 200, `valuation_count` 0, 거래는 정상 적재(created_count 1). 전체 실패 없음.
- ✅ AC-6: `POST /import/preview` 응답에 `valuations` 8건(상품명·유형·금액) 반환, `POST /import` 결과에 `valuation_count` 8 포함 확인. (원본 11 → 0원 신규 2건 제외, 종합매매 dedup 1건 = 8 일관)
- ✅ AC-7: `GET /analytics/assets`에서 오산/SK텔레콤/종합매매 `balance`=평가액, `valued_at`=2026-06-17(오늘) 확인.
- ✅ AC-8(모바일): 375px 뷰포트에서 업로드 다이얼로그를 브라우저로 열어 가로 스크롤·잘림 없이 렌더 확인(다이얼로그 컨테이너 동적 검증). 평가 미리보기 행 자체는 OS 파일 피커를 하네스에서 구동 불가(`HTMLInputElement.value`는 프로그램 설정 불가)하여 **동적 렌더 미확인** — 마크업 정적 검증: `flex items-center justify-between gap-2` + 상품명 `min-w-0`/`truncate` + 금액 `shrink-0 tabular-nums`로 오버플로 방지 패턴 적용됨. research에 모바일 AC(AC-8)가 포함되어 계약 누락 없음.
- ✅ AC-9: `cd frontend && npm run build`(tsc -b && vite build) 성공(에러 0, chunk-size 경고만 — 기존 사항). 백엔드는 현재 코드로 컨테이너 재기동·`/docs` 200·import 정상 동작으로 로드 무오류 확인.

## 검증 시나리오
- `parse_valuations` 직접 호출(컨테이너 python) — 11건, 유형/금액/제외 항목 확인.
- 월 탐색: `2025-07` month_rows=64, importable=59, review=5, valuations=8.
- import(member 1) → valuation_count 8, 8계정 생성(38~45), 유형 정확.
- 재import → upsert(중복 없음, valuations 1행 유지).
- 0원/dedup: 종합매매 raw [0,304] → 최종 304(0원 미덮어씀), 0원 신규(금현물전용·우리사주예탁) 미생성.
- 뱅샐현황 부재 파일(openpyxl로 컨테이너 /tmp 생성) → import 200, valuation 0, 거래 적재 정상.
- frontend `npm run build` 1회 성공. 서빙 번들 해시 동일 확인.
- 브라우저 375px: /transactions → "엑셀 업로드" 다이얼로그 정상 렌더(오버플로 없음). 평가 미리보기 단계는 파일 피커 한계로 미구동.
- 정리: 브라우저로 생성한 데이터 없음. API 검증으로 dev DB에 테스트 계정/거래/평가가 생성됨(member1 2025-07, member2 noval) — dev 스택 한정이며 데이터 삭제는 안전 규칙상 수행하지 않음(아래 참고). 레포 파일·`git status` 무변경 확인.

## 발견 이슈
- [Low] `backend/app/routers/transactions.py:197,221 vs 280,421` — 미리보기와 확정의 `_effective_valuations(content, accounts)` 호출 시 `accounts` 사전 상태가 다를 수 있다. 미리보기는 **DB 계정만**으로 산출하지만, 확정은 가계부 거래 적재 루프(`ensure_account`)가 **이번 업로드에서 새로 만든 결제수단 계정까지 포함된** 사전으로 산출한다. 따라서 평가 상품명이 이번 import에서 처음 생성되는 결제수단 계정명과 동일하면(예: 투자성 자산 `기업은행`이 가계부 결제수단으로도 등장해 `bank` 계정으로 신규 생성), 미리보기는 그 항목을 포함(신규·비영)하지만 확정은 "동명 비시세형 계정"으로 제외해 **미리보기 건수 > 실제 valuation_count**가 된다. implementation.md의 "미리보기와 확정이 같은 집합·건수를 보장" 주장은 해당 충돌이 없을 때만 성립. 영향: 사용자에게 보이는 건수 표시상의 경미한 불일치(데이터 손상·크래시 아님), 특정 이름 충돌이 있어야 발생. 참조 파일에서는 충돌이 없어 미발생(미리보기 8 = 결과 8 확인).
- [Low] `frontend/src/pages/DashboardPage.tsx` — 이 작업과 무관한 변경(대시보드 가이드 배너 제거, 별도 작업 폴더 `2026-06-16-remove-dashboard-guide-banner` 소관)이 작업 트리에 함께 섞여 있다. 이 작업 AC와 무관하며 빌드도 통과하지만, `/git-commit` 시 커밋을 분리하지 않으면 본 작업 커밋에 무관 변경이 포함된다. implementation.md도 분리 필요로 명시.

## 참고(이슈 아님)
- 검증 과정에서 dev DB에 테스트 데이터(평가 계정 8개, 가계부 거래, AssetValuation)가 생성됨. 안전 규칙상 데이터 영구 삭제는 수행하지 않았으며, 재업로드가 멱등(월/구성원 단위 삭제 후 재등록)이라 운영상 무해. 필요 시 사용자가 정리.
- 검증을 위해 stale 상태였던 backend 컨테이너를 현재 작업 트리 코드로 갱신·재기동함(레포 변경 없음). 컨테이너는 현재 작업 트리와 일치하는 상태로 유지됨.

## 수정 Action Items
- PASS이므로 필수 수정 없음. 권장(선택):
- [ ] (Low) `preview_import`와 `import_transactions`가 동일 시점·동일 계정 집합으로 `_effective_valuations`를 평가하도록 정렬하거나, 미리보기 산출 시점을 가계부 계정 생성 가정과 일치시켜 건수 표시 불일치 가능성 제거.
- [ ] (Low) `/git-commit` 단계에서 `DashboardPage.tsx` 무관 변경을 별도 커밋으로 분리.

## 다음 단계
PASS — `/git-commit` 진행 가능. 단, 커밋 시 `DashboardPage.tsx` 무관 변경은 별도 커밋으로 분리할 것.
