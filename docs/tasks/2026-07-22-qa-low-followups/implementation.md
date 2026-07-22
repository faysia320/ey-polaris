# Implementation: QA Low 4건 후속 처리

- 날짜: 2026-07-22
- 기반 명세: **경량 모드** — 명세 원본은 `docs/tasks/2026-07-22-asset-delete-and-stock-manual-total/qa-report.md`의 "발견 이슈" Low 4건 (2차 QA, 판정 PASS)
- 이력: 1차 구현 → `/qa` **CONDITIONAL PASS**(Medium 1건) → 2차 수정(본 문서 반영)

## 성공 기준 (경량 모드 — 착수 전 정의)

- AC-1: 자산 페이지 계정 카드 삭제 버튼의 터치 히트 영역이 44px 이상이며, 시각적 크기(28px)와 카드 레이아웃은 변하지 않는다 — 375px 실측은 /qa
- AC-2: 계정 삭제 API는 성공했으나 목록 재조회만 실패한 경우 "삭제 실패"로 표시하지 않는다 — 코드 경로로 확인
- AC-3: 평가액 삭제 확인 다이얼로그에서 선행 상태가 사라져도 삭제 버튼이 무피드백 no-op이 되지 않는다 — 코드 경로로 확인
- AC-4: `npm run build` / `npm run lint` 통과
- AC-5: 375px에서 레이아웃 회귀 없음 — /qa

## 변경 파일

- `frontend/src/pages/AssetsPage.tsx` — 계정 카드 삭제 버튼 히트 영역 확대(Low 1), 계정 삭제의 API 호출과 재조회 분리(Low 2), 평가액 삭제 대상에 계정 id 동봉(Low 3), 평가 이력 블록 가드에 `valuationTarget` 추가(타입 정합)

Low 4는 사용자 결정에 따라 코드 변경 없음 (아래 참조).

## 주요 결정

### Low 1 — 터치 타깃 (사용자 결정: 자산 페이지 삭제 버튼만)

시각 크기는 앱 전역 `icon-sm`(28px) 관례를 유지하고, 히트 영역만 `relative after:absolute after:-inset-2 after:content-['']`로 44px(28 + 8×2)까지 넓혔다 (`after:content-['']`이 없으면 의사요소가 생성되지 않아 히트 영역이 넓어지지 않는다). `button.tsx`의 `icon-sm`을 고치면 6개 페이지와 `month-picker`·`dialog`가 전부 영향권에 들어가 전면 회귀 검증이 필요하므로 배제했다.

**평가 이력의 삭제 버튼에는 같은 처리를 하지 않았다.** 이력 행 간격이 좁아 히트 영역을 8px 넓히면 이웃 행의 버튼과 겹쳐 **다른 날짜의 평가액을 잘못 삭제**할 수 있다. 터치 타깃을 넓히려다 오삭제를 만드는 건 순손해다.

의사요소가 왼쪽으로 8px 확장되면서 계정명 span의 오른쪽 끝과 맞닿고, 비활성 계정에서는 `비활성` Badge의 오른쪽 가장자리 약 4px(`gap-1` 4px + 버튼 반폭 14px = Badge 우측 끝이 중심 기준 -18px, 의사요소는 -22px까지)도 함께 덮인다. 둘 다 클릭 핸들러가 없고 오탭해도 취소 가능한 확인 다이얼로그가 뜰 뿐이라 수용 가능하다고 판단했다.

### Low 2 — 삭제 실패와 재조회 실패 구분

스토어의 `deleteAccount`는 `api.delete` 성공 후 `fetchAll()`을 이어서 호출하므로, 재조회만 실패해도 호출부 `catch`에 걸려 "삭제 실패"로 보인다(실제로는 삭제됨).

**스토어를 고치지 않고 `AssetsPage`에서 분리**했다. `deleteAccount`는 `SettingsPage:377`도 쓰고 있어, 스토어 시그니처나 에러 의미를 바꾸면 이번 요청과 무관한 페이지의 동작이 함께 변한다. `AssetsPage`는 `api.delete`를 직접 부르고 성공 후 `fetchAll()` + `fetchAssets()`를 별도로 돌린다:

- 삭제 자체 실패 → `accountDeleteError`, 다이얼로그 유지 (기존 409 처리 그대로)
- 삭제 성공 후 재조회 실패 → 다이얼로그를 닫고 `refreshNotice` 배너로 알림 (2차 수정, 아래 참조)

엔드포인트 경로가 스토어와 중복되지만, 공용 스토어의 의미를 바꾸는 것보다 국소 중복이 낫다고 봤다.

### [2차] Medium — 재조회 실패가 페이지를 통째로 날리던 회귀 수정

1차에서 재조회 실패를 기존 `error` 상태에 실었는데, `error`는 **자산 조회 자체가 실패한 치명적 상태**로 `:345`에서 페이지 전체를 한 줄 메시지로 대체한다. 삭제는 성공했고 화면의 자산 데이터도 (조금 낡았을 뿐) 유효한데 페이지가 사라졌다. 게다가 이 컴포넌트에는 `setError(null)`이 한 군데도 없어 구성원 필터를 바꿔도 복구되지 않았다. QA가 실행으로 잡아낸 회귀다.

두 상태의 성격이 다르다는 걸 코드로 분리했다:

- `error` — 조회 실패. 페이지 전면 대체. 이제 `fetchAssets` **성공 시 `setError(null)`로 해제**되어 일시적 장애에서 빠져나올 수 있다 (1차에 없던 복구 경로. 이 누락은 원래부터 있었으나 내 변경이 도달 가능하게 만들었으므로 함께 고쳤다)
- `refreshNotice` — 삭제는 됐지만 목록 갱신만 실패. 페이지는 그대로 두고 헤더 아래 배너로만 알리며, 다음 삭제가 성공하면 해제된다. 문구도 "계정은 삭제됐지만…"으로 실제 상태를 명시한다

`TransactionsPage:134,539`의 `pageNotice`와 같은 결의 비치명적 알림 패턴이다.

### Low 3 — 중첩 다이얼로그 no-op 제거

`confirmValuationDelete`가 `valuationTarget`(바깥 갱신 다이얼로그 상태)에 의존해, 바깥이 먼저 닫히면 `if (!valuationTarget || ...) return;`으로 조용히 아무 일도 하지 않았다.

에러 메시지를 붙이는 대신 **의존 자체를 없앴다.** 확인 다이얼로그를 열 때 `{ accountId, valuation }`을 함께 캡처하므로 바깥 상태와 무관하게 삭제가 성립한다. 남은 `if (!valuationToDelete) return;`은 다이얼로그가 열려 있는 한 도달할 수 없다(렌더 조건이 곧 non-null 보장).

부수적으로 평가 이력 블록의 가드를 `valuationTarget && valuationHistory.length > 0`으로 바꿨다 — 이력은 대상 계정에 종속되므로 의미상 맞고, `openValuationDelete(valuationTarget.id, v)`의 타입 좁히기에도 필요하다(이 가드 없이는 TS18047).

### Low 4 — 환경 간 재현성 (사용자 결정: 현재 유지)

코드 변경 없음. 개발 DB 단일 환경이고 이미 적용이 끝난 1회성 작업이며, SQL 원문과 적용 결과가 `2026-07-22-asset-delete-and-stock-manual-total/implementation.md`의 "통합 SQL 기록" 절에 남아 추적 가능하다. research.md도 자동 마이그레이션을 명시적으로 범위 밖에 뒀다.

## 자체 검증 결과

**2차 (QA Medium 수정 후)**

- `cd frontend && npm run build` → **통과** (`✓ built in 1.52s`, 오류 0, 번들 `index-CH2983Qf.js`)
- `cd frontend && npm run lint` → **통과** (0 errors, 2 warnings — 기존 항목 동일)
- `grep -n "setError\|setRefreshNotice\|if (error)"` → `setError`는 조회 경로(`:111` 해제 / `:112` 설정)에만 남고, 삭제 경로는 `setRefreshNotice`(`:249,251`)로 분리됨을 확인. 전면 조기 반환(`:345`)에 삭제 실패가 도달할 경로 없음
- `docker compose up -d --build frontend` → 서빙 번들 `index-CH2983Qf.js`로 빌드 산출물과 일치
- **브라우저 E2E는 /qa 위임** — 특히 재조회 실패 주입 시 페이지가 유지되는지, `error` 해제로 복구되는지는 QA가 1차와 같은 방식(인위적 장애 주입)으로 재확인 필요

**1차**

- `cd frontend && npm run build` → **1차 실패**: `AssetsPage.tsx(571,51): error TS18047: 'valuationTarget' is possibly 'null'`. 이력 블록 가드에 `valuationTarget`을 추가해 해결 후 **통과** (`✓ built in 1.49s`, 오류 0, 번들 `index-C2tYjerg.js`)
- `cd frontend && npm run lint` → **통과** (0 errors, 2 warnings). 경고 2건은 `TransactionsPage.tsx:329,332`의 `useReactTable` 관련으로 이번 diff가 건드리지 않은 라인이며, 직전 사이클에서 `git stash` 대조로 기존 항목임을 확인한 것과 동일
- `grep`으로 `deleteAccount` 잔존 참조 없음 확인 (주석 내 언급 1건만 남음)
- `docker compose up -d --build frontend` → 서빙 번들이 `index-C2tYjerg.js`로 빌드 산출물과 일치. QA가 최신 코드를 검증할 수 있는 상태
- **브라우저 E2E는 /qa 위임**

## 성공 기준 자가 체크

- [x] AC-1: `relative after:absolute after:-inset-2 after:content-['']`로 28px 버튼에 44px 히트 영역 부여. 의사요소는 레이아웃 흐름에 참여하지 않아 카드 폭·정렬 불변. 375px 실측은 /qa 위임
- [x] AC-2: `api.delete`를 독립 `try/catch`로 감싸고 실패 시 `return`. 재조회 실패는 `refreshNotice` 배너로만 가고 `accountDeleteError`·`error` 어느 쪽에도 닿지 않음. **2차에서 전면 에러 회귀를 제거**했으므로 재검증 대상
- [x] AC-2b (2차 추가): 재조회 실패 시 페이지가 언마운트되지 않고, `error` 상태에 해제 경로가 생겨 복구 가능 — 브라우저 확인은 /qa 위임
- [x] AC-3: 삭제 대상이 `{ accountId, valuation }`을 자체 보유해 `valuationTarget` 의존 제거. 남은 가드는 다이얼로그 렌더 조건상 도달 불가
- [x] AC-4: build·lint 통과 (경고 2건은 기존)
- [ ] AC-5: 375px 레이아웃 회귀 없음 — **/qa 검증 대기.** 의사요소 기반이라 레이아웃 영향이 없어야 하지만, 직전 사이클에서 그리드 트랙 관련 예측이 빗나간 전례가 있어 코드 근거만으로 충족을 주장하지 않는다

## 보류/미완 항목

- **평가 이력 삭제 버튼의 터치 타깃은 28px 유지** — 행 간격이 좁아 히트 영역 확대가 오삭제 위험을 만든다(위 Low 1 참조). 근본 해결은 이력 행 높이 자체를 키우는 디자인 변경이라 별도 작업
- **앱 전역 `icon-sm` 관례는 그대로** — 사용자 결정에 따라 자산 페이지 삭제 버튼만 처리했다. 전역 상향은 디자인 결정 + 전면 회귀 검증이 필요한 별도 작업
- **`SettingsPage`의 계정 삭제는 여전히 확인 절차 없음** — 직전 사이클에서 이미 범위 밖으로 기록한 항목이며 이번 Low 4건에 포함되지 않아 손대지 않았다
- **`masterData.deleteAccount` 자체는 미수정** — `SettingsPage`도 같은 문제를 갖지만, 공용 스토어 변경은 이번 요청 범위 밖이라 `AssetsPage`에서만 분리했다
