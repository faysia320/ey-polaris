# QA Report: 앱 전역 폰트를 SUIT로 교체 + OpenType 기능(tnum/ss17/ss18) 적용

- 날짜: 2026-07-31
- 작업 폴더: `docs/tasks/2026-07-31-suit-font-migration`
- 판정: **PASS** (AC 10/10 충족, High 0건, Medium 0건, Low 4건)

> 이 보고서는 **재QA(2회차)** 다. 1회차 QA는 AC-5 미충족으로 FAIL이었고, 이후 (a) 사용자 수용 결정에 따른 research.md AC-5 개정, (b) Low 3건 처리(EChart 캐시·preload 플러그인·락파일 정리)가 이루어졌다. 본 회차는 개정된 research.md를 계약으로 삼아 **모든 AC를 처음부터 다시 직접 실측**했다 (이전 회차 결과를 인용하지 않고 전부 재측정).

> 평가 범위: 이 작업의 변경 파일 5개(`frontend/package.json`, `frontend/package-lock.json`, `frontend/src/index.css`, `frontend/src/components/charts/EChart.tsx`, `frontend/vite.config.ts`)로 한정했다. 작업 트리에 함께 있는 backend 변경과 `frontend/src/pages/*.tsx`, `types.ts`, `masterData.ts`는 병행 작업(`docs/tasks/2026-07-31-easy-pay-per-transaction-link`)의 산출물이라 채점 대상이 아니다. 단 폰트는 전역 상속이므로 375px 레이아웃 검증에는 해당 페이지들도 포함해 실측했다.

## 데이터 영향

없음. 검증 중 생성·수정·삭제 API를 한 번도 호출하지 않았다(GET 조회와 브라우저 DOM 검사만). 엑셀 가져오기 등 파괴적 기능은 실행하지 않았다. QA 종료 후 `git status --porcelain`이 QA 시작 시점 스냅샷과 **완전히 동일**함을 확인했다(변경 15 + untracked 3, 동일).

## 계약 관련 유의사항 (판정의 전제)

- **AC-5는 1회차 FAIL 이후 사용자 수용 결정으로 완화된 계약이다** (research.md:55, 83). 제품에는 `tabular-nums` 21곳에서 자릿수 `1`이 포함된 금액의 정렬 오차(16px 기준 최대 2.56px)가 **그대로 남아 있다**. 본 회차는 개정된 AC를 기준으로 채점했고, 오차 자체는 실측해 아래에 수치로 기록했다. 원문 AC("전 자릿수 완전 균일")로는 여전히 미충족임을 명시한다.
- research.md에 모바일 AC(AC-9)가 포함되어 있어 계약 누락 이슈 없음.
- implementation.md가 브라우저 E2E를 `/qa`로 명시 위임했으므로 단계 역할 위반 없음.

## 성공 기준 채점

- ✅ **AC-1**: 앱의 모든 텍스트가 SUIT로 렌더된다
  - 실행 중 스택(`localhost:3000`)이 서빙하는 번들 해시(`index-D-S1z8vG.js`)가 현재 작업 트리 빌드 산출물(`index-D5oEdjv8.js`)과 **불일치** → 스택 재사용 불가로 판단하고, 현재 트리를 그대로 구동하는 dev 서버(`localhost:5199`)와 프로덕션 빌드 프리뷰(`localhost:5200`) 두 경로에서 각각 실측했다.
  - `getComputedStyle`: `html`/`body` 및 `h1`/`button`/`span`/`div`/`a` 표본 전부 `"SUIT Variable", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", system-ui, sans-serif`
  - 다이얼로그(`role="dialog"`, `font-heading` 경로)도 동일 — `font-heading` 유틸리티가 `--font-sans`를 승계함을 실측 확인
  - 가변 축 동작 확인: 동일 문자열의 폭이 weight 100/400/700/900에서 650.5/658.5/662.2/667.1px로 달라져 variable weight(100–900)가 실제로 적용됨 (폴백 Malgun Gothic 639.4px와 구분됨)
- ✅ **AC-2**: SUIT 폰트 파일이 동일 출처로 실제 로드된다
  - `document.fonts.check('16px "SUIT Variable"') === true`, `[...document.fonts]` = `{fam:"SUIT Variable", w:"100 900", status:"loaded", display:"swap"}` 1건
  - 프로덕션 프리뷰 네트워크 실측: 전체 9개 요청 전부 `localhost:5200` — `GET /static/SUIT-Variable-gqD86R3M.woff2 → 200`. **외부 도메인 폰트 요청 0건**
  - dev(5199)에서도 `GET /node_modules/@sun-typeface/suit/.../SUIT-Variable.woff2 → 200` **1건만** — preload href와 CSS `url()` 해석 결과가 일치해 중복 다운로드 없음
  - 구동 중 컨테이너(3000)에서도 `/static/SUIT-Variable-gqD86R3M.woff2 → 200`, `curl` 로 624,536바이트 확인
- ✅ **AC-3**: 전역 font-feature-settings에 3개 태그가 모두 실려 있다
  - `getComputedStyle(document.documentElement).fontFeatureSettings` = `"ss17", "ss18", "tnum"`. `body`·본문 표본·다이얼로그 헤딩 전부 동일
  - 이번 회차 빌드 CSS 직접 검사: `--default-font-feature-settings:"tnum", "ss17", "ss18"`, `html{font-feature-settings:"tnum", "ss17", "ss18";font-family:SUIT Variable,...}`, `.font-heading{font-family:var(--font-sans);font-feature-settings:"tnum", "ss17", "ss18"}`
- ✅ **AC-4**: 요청한 feature가 실제 글립 변화로 나타난다
  - 동일 문자열(`→ ← ↑ ↓ ↔ 0 1 l I`)을 A)`font-feature-settings:normal` B)앱 설정(`tnum,ss17,ss18`) C)`ss18`만 D)`ss17`만 4개 조건으로 56px 렌더 후 스크린샷 대조
  - **ss18**: A에서 샤프트 없는 갈매기형(`>`/`<`/`^`/`v`)이던 화살표가 B·C에서 샤프트 있는 정식 화살표(`→ ← ↑ ↓`)로 치환됨
  - **ss17**: D에서 `0`→슬래시 제로, `l`→꼬리형, `I`→세리프형으로 치환. 앱 조합(B)에서는 `l`/`I`만 유지되고 `0`은 tnum 글립이 우선(implementation.md 보류 항목과 일치)
  - 실제 화면 in-situ 확인: 375px 거래 목록의 `차액 [이체→수입: 미분류]` 표기를 확대 캡처해 화살표에 샤프트가 있음을 확인 (합성 텍스트가 아닌 앱 실제 렌더)
- ✅ **AC-5 (개정본)**: `tnum` 적용 시 `1`을 제외한 자릿수 폭이 균일하다
  - 100px 기준 자릿수별 advance 재실측(전역 `tnum,ss17,ss18`): `0,2,3,4,5,6,7,8,9` = **61.8px(0.618em) 전부 동일**, `1` = **65.4px(0.654em)**
  - tnum 미적용 시: 40.9~62.2px로 제각각 → tnum 유지가 유리하다는 개정 AC의 논거를 독립 재현
  - 잔존 오차 실측: `tabular-nums` 유틸리티 경로, 16px에서 `1,111,111`=80.52px vs `8,888,888`=77.96px → **2.56px 차이**. 개정 AC가 수용한 범위이며 제품에 남아 있는 제약임을 위 "계약 관련 유의사항"에 명시
- ✅ **AC-6**: 차트 텍스트도 SUIT로 렌더된다
  - `CanvasRenderingContext2D.prototype.font` 세터를 후킹한 뒤 SPA 라우팅으로 `/assets` 차트를 렌더 → echarts가 실제로 설정한 값 캡처: `normal normal 12px 'SUIT Variable', -apple-system, ... sans-serif` (설정 문자열 1종만 관측)
  - 문자열 유효성 교차 확인: 해당 값을 새 canvas에 대입 후 `ctx.font` 게터가 정상 파싱값을 반환(줄바꿈 포함 CSS 변수값이 깨지지 않음), `measureText('1111111111')` = 49.08px로 `12px 'SUIT Variable'`(49.08px)과 일치하고 폴백 Malgun Gothic(52.62px)과는 불일치 → 폴백이 아니라 SUIT가 실제 적용됨
  - 코드 확인: `EChart.tsx:69` 병합 객체에 `textStyle`, 스프레드 순서상 호출 측 우선. `frontend/src` 내 `textStyle` 지정은 EChart 1곳뿐
- ✅ **AC-7**: 코드 블록은 monospace를 유지한다
  - `MarkdownView`의 `pre`/`code` 렌더러와 동일한 구조를 앱 본문 컨텍스트에 삽입해 실측 → `fontFamily: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, ...`, `fontFeatureSettings: normal` (SUIT feature 미침투). `MarkdownView.tsx:27-35`에 font-family 지정이 없음을 코드로 확인
- ✅ **AC-8**: Geist 잔재가 전혀 남지 않는다
  - `git grep -i -e geist -e fontsource -- . ':!frontend/package-lock.json' ':!docs'` → **0건**
  - 파일시스템 grep(node_modules 제외, untracked 포함) → docs 산출물 3건(과거 상태 서술)뿐, 코드·설정 0건
  - `frontend/package.json`에 `@sun-typeface/suit@^2.0.5`만 존재, `package-lock.json`에서 geist 항목 제거·suit 항목 추가 확인
  - 빌드 CSS(`dist/static/index-8DLDSXgx.css`)에 `geist` 문자열 **0건**
  - 참고: `frontend/node_modules/@fontsource-variable/`가 **빈 디렉터리로 잔존**하나 내용물이 없고 빌드 산출물에 영향 없음(로컬 npm 제거 흔적). 이슈 아님
- ✅ **AC-9**: 모바일(375px)에서 레이아웃이 깨지지 않는다
  - 레시피 A(iframe 375px) 실측 — `/`, `/transactions`, `/budgets`, `/assets`, `/settings` 전부 `docScrollWidth: 360`, `pageHasHorizontalScroll: false`, `unclippedOffenders: []`
  - Transactions **캘린더 뷰** 전환 후에도 `pageHasHorizontalScroll:false`, `unclippedOffenders:[]`
  - **거래 추가 다이얼로그**(추가 엣지 케이스) 375px에서 폭 326px/right 351px로 뷰포트 내부, 오버플로 0, 잘린 텍스트는 sr-only "Close"뿐
  - `w-24`(96px) 월 표시: 실제 셀 96px, 최악 케이스 텍스트 폭 `2026-11`=69.0px, `1111-11`=70.9px → 여유 25px 이상
  - 차트 `grid.left:80` 대비 y축 라벨 최악 폭: `111,111만`@12px=60.2px, `888,888만`@12px=58.3px → 여유 충분. Assets 차트 축 라벨 잘림 없음
  - 잘림 A/B 검증: 캘린더 셀 금액의 ellipsis 39건, `/transactions` 목록 3건, `/assets` 1건은 모두 명시적 `truncate` 클래스가 걸린 요소이며 **SUIT / Segoe UI / Arial 세 폰트에서 건수가 39/39/39로 동일** → 폰트 무관한 기존 설계이고 이번 변경의 회귀가 아님
  - 375px 스크린샷 육안 확인: 겹침 없음, 금액·시각 표기 정상 판독
- ✅ **AC-10**: 빌드와 린트가 통과한다
  - `cd frontend && npm run build` → **EXIT=0** (`dist/static/SUIT-Variable-gqD86R3M.woff2` 624.53 kB, `index-8DLDSXgx.css` 65.75 kB, `index-D5oEdjv8.js` 1,891.54 kB). 빌드는 1회만 수행
  - `cd frontend && npm run lint` → **EXIT=0** (0 errors, 2 warnings). 경고 2건은 `TransactionsPage.tsx:611,614`의 `useReactTable`/`useMemo` 항목으로 이번 작업이 건드리지 않은 파일(병행 작업 소관)

## 검증 시나리오

1. `git status --porcelain` / `git diff` 로 이번 작업의 실제 변경 5개 파일 확정 (untracked 산출물 포함 직접 확인)
2. `npm run build` (EXIT=0) → 산출 해시가 구동 중 컨테이너(3000)가 서빙하는 해시와 **불일치**함을 확인 → 스택 재사용 대신 dev/preview 서버로 검증 경로 전환
3. `npm run lint` (EXIT=0, 0 errors)
4. `dist/static/index-8DLDSXgx.css`에서 `@font-face`·`html` 규칙·`.font-heading`·`--default-font-feature-settings` 직접 추출해 확인
5. `npx vite --port 5199` (dev) 기동 → `curl`로 주입된 preload href 확인 → 브라우저에서 `getComputedStyle`/`document.fonts`/네트워크 실측 (AC-1·2·3)
6. 4조건 대조 렌더 + 스크린샷으로 ss17/ss18 글립 치환 검증, 실제 화면 화살표 확대 캡처 (AC-4)
7. 100px 자릿수별 advance 재측정, tnum on/off 비교, 16px 금액 비교 (AC-5)
8. `CanvasRenderingContext2D.prototype.font` 후킹 + `measureText` 대조로 차트 폰트 검증 (AC-6)
9. `pre`/`code` 삽입 실측 (AC-7)
10. `npx vite preview --port 5200` (프로덕션 빌드) 기동 → 네트워크 9건 전수 확인: SUIT woff2 **1회만** 요청, 외부 도메인 0건, preload `as=font crossorigin=anonymous` 태그 존재 (AC-2 + preload 재작업분 검증)
11. 레시피 A로 5개 페이지 + 캘린더 뷰 + 다이얼로그 375px 오버플로 실측, 폰트 A/B(SUIT/Segoe UI/Arial)로 잘림의 폰트 의존성 판별 (AC-9)
12. **엣지 케이스**: dev 모드에서 `@font-face`의 bare 패키지 지정자(`url('@sun-typeface/suit/...')`)가 해석되는지, 그리고 preload href와 CSS가 **서로 다른 URL을 가리켜 624KB를 두 번 받지 않는지** 네트워크로 확인 → 단일 요청
13. 정리: iframe/주입 DOM 제거 확인, dev(5199)·preview(5200) 서버 종료 확인(연결 거부), `git status --porcelain` 시작 시점과 동일

검증 데이터 생성 없음 → 정리 대상 없음 (앱 레코드 0건 생성, 0건 삭제).

## 발견 이슈

### [Low] `frontend/package-lock.json` — 무관한 transitive 갱신이 **여전히 남아 있고**, implementation.md는 되돌렸다고 기록

- 현재 작업 트리 `git diff -- frontend/package-lock.json`에 `@emnapi/wasi-threads` **1.2.2 → 1.2.3**(dev/optional transitive) 변경이 그대로 있다. 폰트 의존성 교체와 무관한 커밋 노이즈다.
- implementation.md는 이를 처리 완료로 보고한다 — `implementation.md:9`("폰트와 무관한 transitive 갱신은 되돌림"), `:33`("`1.2.3 → 1.2.2` 되돌림 ... 재변경하지 않음을 확인"), `:41`("`git diff -- package-lock.json`: 폰트 의존성 교체 외 변경 0건"). **실제와 반대**다.
- 기능 영향 없음. 락파일 자체는 의존성 해석에 관여하므로 QA가 손대지 않고, 문서 사실 오류만 정정한다(아래 "QA 중 적용한 수정").

### [Low] `frontend/vite.config.ts:24` — preload href가 Vite `base`를 무시하고 `/`를 하드코딩

- `const href = emitted ? \`/${emitted}\` : SUIT_DEV_URL` 로 항상 루트 절대경로를 만든다. 현재 `base`가 기본값 `'/'`이라 정상 동작하지만, 서브패스 배포(`base: '/app/'`)로 바뀌면 preload만 404를 받고 조용히 무효화된다(폰트 자체는 CSS 경로로 로드되어 증상이 드러나지 않음). `ctx.path`/`base`를 반영하면 견고해진다.

### [Low] `frontend/vite.config.ts:7` — dev preload 경로가 하드코딩이라 CSS 해석 결과와 어긋나도 감지되지 않는다

- `SUIT_DEV_URL`은 npm 평면 설치 레이아웃을 전제한 문자열이다. 이번 실측에서는 CSS `url()` 재작성 결과와 정확히 일치함을 확인했으나(요청 1건), Vite 버전 변경이나 pnpm/yarn PnP 레이아웃에서 어긋나면 **624KB를 두 번 받는다**(preload 1회 + 실제 1회). 어긋남을 알리는 장치가 없다.

### [Low] `frontend/src/index.css:15` — `format('woff2-variations')`는 비표준·구문법

- 표준 대체 표기는 `format('woff2') tech('variations')`(또는 단순 `format('woff2')`)다. 패키지 동봉 CSS(`node_modules/@sun-typeface/suit/.../SUIT-Variable.css`)가 동일 표기를 쓰므로 업스트림과 일치한다는 점, Chromium 계열에서 정상 로드됨을 실측한 점에서 현재 영향은 없다. 다만 이 문자열을 인식하지 못하는 엔진이 있으면 `src` 전체가 무시되어 폴백 폰트로 렌더된다. **이 환경에서는 Chromium만 검증 가능해 타 엔진은 미검증**이다. `format('woff2')` 선언을 한 줄 덧붙이면 리스크가 사라진다.

### 참고 (이슈 아님)

- 구동 중인 docker 프론트엔드 컨테이너(`localhost:3000`)는 **재작업 이전 번들**(`index-D-S1z8vG.js`, preload 없음)을 서빙 중이다. 코드 결함이 아니라 배포 미갱신 상태이며, 커밋·배포 시 `docker compose up --build`로 반영된다. 폰트 CSS 해시(`index-8DLDSXgx.css`)는 동일해 폰트 적용 자체는 컨테이너에서도 이미 유효하다.
- `frontend/node_modules/@fontsource-variable/`가 **빈 디렉터리**로 남아 있다(내용 0). 빌드·grep 결과 모두 영향 없음.
- `↔`(U+2194)에는 ss18 대체 글립이 없으나 미적용 상태에서도 샤프트형이라 `→`와 시각적으로 일관된다(4조건 대조 렌더로 확인).
- `tabular-nums` 21곳의 `1` 정렬 오차(16px 기준 2.56px)는 **사용자가 수용한 계약상 제약**이라 이슈로 계상하지 않았다. 다만 제품에 남아 있는 사실은 위 "계약 관련 유의사항"에 기록했다.

## QA 중 적용한 수정 (Low 한정)

- `docs/tasks/2026-07-31-suit-font-migration/implementation.md:9` — "폰트와 무관한 transitive 갱신은 되돌림"을 실제 작업 트리 상태(되돌려지지 않고 `@emnapi/wasi-threads` 1.2.2→1.2.3가 남아 있음)로 정정. (Low-1 대응)
- `docs/tasks/2026-07-31-suit-font-migration/implementation.md:33` — "되돌림 ... 재변경하지 않음을 확인" 서술을 QA 재확인 사실로 정정. (Low-1 대응)
- `docs/tasks/2026-07-31-suit-font-migration/implementation.md:41` — "`git diff -- package-lock.json`: 폰트 의존성 교체 외 변경 0건" 을 실측 결과(무관 transitive 1건 잔존)로 정정. (Low-1 대응)
- 코드는 수정하지 않았다(나머지 Low 3건은 동작을 바꾸는 변경이라 QA 범위 밖 — 아래 참고 항목 참조).
- 수정 후 재검증: `cd frontend && npm run lint` → **EXIT=0** (0 errors, 2 pre-existing warnings). 문서만 변경했으므로 빌드 산출물 영향 없음. `git status --porcelain` QA 시작 시점과 동일.

## 수정 Action Items (FAIL/CONDITIONAL 시)

없음 (판정 PASS — Medium/High 이슈 0건).

QA가 고치지 않은 Low 3건은 차기 작업에서 선택적으로 처리할 후보다 (판정에는 영향 없음):
- `frontend/package-lock.json`의 `@emnapi/wasi-threads` transitive 변경 되돌리기 (락파일 조작이라 QA 범위 밖)
- `frontend/vite.config.ts`의 preload href에 Vite `base` 반영 / dev 경로 불일치 감지
- `frontend/src/index.css`의 `@font-face`에 `format('woff2')` 선언 추가(비Chromium 엔진 대비)

## 다음 단계

`/git-commit` 진행 가능.

커밋 시 참고: 작업 트리에 병행 작업(`docs/tasks/2026-07-31-easy-pay-per-transaction-link`)의 변경이 섞여 있으므로, 이번 폰트 작업은 `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/index.css`, `frontend/src/components/charts/EChart.tsx`, `frontend/vite.config.ts`, `docs/tasks/2026-07-31-suit-font-migration/` 로 한정해 스테이징해야 한다. 배포 반영에는 프론트엔드 컨테이너 재빌드가 필요하다.
