# Implementation: 엑셀 업로드 시 거래에 선택 구성원 귀속

- 날짜: 2026-06-11
- 기반 명세: `docs/tasks/2026-06-11-excel-import-transaction-member/research.md` (부록의 개정 계약 기준)

## 변경 파일

- `backend/app/routers/transactions.py` — 가져오기 파라미터 `default_member_id` → `member_id` 개명, 모든 import 거래에 `member_id` 저장(기존 `None` 하드코딩 제거), 같은 월 재업로드 삭제 범위를 `source='import' AND (member_id=선택 구성원 OR member_id IS NULL)`로 축소, docstring 갱신, `or_` import 추가.
- `frontend/src/pages/TransactionsPage.tsx` — 업로드 다이얼로그 라벨 "새 계정 기본 소유자" → "구성원", 도움말·교체 안내 문구를 새 동작에 맞게 갱신, 검증 에러 메시지 갱신, FormData 필드명 `member_id`로 변경.
- `docs/tasks/2026-06-11-excel-import-transaction-member/research.md` — 사용자 결정(선택 구성원 일괄 귀속)에 따른 계약 개정 부록 추가 (/qa 채점 기준).
- `docs/tasks/2026-06-11-excel-import-transaction-member/verify.py` — 자체 검증 스크립트 (sqlite in-memory, 실 DB 미접촉).

## 주요 결정

- **research.md 원안과 다른 점 (사유: /implement 입력의 사용자 지시)**: 원안의 "계정 소유자 상속" 대신 **다이얼로그에서 선택한 구성원을 모든 거래에 일괄 지정**. 사용자가 구성원별 엑셀 파일을 따로 업로드하는 워크플로를 명시했기 때문. 상세는 research.md 부록 참조.
- **교체 범위 축소 (파생 필수 변경)**: 구성원별 업로드 워크플로에서 기존 "같은 월 import 전체 삭제" 로직은 두 번째 구성원 업로드가 첫 번째 구성원 데이터를 지우는 문제가 있어, 삭제 범위를 같은 구성원(+레거시 NULL)으로 축소했다. `IS NULL` 포함은 구성원 지정 이전 업로드 잔재의 자연 정리용.
- **마이그레이션 0006(백필) 제외**: 과거 업로드의 의도 구성원을 DB로 복원할 수 없고, 사용자가 소유자별 재업로드를 계획 중이며 재업로드 시 NULL 잔재가 자동 정리되므로 불필요 (원안 AC-4 대체).
- **파라미터 개명** `default_member_id` → `member_id`: 더 이상 "새 계정의 기본값"이 아니라 모든 거래의 귀속 구성원이므로. 호출자는 자사 프런트뿐이라 호환성 부담 없음.

## 자체 검증 결과

- 실행 명령: `npm run build` (frontend) → **통과** (tsc -b + vite build, 1.19s. 기존부터 있던 청크 크기 경고만 출력)
- 실행 명령: `docker compose up -d --build backend frontend` → **통과** (이미지 재빌드·재기동 정상)
- 실행 명령: `Get-Content verify.py -Raw | docker compose exec -T backend python -` → **ALL PASS** (4개 시나리오: 선택 구성원 귀속+레거시 정리+수동 보존 / 타 구성원 보존 / member_id 필터 / 동일 구성원 재업로드 무중복 교체)
- 라이브 API 확인: `GET /openapi.json`에서 `/transactions/import` 폼 스키마에 `member_id`(required) 반영 확인
- 테스트 인프라(pytest 등) 부재 — verify.py는 컨테이너 내 sqlite in-memory로 실행되어 실 DB를 건드리지 않음

## 성공 기준 자가 체크 (research.md 부록의 개정 AC 기준)

- [x] AC-1(개정): 업로드된 모든 import 거래의 `member_id`가 선택 구성원과 일치 — verify.py PASS
- [x] AC-2(개정): 같은 월에 구성원 A 업로드 후 B 업로드 시 A 거래 보존 — verify.py PASS
- [x] AC-3: 구성원 필터에 import 거래가 잡힘 — verify.py PASS
- [x] AC-4(개정): 같은 구성원 재업로드 시 중복 없이 교체, 레거시 NULL 정리, 수동·타 구성원 거래 보존 — verify.py PASS
- [x] AC-5: 다이얼로그 라벨 "구성원"·도움말이 새 동작 설명 — `TransactionsPage.tsx` 문구 갱신, 프런트 빌드 통과 (화면 육안 확인은 /qa에 위임)
- [x] AC-6: 가져오기 결과 보고(created/deleted/skipped, 새 카테고리·계정) 기존 동작 유지 — 응답 스키마 무변경, verify.py에서 deleted/created 카운트 검증

## 보류/미완 항목

- 없음
