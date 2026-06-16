# QA Report: 자산 카드의 '잔액 구성'(usage_breakdown) 분해 제거

- 날짜: 2026-06-16
- 작업 폴더: docs/tasks/2026-06-16-remove-card-balance-breakdown
- 판정: CONDITIONAL PASS

## 성공 기준 채점

- ✅ AC-1: `GET /analytics/assets` 응답에 `usage_breakdown` 키 부재.
  - **주의**: 처음 발견한 기동 중 스택(backend 19분 전 기동)은 구 코드 이미지로 `usage_breakdown`을 여전히 반환했다. docker-compose에 backend/frontend 코드 볼륨 마운트가 없어(이미지 baked) 작업 트리와 불일치 → 스킬 규칙대로 `docker compose up -d --build backend frontend`로 1회 재빌드/재기동 후 실측.
  - 재빌드 후 `http://localhost:8000/api/v1/analytics/assets` 응답 11개 계정 전부 키 = `['id','name','type','is_active','balance','valued_at']`, `usage_breakdown` 없음. openapi.json의 `AccountBalance` props도 동일.
- ✅ AC-2: `UsageSource` 양쪽 제거. `schemas.py`·`types.ts` 직접 Read로 정의 부재 확인. 레포 전체 grep(`usage_breakdown|UsageSource`)에서 코드 0건(docs 이력 파일만 잔존, 의도된 보존). openapi.json `components.schemas`에 `UsageSource` 부재.
- ✅ AC-3: 자산 페이지 카드에 '잔액 구성' 분해 미렌더. 브라우저(localhost:3000/assets) `get_page_text` 결과 어디에도 '잔액 구성'·'직접 사용'·채널 분해 라인 없음. card14(ALL 우리카드 Infinite)는 잔액 -24,314,758원만 표시. easy_pay 그룹은 `HIDDEN_GROUP_TYPES`로 비노출.
- ✅ AC-4: 간편결제 패스스루 유지. DB 직접 검산으로 card14 잔액 분해:
  - card14 own signed = -22,003,798 / easy_pay 16 = -958,004 / 18 = -851,596 / 20 = -501,360 / opening(14)=0 / transfer bridge=0 / valuations(14)=0
  - 합 = -24,314,758 = API의 card14 balance와 정확히 일치. easy_pay 16/18/20 잔액은 모두 0(opening으로 수렴) → 간편결제 지출이 연결 카드로 귀속되고 easy_pay 계정 잔액은 불변. `total`/`grand_total`(-17,303,649)은 구·신 빌드 동일 → 잔액 의미 불변.
- ✅ AC-5: build·lint·py_compile 통과.
  - 프론트 build: frontend Dockerfile이 `npm run build`(tsc -b && vite build)를 빌드 단계에서 실행, 재빌드 시 이미지 정상 생성("frontend Built"). types.ts 필드 제거 후 컴파일 정상 = 잔존 참조 없음.
  - lint: `cd frontend && npm run lint` → 0 errors (TransactionsPage.tsx 사전 경고 2건은 무관, 본 변경 파일 경고 0).
  - 백엔드: `python -m py_compile app/schemas.py app/routers/analytics.py` → 통과.
- ✅ AC-6 (모바일): 변경은 분해 블록 **제거만** 수행(추가 없음). 잔여 계정 그리드는 `grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3`(모바일 퍼스트 단일 열) — 고정 px 너비·미처리 오버플로 없음. 제거로 콘텐츠 높이만 줄어 신규 오버플로 유발 불가.
  - **동적 미확인 사실**: `resize_window`로 375px/390px 지정해도 이 Chrome 인스턴스 렌더 뷰포트가 1512px로 고정되어 375px 실측 스크린샷은 불가했다. 정적 점검 + 데스크톱 렌더에서 분해 부재만 확인. research에 모바일 AC(AC-6)가 명시되어 계약 누락은 아님.

## 검증 시나리오

- 정적: 변경 4파일 전체 Read + `git diff backend/app/routers/analytics.py`로 제거 범위 확인. `signed_by_account`/`bridge_by_account` 중간 맵 제거 후 `net_by_account` 2-블록(부호합 + 이체 입금 다리, 각 `_route` 적용) 복원 — 라우팅 로직 동일.
- grep `usage_breakdown|UsageSource` (레포 전체) → 코드 0건.
- 동적: 기동 스택이 구 코드(baked image, 볼륨 마운트 없음)임을 openapi/엔드포인트로 탐지 → backend+frontend 1회 재빌드 후 실측.
- API 실측: `/api/v1/analytics/assets`(키 부재), `/openapi.json`(스키마 부재), `/api/v1/accounts`(easy_pay 연결 확인).
- DB 검산: psql로 card14 패스스루 구성요소 합산 = API 잔액 일치.
- 브라우저: localhost:3000/assets `get_page_text`로 분해 미렌더 확인, 콘솔 에러 0건.
- 정리: 임시 브라우저 탭 close, `git status` 무변경(작업 4파일 + 신규 docs 폴더만) 확인.

## 발견 이슈

- [Low] `frontend/src/pages/AssetsPage.tsx:40-41` — `HIDDEN_GROUP_TYPES` 주석이 "대신 연결 계정 카드 안에서 '직접/간편결제 사용' 분해로 보여준다"라고 서술하나, 본 작업으로 그 분해가 제거됨. 주석이 더 이상 존재하지 않는 동작을 설명 → 사실과 불일치(코드 품질). 동작 영향 없음. (수정 제안: 분해 언급 삭제, "패스스루로 잔액이 연결 카드/은행에 귀속되므로 자체 그룹으로 노출하지 않는다"만 유지.)

## 수정 Action Items (CONDITIONAL)

- [ ] `frontend/src/pages/AssetsPage.tsx:41`의 stale 주석에서 "대신 연결 계정 카드 안에서 '직접/간편결제 사용' 분해로 보여준다." 문장 제거.

## 다음 단계

CONDITIONAL PASS — 모든 AC 충족, High 0건, Medium 0건, Low 1건(주석 불일치). Low 이슈는 동작에 영향 없으므로 `/git-commit` 진행이 가능하나, 사실과 어긋난 주석을 남기지 않으려면 `/implement docs/tasks/2026-06-16-remove-card-balance-breakdown`로 주석 1줄 수정 후 커밋을 권장.
