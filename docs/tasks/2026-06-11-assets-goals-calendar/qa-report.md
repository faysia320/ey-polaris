# QA Report: 주식·부동산 자산 관리 + 목표금액 달성 현황 + 거래 캘린더 뷰 (2차 재검증)

- 날짜: 2026-06-11
- 작업 폴더: docs/tasks/2026-06-11-assets-goals-calendar
- 판정: PASS

> 1차 QA(CONDITIONAL PASS)의 Medium 2건 + Low 3건 수정분에 대한 독립 재검증. research.md의 AC-1~17을 채점 기준으로 사용. implementation.md 자가 체크는 인용하지 않고 전부 직접 재확인함.

## 성공 기준 채점

- ✅ AC-1: `POST /api/v1/accounts`로 `stock`/`real_estate` 생성 201. 잘못된 type(`crypto`) → 422. 브라우저 기준정보 관리 > 자산 계정 유형 셀렉트에 "주식"/"부동산" 노출 확인 후 실제로 "QA-테스트주식"(stock) 생성, `GET /accounts` 응답에 `type:"stock"` 포함 확인.
- ✅ AC-2: `PUT /accounts/{id}/valuations` 기록(200), `GET` 목록(정렬 desc), `DELETE`(204) API 직접 확인. 자산 페이지 "평가액 갱신" 다이얼로그로 5,000,000원 기록 → 카드 즉시 5,000,000원 + "평가 기준일 2026-06-11" 갱신 확인. (평가 이력 표시/개별 삭제 UI는 research Action Item에서 "구현 재량"으로 위임됨 — 아래 Low 참고)
- ✅ AC-3: 평가액 5,000,000 기록 후 `/analytics/assets`에서 `balance=5500000`(API 테스트 시), `valued_at` 채워짐, `total`에 합산 확인. UI에서도 총자산 0 → 5,000,000원 갱신 확인.
- ✅ AC-4: 평가액 없는 시드 계정(id 1,2) balance가 변경 전후 0으로 동일. 전체 정리 후 `total=0`, 계정 2개 무변화(회귀 없음) psql 카운트로 확인.
- ✅ AC-5: 과거 월(2026-03-15) 평가액 1,000,000 기록 → trend의 2026-03~05 = 1,000,000(월말 기준 최신 평가액 이월), 2026-06 = 5,500,000 확인. 2차 최적화(`row_number()` 윈도우 + 포인터 워크) 결과가 동일함을 API로 재확인.
- ✅ AC-6: 같은 (계정,날짜)에 2회 PUT → 동일 id로 값만 5,000,000→5,500,000 갱신(upsert). 동시 PUT 10건 병렬 전송 시 전부 200(500 없음) — `commit_or_conflict` 치환 후 경합 경로 안정성 확인.
- ✅ AC-7: `POST/PUT/DELETE /goals` 정상. `target_amount=0`→422, `-5`→422, 중복 이름→409, 없는 id PUT→404, 없는 id DELETE→404 확인.
- ✅ AC-8: 브라우저에서 총자산 5,000,000 / 목표 10,000,000 → "5,000,000원 / 10,000,000원 (50%)" + 진행바 절반 렌더 확인.
- ✅ AC-9: 목표 1,000,000 < 총자산 5,000,000 → "(500%)" 실제 수치 표시 + 진행바 100% 캡(초록색 풀바, `Math.min(rate,1)`) 확인. UI 깨짐 없음.
- ✅ AC-10: 목표 전체 삭제 후 자산 페이지 정상 렌더 + 빈 상태 문구("아직 목표가 없어요...") 표시 확인.
- ✅ AC-11: 테이블↔캘린더 토글 동작. 2026-06 캘린더에서 6/5 = +3,000,000/-12,000, 6/11(오늘, 노란 원 강조) = -4,500 표시 — 입력 거래와 일치. 요일 배치(6/1=월, 6/5=금, 6/11=목) 정확.
- ✅ AC-12: 6/5 셀 클릭 → "2026-06-05 거래" 2건(수입 급여 +3,000,000 / 지출 주거관리비 -12,000)만 목록 표시, 각 행에 수정/삭제 버튼 확인.
- ✅ AC-13: 월 이동 버튼으로 2026-06→…→2026-01, 2026-01→(◀)→2025-12(역방향 연도 경계), 2025-12→(▶)→2026-01(정방향 경계) 양방향 확인. 월 이동 시 선택일 해제됨.
- ✅ AC-14: 테이블 뷰에서 조회 월 입력을 비움(전체 기간, 4건 표시) → 캘린더 전환 시 현재 월(2026-06)로 자동 설정, 필터 입력도 "2026년 06월"로 채워짐, 오류 없음.
- ✅ AC-15: 테이블 뷰 필터(월/구분/카테고리), 정렬 헤더, 페이지네이션("1/1 페이지", 이전/다음 disabled), 거래 추가/수정/삭제 동작. 빈 월 필터 시 전체 기간 4건 정상 조회. 앱 콘솔 에러 0건(관측된 6건은 브라우저 확장 message-channel 오류로 앱과 무관).
- ✅ AC-16: `npm run build`(tsc -b + vite) 통과. `npm run lint` 에러 0 — 경고 1건은 `useReactTable` react-compiler 호환 경고로 HEAD에도 존재하는 기존 항목.
- ✅ AC-17: `alembic current=0003(head)`. `downgrade 0002`→두 테이블 0개, `upgrade head`→두 테이블 2개 재생성, 시드 데이터 무변경(accounts 2, categories 16). FK `ondelete=CASCADE`(confdeltype=c), `(account_id,date)` 유니크, `ix_asset_valuations_date` 인덱스 psql 확인. 비파괴.

## 검증 시나리오

- 환경: docker compose 스택(backend:8000, frontend:3000, postgres) 가동. 프론트 컨테이너를 현재 작업 트리로 재빌드해 서빙 번들 해시(`index-DzOfvHUy.js`)가 로컬 빌드와 일치함을 확인 후 브라우저 검증.
- 2차 수정 반영 확인(컨테이너 코드 grep): `valuations.py`가 `commit_or_conflict` 사용, `schemas.py`에 `date_not_in_future` 검증, `analytics.py`에 `row_number` 윈도우 적용.
- API: stock/real_estate 생성·잘못된 type 422, 평가액 upsert/미래날짜 422/음수 422/없는 계정 404/타 계정 평가액 삭제 404, 동시 PUT 10건 전부 200, 평가일 이후 거래(+999,999) 잔액 미가산(평가액 단독 규칙) 확인, 목표 CRUD/422/409/404, 계정 삭제 시 평가액 CASCADE(psql 0건).
- UI: 자산 페이지 평가액 갱신 다이얼로그(미래 날짜 클라이언트 차단 "기준일은 미래 날짜일 수 없습니다" 확인), 목표 50%/500% 진행바 캡, 빈 상태 문구. 캘린더 토글/일자 합계/날짜 선택/월 이동(연도 경계 양방향)/빈 필터 전환.
- 마이그레이션: downgrade 0002 → upgrade head 왕복 성공, 스키마 제약 확인.
- 정리: 생성한 QA 데이터(계정·목표 3·거래 4·평가액) 전부 삭제, `/analytics/assets` total=0·시드 계정 2개 무변화·`asset_valuations`/`goals` 0건 복원. `git status`로 레포 작업 트리에 본 검증으로 인한 변경 없음 확인(qa-report.md 제외).

## 발견 이슈

- [Low] `frontend/src/pages/AssetsPage.tsx:102-106` — 평가액 입력값이 빈 문자열이면 `Number('')===0`이라 빈 칸으로 "기록" 클릭 시 422가 아니라 0원 평가액이 기록됨(서버 `value ge=0` 허용). 날짜는 `!valuationDate` 빈값 가드가 있으나 금액은 없음. 영향: 실수로 0원 스냅샷이 생기면 해당 계정이 평가액 기반으로 바뀌어 잔액이 0으로 표시됨. 복구는 같은 날짜에 올바른 값 재기록(upsert)으로 가능.
- [Low] `frontend/src/pages/AssetsPage.tsx` — 평가액 이력 목록·개별 삭제 진입점이 UI에 없음(DELETE API는 존재). UI만으로는 계정을 평가액 기반에서 거래 기반으로 되돌릴 수 없음. research.md Action Item에서 "평가 이력 표시 범위는 구현 재량"으로 위임했으므로 AC-2 미충족으로 보지는 않음(기록·수정은 upsert 다이얼로그로 가능).
- [Low] `frontend/src/components/transactions/TransactionCalendar.tsx:29-38` — 일자별 합계가 거래 스토어 `items`를 그대로 집계하므로 상단의 구분/카테고리 필터가 켜져 있으면 캘린더 합계에도 반영됨(테이블과 공유). implementation.md에 의도된 동작으로 기재됨. 사용자에게는 "캘린더 합계가 전체 합계와 다를 수 있음"이 다소 비직관적일 수 있어 안내 문구가 있으면 좋음.

## 수정 Action Items (선택, 비차단)

- [ ] (선택) `submitValuation`에 빈 금액 가드 추가: `if (valuationValue.trim() === '') return setValuationError('평가액을 입력해주세요')`.
- [ ] (선택) 자산 페이지에 평가액 이력/삭제 진입점 제공해 평가액 기반→거래 기반 되돌리기를 UI로 지원.
- [ ] (선택) 캘린더 합계가 구분/카테고리 필터 영향을 받음을 알리는 보조 문구.

## 다음 단계

PASS — 모든 AC 충족, High/Medium 0건(Low 3건만). `/git-commit` 진행 가능. (Low 항목은 후속 개선으로 분리 권장)
