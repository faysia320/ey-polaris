# QA Report: 엑셀 업로드 스텝 분리 — 자산계정 매핑 선행 후 거래 검토 (재검증 3회차)

- 날짜: 2026-07-24 (작업 폴더명 기준)
- 작업 폴더: `docs/tasks/2026-07-24-import-account-mapping-step/`
- 판정: **PASS** (AC 14/14 충족, High 0건, Medium 0건, Low 3건 — 모두 기존/문서화된 비회귀 항목)

> 이 보고서는 2회차 QA(FAIL — H-1 1건, M-4/M-5 2건)에 대한 `/implement` 재작업(재작업 2회차)의 **전 AC 재검증** 결과다. 2회차에서 지적한 High 1건·Medium 2건·Low 1건(L-6)이 모두 해소되었음을 **직접 실행으로 확인**했고, 새로운 High/Medium 회귀는 발견되지 않았다.

## 데이터 영향

**실데이터 손상 없음.** 검증은 거래 0건인 과거 월(2019-03)과 `QA*` 접두 전용 계정으로만 수행했고, 파괴적 기능(월 delete-then-insert) 실행 전 대상 월이 0건임을 매번 확인했다. 2026-06 실데이터(129건)와 기준 평가액 1건(오산시티자이2단지)은 한 번도 대상이 되지 않았다.

| 항목 | 검증 전 | 검증 후 |
| --- | --- | --- |
| accounts | 25 | 25 |
| transactions | 129 (전부 2026-06) | 129 (전부 2026-06) |
| 2019-03 거래 | 0 | 0 |
| categories | 84 | 84 |
| asset_valuations | 1 | 1 |
| `QA%` 계정 | 0 | 0 |
| 자기 이체(`account_id=counter_account_id`) | 0 | 0 |

정리 대상: 거래 3건, 평가액 2건(QA아파트/QA대출), 계정 7건(QA통장A/QA제외카드/QA아파트/QA대출/QA통장B/QA네이버페이/QA단독수단) — 전부 삭제 후 수치로 baseline 복원 확인. 파생 카테고리는 생성되지 않았다(모든 임포트에서 `created_categories`가 빈 배열, 최종 categories 84 = baseline).

## 성공 기준 채점

- ✅ **AC-1**: 샘플 .xlsx로 `POST /transactions/import/preview` 직접 호출 → `account_sources` 6건. ledger 4건의 `row_count`/`importable_count`가 정확 — `QA통장A(3/1)`(수입 1 + 이체 검토 2행), `QA제외카드(2/1)`, `QA통장B(1/0)`·`QA단독수단(1/0)`(검토 전용). valuation 1건(500,000,000), liability 1건(200,000,000). `matched_account_id`(동명 없을 때 null), `suggested_type`(휴리스틱 bank/card/other, 고정 real_estate/loan), 전체 `importable_count=2`와 소스별 합계 일치.
- ✅ **AC-2**: 브라우저(localhost:3000)에서 실제 업로드 → 다이얼로그 제목 `자산 계정 매핑 (1/2)` → `이체 내역 검토 (2/2)` → 결과 순으로 진행 확인. 소스 6건이 있을 때 매핑 스텝이 항상 선행함.
- ✅ **AC-3**: 매핑 스텝에서 `기존 계정 연결`/`새로 만들기`/`이번엔 제외` 선택지 확인. 기본값 — 동명 계정 있는 소스(QA통장A/QA제외카드/QA통장B/QA아파트/QA대출)는 `기존 계정 연결` + 해당 계정, 동명 없는 `QA단독수단`은 `새로 만들기` + 추정 유형(기타). 브라우저에서 실제 렌더 값으로 확인.
- ✅ **AC-4**: API로 엑셀 소스 `QA통장A`를 이름이 다른 기존 계정 `LOCA`(id 30, card)에 `link` → 임포트 후 해당 수입 거래의 `account_id=30`, `created_accounts` 빈 배열(새 계정 미생성). DB 조회로 확인.
- ✅ **AC-5**: 매핑 확정 엔드포인트가 계정을 즉시 생성하고(`resolve_import_accounts`), `confirmAccounts`가 `fetchAll()`로 기준정보를 재조회한 뒤 검토 스텝으로 전환(코드 확인). 브라우저 플로에서 `QA단독수단`이 확정 시 생성되어 이후 검토 스텝에서 적재 가능함을 관찰. (드롭다운 옵션 열거는 2회차 QA가 직접 확인했고 배선 코드는 무변경 — 저비용 교차 확인으로 채택.)
- ✅ **AC-6**: API로 `QA제외카드`를 exclude → 임포트 결과 3·6·7행이 `'QA제외카드' 계정을 이번 업로드에서 제외함`, DB에서 `QA제외카드` 계정의 2019-03 거래 0건.
- ✅ **AC-7**: API로 `QA아파트`(부동산)·`QA대출`(대출)을 exclude → `valuation_count: 0`, `loan_count: 0`, 계정·평가액 미생성. exclude하지 않으면 각 1건 반영되므로 제외분만큼 정확히 줄어듦을 교차 확인.
- ✅ **AC-8**: `POST /transactions/import/accounts` — liability→bank link 422, valuation→bank create 422, easy_pay create 422(스키마 validator), 타 구성원 계정 link 422. 프론트 `mappingCandidates`가 `SOURCE_REQUIRED_TYPE`으로 후보 필터(코드 확인). 임포트 경로의 이중 검증(AC-11 실패 테스트에서 liability→bank 422)도 확인.
- ✅ **AC-9**: API로 휴리스틱이 `other`로 추정하는 `QA네이버페이`를 `e_money`로 create → DB `accounts.type='e_money'` 확인.
- ✅ **AC-10 (구 H-1 회귀 해소)**: `account_mappings` 생략 + `decisions=[]` 임포트 → `created_accounts`가 `[QA통장A, QA제외카드, QA아파트, QA대출]`뿐. **이체 검토 행에만 등장하는 `QA통장B`·`QA단독수단`은 계정이 생성되지 않음**(DB 조회로 부재 확인). `created_count=2`(실제 적재된 수입/지출만). 2회차 High 회귀가 완전히 해소됨.
- ✅ **AC-11**: (a) 매핑 확정 원자성 — 유효 create + 없는 계정 link 혼합 시 404, create 대상 미생성(롤백). (b) 임포트 실패 원자성 — liability→bank 잘못된 매핑으로 422가 난 뒤 대상 월 거래 수 불변(선행 delete까지 롤백 — 실행 전 1건, 실행 후 1건). (c) 스키마 검증 — link account_id 누락 422, 없는 member 404, 빈 mappings 200.
- ✅ **AC-12**: 매핑 스텝 본문에 `여기서 확정하면 계정이 바로 만들어져요 (업로드를 취소해도 계정은 남고, 설정에서 지울 수 있어요)` 노출 확인(브라우저).
- ✅ **AC-13(모바일)**: 375px iframe 실측(레시피 A, `window.innerWidth===375`). **매핑 스텝** — `pageHasHorizontalScroll: false`, `unclippedOffenders: []`, 다이얼로그 폭 326px(left 25 ~ right 350). 동작 Select 122px + 계정/유형 Select 167px 모두 다이얼로그 경계 안. **검토 스텝** — 동일하게 `pageHasHorizontalScroll: false`, offender 0. 컨트롤 높이 30px는 같은 다이얼로그의 기존 Select와 동일 값(L-9 참조 — 비회귀).
- ✅ **AC-14**: `npm run build`(tsc + vite) → 통과(`dist/static/index-Dt0nTrEu.js`). `npm run lint` → `0 errors, 2 warnings`(`TransactionsPage.tsx:579,582`의 기존 `useMemo`/`useReactTable` 항목, 이번 변경과 무관). 서빙 중인 프론트 번들 해시(`index-Dt0nTrEu.js`)가 로컬 빌드 산출물과 **일치** → 서빙 코드 = 현재 작업 트리(재빌드 불필요, 빌드 1회 상한 준수).

## 검증 시나리오

**환경**: 실행 중인 docker compose 스택(backend 8000 / frontend 3000 / db) 재사용. 번들 해시 대조로 현재 코드 서빙 확인.
**픽스처**: 레포 밖 스크래치패드에 `openpyxl`로 생성(`qa_fixture.xlsx`). 파서 요구(`_to_date`가 `datetime`만 수용)에 맞춰 `datetime(2019,3,10)` 사용. 시트 구성 — `가계부 내역`(수입 1·지출 1·자동 페어 이체 2쌍·단독 이체 1행), `뱅샐현황` 재무현황(부동산 QA아파트 + 대출 QA대출).

| # | 시나리오 | 결과 |
| --- | --- | --- |
| 1 | `npm run build` / `npm run lint` | 통과 / 0 errors, 2 pre-existing warnings |
| 2 | preview API 직접 호출 | `account_sources` 6건, row_count·importable_count·amount 예상치와 정확히 일치 → AC-1 |
| 3 | **H-1 회귀 재현 시도** — mappings 생략 + decisions=[] | `created_accounts=[QA통장A,QA제외카드,QA아파트,QA대출]`뿐, 검토 전용 소스(QA통장B·QA단독수단) **미생성** → **H-1 해소 확인** |
| 4 | **M-5 재현 시도** — QA제외카드 exclude + 생존 페어 다리(7행) 결정 **생략** | **HTTP 200**(2회차 422), 3·6·7행 모두 제외 사유·중복 없음 → **M-5 해소 확인** |
| 5 | AC-4 — QA통장A를 LOCA(id30)에 link | 수입 거래 `account_id=30`, created_accounts 빈 배열 |
| 6 | AC-6 — QA제외카드 exclude | 해당 계정 거래 0건, 3·6·7행 제외 사유 |
| 7 | AC-7 — QA아파트·QA대출 exclude | valuation_count 0, loan_count 0, 계정 미생성 |
| 8~11 | AC-8/AC-11 — 유형·소유자·존재·형식 제약 | liability→bank 422 / valuation→bank 422 / easy_pay 422 / 타 구성원 422 / 없는 계정 404 / member 404 / account_id 누락 422 / 빈 mappings 200 |
| 12 | AC-9 — QA네이버페이 create e_money | DB `type='e_money'` |
| 13 | AC-11 임포트 실패 원자성 — liability→bank 422 후 대상 월 건수 | 1 → 1 (선행 delete까지 롤백) |
| 14 | 브라우저 — 매핑 스텝 진입·기본값·안내 문구 | 제목 `자산 계정 매핑 (1/2)`, 기본값 링크/신규, AC-12 문구 노출 |
| 15 | **M-4 재현 시도** — QA제외카드 exclude 후 검토 스텝 표시 | 검토 카드에 rows 4·5(정상 페어)·8(단독)만, 제외 페어(6·7) **및 생존 다리 미표시**. 헤더 `수입/지출 1건 … 아래 이체 3건`이 실제와 일치, 빈 이름 `자동 페어 ↔ ()` 없음 → **M-4 해소 확인** |
| 16 | 브라우저 종단 커밋(exclude 혼합) | `등록 3건 (이체 1건)(전환 1건)(기존 1건 교체), 건너뜀 3건` — 표시 목록과 결과 일치, 422 없음 |
| 17 | L-6 확인 — 매핑 후보 라벨 | `QA통장A · 은행`처럼 `이름 · 유형` 노출(동명이형 구분) → **L-6 해소 확인** |
| 18 | 375px 매핑/검토 스텝 오버플로 실측 | 가로 스크롤·미클리핑 요소·다이얼로그 이탈 자식 전부 0 → AC-13 |

**브라우저 방법 메모**: 375px 실측은 `resize_window` 대신 iframe(레시피 A) 사용(`window.innerWidth===375` 확인). iframe 안 파일 입력은 base64로 인코딩한 픽스처를 `File`/`DataTransfer`로 재구성해 주입했고, MonthPicker는 연·월 네비게이션 버튼을 스크립트로 조작해 2019-03을 선택했다. 매핑/검토 스텝 모두 모든 요소 bounding box를 뷰포트·다이얼로그 경계와 대조하는 정량 측정으로 검사했다.

## 발견 이슈

High/Medium: **없음.** 2회차의 H-1(High)·M-4/M-5(Medium)는 모두 해소를 실측 확인했고 새로운 회귀는 발견되지 않았다.

### [Low] L-7 — 검토 스텝 상대 계정 드롭다운이 다른 구성원 계정까지 나열 (기존, 비회귀)
`frontend/src/pages/TransactionsPage.tsx:1912-1913` — 이체 상대 계정 Select가 zustand `accounts` 전체를 `is_active`로만 필터하고 업로드 구성원으로 스코프하지 않는다. 매핑 스텝 후보(`mappingCandidates`, `a.member_id===Number(importMemberId)`)와 대비된다. **이번 변경 이전부터의 동작이고 research.md 계약에 없다.** 후보 스코프를 좁히면 공동 사용 계좌를 상대로 지정하던 기존 흐름을 막을 수 있어 정책 결정이 필요 → 수정 보류.

### [Low] L-8 — 매핑 확정과 임포트에 "찾고 없으면 생성" 블록 중복 (기존, 비회귀)
`backend/app/routers/transactions.py` `resolve_import_accounts`의 create 분기(`:586-603`) ↔ `resolve_source`의 create 분기(`:754-772`). 유형 제약 검증 + `(name, member_id, type)` 조회 + `Account(...)` 생성 + `flush` + `created_accounts.append`가 약 18줄 반복된다. 두 경로의 세션/카운터 수명이 달라 헬퍼 시그니처 설계가 필요 → 리팩터링 범위. 동작 영향 없음.

### [Low] L-9 — 매핑/검토 스텝 Select 높이 30px (기존, 비회귀)
375px 실측에서 매핑·검토 스텝 Select 높이가 30px로, 터치 타깃 관점에서 다소 작다. 다만 **같은 다이얼로그의 기존 검토 스텝 Select와 동일한 값**이라 이번 변경이 만든 회귀가 아니다. AC-13은 가로 스크롤·겹침·잘림 없음으로 통과 채점하되 기록을 남긴다. 터치 타깃 정책을 다이얼로그 전반에 적용할지 결정 필요 → 보류.

## QA 중 적용한 수정 (Low 한정)

없음.

발견한 Low 3건(L-7~L-9)은 모두 **국소적·무동작 변경 범위를 벗어난다**:
- L-7은 상대 계정 후보 스코프를 바꾸는 **동작 변경**이며 계약에 없다.
- L-8은 헬퍼 추출 **리팩터링**으로 범위 초과.
- L-9는 터치 타깃 **정책 결정**이 필요하다.

Medium/High는 0건이므로 수정 대상이 없다.

## 수정 Action Items

없음 (PASS). L-7~L-9는 선택적 후속 개선 항목이며 이번 계약 충족과 무관하다.

## 다음 단계

`/git-commit` 진행 가능. (L-7~L-9는 별도 백로그로 다뤄도 무방)
