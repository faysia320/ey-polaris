# QA Report: QA Low 4건 후속 처리 (2차 QA — Medium 수정 재검증)

- 날짜: 2026-07-22
- 작업 폴더: `docs/tasks/2026-07-22-qa-low-followups`
- 판정: **PASS**

## 채점 기준 출처

`research.md`가 없는 **경량 모드** 작업입니다. `implementation.md`가 착수 전에 정의한 AC-1~AC-5(+2차에서 추가된 AC-2b)를 채점 기준으로 사용했습니다. 모바일 AC(AC-5)가 계약에 포함되어 있어 CLAUDE.md 모바일 제약 관련 계약 누락 이슈는 없습니다.

이번 사이클은 **1차 QA가 CONDITIONAL PASS로 남긴 Medium 1건(재조회 실패가 페이지를 통째로 대체하던 회귀)의 수정을 재검증**하는 것이 핵심입니다. 이전 보고서 본문은 이 파일에 덮어썼고, 이전 Low 2건은 아래에서 재측정해 갱신했습니다.

## 성공 기준 채점

- ✅ **AC-1: 삭제 버튼 히트 영역 44px 이상, 시각 크기 28px·레이아웃 불변**
  375px iframe에서 `elementFromPoint` 8방향 프로빙(계정 카드 삭제 버튼 25개 중 3개 샘플). 중심 기준 **±21px 8방향 전부 버튼에 히트**, `±25px`는 버튼 밖(카드 타이틀 div)으로 정확히 이탈 → 실효 히트 영역 44×44. `getBoundingClientRect`는 **28×28 유지**. `::after`의 computed 값은 `content: ""`, inset 사방 `-8px`. 의사요소가 `position:absolute`라 흐름에 불참하고 375px 오버플로 0건이므로 레이아웃 불변.

- ✅ **AC-2: 삭제 성공 + 재조회 실패를 "삭제 실패"로 표시하지 않음**
  코드 경로가 아니라 **직접 실행으로 확인**. 일회용 계정 `QA-TEST-REFRESH-FAIL`(id 138)을 만들고, 375px iframe의 `window.fetch`를 패치해 **GET만 실패**시킨 뒤 UI에서 삭제 실행. 결과: `accountDeleteError`("삭제 실패") **미표시**, 확인 다이얼로그 정상 종료, 계정은 실제로 삭제됨(이후 API 재조회에서 소멸 확인).

- ✅ **AC-2b: 재조회 실패 시 페이지가 언마운트되지 않고 `error` 해제 경로가 존재** — **1차 Medium 회귀 해소 확인**
  위와 동일 시나리오에서 측정: `pageStillRendered true`, **`cardCount 35`(삭제 전과 동일)**, `fullErrorScreen false`, `dialogStillOpen false`, 배너 문구 정확히 `계정은 삭제됐지만 목록을 새로고침하지 못했습니다: QA injected network failure`. 1차에서 관측된 "페이지 전체가 한 줄 에러로 대체" 현상은 **재현되지 않습니다.**
  `error` 해제 경로(`:110-112` `fetchAssets().then(() => setError(null))`)도 코드상 존재합니다. 다만 이 경로를 **UI로 실행시키지는 못했습니다** — 전면 에러 화면에서는 `MemberFilterSelect`가 함께 언마운트되어 구성원 필터 컨트롤이 화면에 없기 때문입니다(`triggerPresentOnErrorScreen: false`로 실측). 별도로 전면 에러 상태를 만든 뒤 **다른 탭으로 이동했다 복귀하면 정상 복구**됨을 확인했습니다(리마운트, `cardCount 28`). 관련 주석 정확성은 Low-3 참조.

- ✅ **AC-3: 선행 상태가 사라져도 평가액 삭제가 no-op이 되지 않음**
  직접 실행으로 확인. 테스트 계정 `QA-TEST-VAL2`(id 142, `real_estate`)에 평가액 2건(2019-03-01 id 47 / 2019-04-01 id 48) 생성 → 평가액 갱신 다이얼로그 열기 → 2019-03-01 삭제 확인창 열기 → **바깥 갱신 다이얼로그를 "취소"로 먼저 닫음**(확인창은 캡처한 값으로 `2019-03-01 기준 500,000원`을 정상 표시한 채 유지) → 삭제 클릭. API 재조회 결과 **id 47이 실제로 삭제**되고 48만 잔존. 변경 전 코드였다면 `if (!valuationTarget || ...) return;`으로 무피드백 no-op이 될 경로입니다.

- ✅ **AC-4: build / lint 통과**
  직접 실행(빌드 1회). `npm run build` → `✓ built in 1.35s`, 오류 0, 번들 **`index-CH2983Qf.js`**. `npm run lint` → `✖ 2 problems (0 errors, 2 warnings)`, 경고 2건은 이번 diff가 건드리지 않은 `TransactionsPage.tsx:329,332`의 `useReactTable` 관련. implementation.md의 자가 보고 수치·번들 해시와 일치(**교차 확인으로 채택**).

- ✅ **AC-5: 375px 레이아웃 회귀 없음**
  레시피 A로 실측. `/assets` `docScrollWidth 360 / viewport 375`, `pageHasHorizontalScroll false`, `unclippedOffenders []`. 회귀 확인용 `/`(360/375, 0건), `/transactions`(375/375, 0건)도 통과. **신규 UI 요소인 `refreshNotice` 배너를 실제로 띄운 상태에서도 재측정** → `375/375`, 오버플로 0건, 배너는 `left 16 / right 344 / height 60`으로 2줄 정상 折り返し.

## 검증 시나리오

실행 환경: 기동 중인 docker 스택 재사용. **서빙 번들 해시(`index-CH2983Qf.js`)가 내가 직접 돌린 빌드 산출물과 일치**함을 `curl http://localhost:3000/`으로 확인해 현재 작업 트리 코드를 검증했음을 보증했습니다.

1. `npm run build`(1회) / `npm run lint` — AC-4.
2. 375px 오버플로 실측 — `/assets`, `/transactions`, `/` (레시피 A iframe).
3. 히트 영역 실측 — 삭제 버튼 3개 샘플, 8방향 + 경계 밖(±25px) `elementFromPoint` 프로빙.
4. **AC-2/2b 엣지 케이스** — `fetch` 패치로 GET만 실패시키는 인위적 장애 주입 후 UI 삭제 실행.
5. **전면 에러 상태 복구 경로** — 의도적으로 `fetch` 자체를 제거해 `error` 화면을 만든 뒤, 화면에 필터 컨트롤이 없음을 확인하고 라우팅 이동/복귀로 복구됨을 확인.
6. **AC-3 엣지 케이스** — 중첩 다이얼로그에서 바깥을 먼저 닫고 삭제 실행, API로 실제 삭제 검산.
7. **비활성 Badge 겹침 실측** — 1차 QA가 "비활성 계정 0건이라 실측 불가"로 남긴 항목을, 일회용 비활성 계정(id 141)을 만들어 **처음으로 실측**(Low-2).
8. **1-hop 부작용 점검** — `deleteAccount`/`fetchAll` 전 참조를 grep. 스토어 `masterData.deleteAccount`는 **미변경**이고 `SettingsPage:377`이 그대로 사용 → 공용 스토어 시그니처 변경 없음, 타 페이지 영향 없음 확인.

**검증 방법론 주의(자기 교정 기록)**: 중간에 `delete window.fetch`로 네트워크를 복구하려다 `fetch`를 아예 제거해 잘못된 관측을 얻었습니다(그 결과 배너가 사라진 것처럼 보였으나 실제로는 전면 에러 화면으로 전환된 것). 네이티브 `fetch`를 별도 iframe에서 가져와 제대로 복원한 뒤 **재측정**했고, 아래 Low-1은 그 재측정 결과입니다. 또 뷰포트 밖 좌표에서 `elementFromPoint`가 `null`을 반환해 Badge 겹침이 "없음"으로 보인 오측이 있었고, `scrollIntoView` 후 재측정했습니다.

### 데이터 영향 및 정리 결과

실데이터는 **일절 건드리지 않았습니다.** 삭제 API는 내가 만든 일회용 레코드에만 호출했고, 파괴적 기능 실행 전 baseline을 먼저 조회했습니다.

- 사전 baseline: 계정 **28건**, `QA-TEST` 문자열 0건, 비활성 계정 0건.
- 생성: 계정 id **138**(REFRESH-FAIL), **139**(NOTICE-CLEAR), **140**(VAL, `investment`), **141**(INACTIVE), **142**(VAL2, `real_estate`), **143**(BANNER) / 평가액 id **45·46**(140), **47·48**(142) — 모두 실데이터가 없는 **2019년** 날짜.
- 정리: 138·139·143은 검증 시나리오상 UI 삭제로 소멸, 140·141·142는 API `DELETE`로 명시 삭제(모두 `204`). 평가액은 계정 삭제에 연쇄 제거.
- **정리 확인(수치)**: 계정 총 **28건**(baseline과 동일), `QA-TEST` 잔여 **0건**, 비활성 계정 **0건**(baseline 복귀), id 138~143 전부 `GET .../valuations` → `자산 계정을(를) 찾을 수 없습니다`. 기존 계정·평가액·거래에 대한 `DELETE`는 **한 번도 호출하지 않았습니다.**
- 브라우저 측 검증 잔여물(iframe) 제거 확인: `0 iframes remain`.

## 발견 이슈

**High: 0건 / Medium: 0건 / Low: 3건**

- **[Low-1] `frontend/src/pages/AssetsPage.tsx:249-253, 364-366`** — `refreshNotice`가 **재조회 성공으로는 해제되지 않아, 이미 최신화된 화면에 잘못된 빨간 경고가 계속 남습니다.**
  - 재현(실측): 시나리오 4로 배너를 띄운 뒤 `fetch`를 정상 복원 → 구성원 필터를 "으니"로 변경 → `fetchAssets` 성공(`cardCount 28`, 삭제된 계정 사라짐, `fullErrorScreen false`)했는데도 `계정은 삭제됐지만 목록을 새로고침하지 못했습니다: ...` 배너가 **그대로 표시됨**(`noticeStillShownAfterSuccessfulRefetch: true`).
  - 원인: `setRefreshNotice(null)`이 `confirmAccountDelete`의 **재조회 성공 분기(:250)에만** 존재합니다. 조회 성공 경로(`:110-112` useEffect)에는 해제가 없어, 다음 계정 삭제가 성공하거나 페이지를 리로드할 때까지 남습니다. `error`에는 이번에 해제 경로를 넣었지만 `refreshNotice`에는 같은 처리를 하지 않은 비대칭입니다.
  - 등급 근거: 페이지는 완전히 동작하고 데이터도 정확하며 문구가 "삭제는 됐다"는 사실은 올바르게 전달하므로 기능 저해·데이터 위험이 없습니다. 사용자에게 남는 것은 **철 지난 오정보 한 줄**이라 Low로 판단했습니다(경계선 사례임을 명시합니다). QA 범위(동작 불변)를 벗어나므로 고치지 않았습니다.

- **[Low-2] `frontend/src/pages/AssetsPage.tsx:190`** — `after:-inset-2`가 왼쪽으로 8px 확장되어 **`비활성` Badge의 오른쪽 약 3px가 삭제 버튼의 히트 영역에 덮입니다.**
  - 1차 QA가 비활성 계정 0건으로 실측하지 못하고 기하 계산으로만 추정했던 항목을, 이번에 일회용 비활성 계정(id 141)을 만들어 **375px에서 실측**했습니다: Badge `left 232 / right 280`, 버튼 `left 284`(gap 4px), `::after` 좌측 경계 `276`. `elementFromPoint` 프로빙 결과 Badge 우측 끝에서 **1~3px 안쪽까지는 버튼에 히트**, 4px부터 Badge에 히트 → **겹침 폭 실측 약 3px**(1차 QA의 "약 4px" 추정과 정합).
  - 영향: 그 지점을 탭하면 삭제 확인 다이얼로그가 열립니다. Badge·계정명 모두 비인터랙티브고 확인 다이얼로그로 취소 가능하므로 영향은 낮습니다. 동작을 바꾸는 수정이라 QA 범위 밖입니다.

- **[Low-3] `frontend/src/pages/AssetsPage.tsx:108-109` (및 `implementation.md:48`)** — `setError(null)` 추가를 정당화하는 주석의 시나리오가 **실제로는 도달 불가능**합니다.
  - 주석은 "해제 경로가 없으면 일시적 장애 후 **구성원 필터를 바꿔** 다시 불러와도 전면 에러 화면에서 빠져나오지 못한다"고 서술하지만, `error`가 설정되면 `:345`의 조기 반환이 `MemberFilterSelect`까지 통째로 대체하므로 **에러 화면에는 구성원 필터가 존재하지 않습니다**(실측: `triggerPresentOnErrorScreen: false`). 즉 이 경로로는 `memberId`를 바꿀 수 없습니다.
  - 실측상 전면 에러에서의 복구는 **라우팅 이동 후 복귀(컴포넌트 리마운트)**로 이루어지며, 이는 `setError(null)` 없이도 성립합니다. 따라서 이 변경은 방어적으로는 타당하나 주석·`implementation.md`가 주장하는 사용자 시나리오는 부정확합니다.
  - 코드 주석의 기술적 주장을 다시 쓰는 일은 뉘앙스 판단이 필요해(방어적 코드로 남길지 여부 포함) QA에서 손대지 않고 Action Item으로 남깁니다.

## QA 중 적용한 수정 (Low 한정)

**없음.**

Low 3건 모두 "국소적이고 동작을 바꾸지 않는 수정"의 범위를 벗어나 의도적으로 손대지 않았습니다.

- Low-1: 해제 로직 추가는 **동작 변경**이라 QA 범위 밖.
- Low-2: 히트 영역 조정은 **동작 변경**이라 QA 범위 밖.
- Low-3: 주석/문서 수정 자체는 허용 범위지만, 해당 코드를 방어적으로 유지할지 제거할지에 대한 판단이 선행되어야 문구가 확정됩니다. `/qa` 규칙의 "판단이 애매하면 수정하지 말고 Action Item으로 남긴다"에 따라 미수정.

## 수정 Action Items (PASS — 모두 선택 사항)

판정이 PASS이므로 아래는 **차단 항목이 아닙니다.** 다음 사이클에 함께 처리하면 좋은 항목입니다.

- [ ] `AssetsPage.tsx:110-112` — `fetchAssets` 성공 시 `setRefreshNotice(null)`도 함께 호출해 배너가 최신화 후 자동 해제되게 할 것 (Low-1). `error`와의 처리 비대칭 해소.
- [ ] `AssetsPage.tsx:190` — `비활성` Badge와의 3px 겹침 해소(예: 버튼 좌측 inset만 축소하거나 Badge와의 `gap` 확대) (Low-2).
- [ ] `AssetsPage.tsx:108-109` 및 `implementation.md:48` — `setError(null)`의 근거 서술을 실제 도달 가능한 시나리오로 정정하거나, 방어적 코드임을 명시할 것 (Low-3).

## 다음 단계

`/git-commit` 진행 가능. (Low 3건은 차단 요소가 아니며, 위 Action Item으로 다음 사이클에 처리 권장)
