# QA Report: 엑셀 업로드 시 거래에 선택 구성원 귀속

- 날짜: 2026-06-11
- 작업 폴더: docs/tasks/2026-06-11-excel-import-transaction-member
- 판정: PASS

채점 기준: `research.md` 부록의 **개정 성공 기준**(사용자 결정에 따라 원안의 "계정 소유자 상속"이 "선택 구성원 일괄 귀속"으로 대체됨 — 부록에 "이것으로 채점" 명시).

## 성공 기준 채점

- ✅ AC-1(개정): 업로드된 모든 import 거래의 `member_id`가 선택 구성원과 일치 — 구현자의 verify.py를 컨테이너에서 직접 재실행해 PASS 확인 + 독자 작성 엣지 스크립트(E4)에서 **타인 소유 기존 계정의 거래도** 선택 구성원으로 귀속됨을 추가 확인. 코드상 `transactions.py:194`에서 `member_id=member_id` 확인.
- ✅ AC-2(개정): 같은 월에 A 업로드 후 B 업로드 시 A 거래 보존 — verify.py 재실행으로 확인 (B 업로드 시 deleted=0, A 거래 2건·B 거래 1건 공존).
- ✅ AC-3: 구성원 필터에 import 거래가 잡힘 — verify.py 재실행 + 라우터 필터(`transactions.py:80-81`)가 동일 조건(`Transaction.member_id == member_id`)임을 정적 확인 + 라이브 `GET /api/v1/transactions?member_id=`가 정상 응답하며 불일치 행 0건 확인 (현재 실 DB에 거래 데이터가 없어 라이브는 wiring 확인 수준).
- ✅ AC-4(개정): 같은 구성원 재업로드 시 무중복 교체 + 레거시 NULL 정리 + 수동/타 구성원 보존 — verify.py 재실행(deleted=2, created=2, 수동 거래 member_id NULL 그대로 보존) + 독자 스크립트 E5에서 **다른 달의 NULL import 잔재는 보존**됨(월 범위 한정 삭제) 추가 확인.
- ✅ AC-5: 다이얼로그 라벨·도움말이 새 동작 설명 — 소스(`TransactionsPage.tsx:797,810-818`) 확인: 라벨 "구성원", "업로드되는 모든 거래가 이 구성원의 거래로 기록", "같은 구성원으로 업로드한 내역이 있으면 삭제 후 다시 등록…다른 구성원의 업로드 내역과 직접 입력한 거래는 그대로 유지". 배포된 프런트 번들 grep으로 새 문구 존재·구 문구("새 계정 기본 소유자")와 구 파라미터(`default_member_id`) 부재 확인.
- ✅ AC-6: 가져오기 결과 보고 기존 동작 유지 — 독자 스크립트 E4에서 deleted/created 카운트, skipped 2건(이체·0원) 사유 보고, created_accounts(신규 계정만, 기존 계정 미포함), created_categories 모두 정상 확인. 응답 스키마(`ImportResult`) 무변경.

## 검증 시나리오

실행 환경: docker compose 3개 서비스 모두 기동 중. 컨테이너 내 `transactions.py` MD5가 작업 트리와 일치함을 확인한 뒤 검증 (배포 코드 = 평가 대상 코드 보장).

1. `Get-Content verify.py -Raw | docker compose exec -T backend python -` → **ALL PASS** (구현자 스크립트 재실행, sqlite in-memory — 실 DB 미접촉).
2. 독자 작성 엣지 스크립트 (stdin 파이프, 레포에 파일 미생성, sqlite in-memory) → **ALL EDGE PASS**:
   - E1: 존재하지 않는 member_id → 404, 데이터 무변경 (검증이 삭제보다 먼저라 안전).
   - E2: 대상 월에 행이 없는 파일 → 422, 기존 import 데이터 보존 (빈 월 삭제 사고 방지 가드 동작).
   - E3: 손상 파일(.xlsx 아님) → 422.
   - E4: 타인(B) 소유 기존 계정 거래를 A로 업로드 → 거래는 A 귀속, 계정 소유자는 B 유지, created_accounts에 기존 계정 미포함, skipped(이체·0원 행) 보고 정상.
   - E5: 삭제는 대상 월로 한정 — 다른 달의 NULL import 잔재 보존.
3. 라이브 HTTP (실 DB, 비파괴 요청만):
   - `POST /api/v1/transactions/import` (member_id=999999) → 404 `{"detail":"구성원을(를) 찾을 수 없습니다 (id=999999)"}`.
   - member_id 누락 → 422 (필수 필드).
   - `GET /openapi.json` → import 폼 스키마에 `member_id` required 반영.
   - `GET /api/v1/transactions?member_id=1|2` → 200, 불일치 행 0건.
4. 배포 프런트 번들 grep → 새 문구 존재, 구 라벨·구 파라미터명 부재. (프런트 이미지가 변경 코드로 빌드 성공했다는 사실 자체가 tsc+vite 빌드 통과의 증거.)
5. 검증용 임시 파일은 OS 임시 디렉터리에 생성 후 삭제. `git status`로 레포 무변경 확인 (본 보고서 제외).

## 발견 이슈

- [Low] `frontend/src/pages/TransactionsPage.tsx` — 본 작업의 변경(업로드 다이얼로그)과 별개 작업(shadcn-date-picker의 `MonthPicker`/`DatePicker` 도입)이 같은 파일·같은 작업 트리에 섞여 있음. 기능 결함은 아니나 커밋 시 작업별 분리에 주의 필요 (diff에 `AssetsPage.tsx`, `SettingsPage.tsx`, `package.json` 등 타 작업 파일도 포함됨).
- [Low] `backend/app/routers/transactions.py:115-200` — 같은 월·같은 구성원 업로드가 동시에 2건 실행되면(read committed) 삭제-삽입이 교차해 중복 삽입될 수 있음. 단일 사용자 가계부 앱이고 기존 설계부터 동일한 특성이라 실질 위험은 낮음. 잠금(`SELECT ... FOR UPDATE`)이나 유니크 제약 도입은 본 작업 범위 밖.

(High/Medium 이슈를 찾기 위해 시도한 것: 없는 구성원·빈 월·손상 파일·타인 계정·타 월 잔재·동시성·파라미터 개명 잔존 참조(`default_member_id` 전체 grep — 0건)·배포 코드 불일치 가능성을 모두 점검했으며 결함을 발견하지 못함.)

## 수정 Action Items (FAIL/CONDITIONAL 시)

- 해당 없음 (PASS).

## 다음 단계

/git-commit 진행 가능. 단, 작업 트리에 3개 작업의 변경이 섞여 있으므로 본 작업분(`backend/app/routers/transactions.py`, `TransactionsPage.tsx`의 업로드 다이얼로그 부분, `docs/tasks/2026-06-11-excel-import-transaction-member/`)을 다른 작업(date-picker, category-collapsible-groups)과 분리 커밋할 것을 권장.
