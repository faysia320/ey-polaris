# Implementation: 앱 전역 폰트를 SUIT로 교체 + OpenType 기능(tnum/ss17/ss18) 적용

- 날짜: 2026-07-31
- 기반 명세: `docs/tasks/2026-07-31-suit-font-migration/research.md` (2026-07-31 AC-5 개정본)

## 변경 파일

- `frontend/package.json` — `@fontsource-variable/geist` 제거, `@sun-typeface/suit@^2.0.5` 추가
- `frontend/package-lock.json` — 위 의존성 교체만 반영. 폰트와 무관한 transitive 갱신(`@emnapi/wasi-threads`)은 되돌렸다 (재QA 후 재적용 — 아래 "재작업 2회차" 참조)
- `frontend/src/index.css` — Geist import 제거, SUIT variable `@font-face` 직접 선언(`font-display: swap`), `--font-sans`를 SUIT + 한글 시스템 폰트 폴백 체인으로 교체, `--font-sans--font-feature-settings`/`--font-heading--font-feature-settings`에 `'tnum','ss17','ss18'` 선언
- `frontend/src/components/charts/EChart.tsx` — canvas 텍스트용 `textStyle.fontFamily` 기본값 추가(`--font-sans`를 모듈 스코프에 1회 캐시), 웹폰트 로드 완료 후 1회 `resize()`로 텍스트 재측정
- `frontend/vite.config.ts` — **(재작업)** SUIT woff2 preload를 주입하는 `preloadSuitFont()` 플러그인 추가

## 주요 결정

- **패키지 동봉 CSS를 import하지 않고 `@font-face`를 직접 선언**했다. research.md의 Action Item은 동봉 CSS import를 1순위로 제시했으나, 동봉본(`node_modules/@sun-typeface/suit/fonts/variable/woff2/SUIT-Variable.css`)에 `font-display`가 없어 624KB 폰트를 받는 동안 텍스트가 통째로 사라지는 FOIT가 발생한다. `font-display: swap`을 보장하려면 자체 선언이 유일한 방법이라 이 경로를 택했다. `url()`에 bare 패키지 지정자를 썼고, 빌드에서 `dist/static/SUIT-Variable-gqD86R3M.woff2` 방출 + `url(/static/...)` 재작성, dev에서 `/node_modules/...` 재작성 후 200 응답을 모두 확인했다.
- **variable 포맷 유지.** research.md 미해결 질문이던 "variable 빌드에 ss17/ss18 GSUB가 있는가"를 폰트 바이너리 GSUB FeatureList 파싱으로 확인했다 — `aalt, fwid, pnum, sinf, ss01, ss17, ss18, subs, sups, tnum` + `fvar wght:100-900`. static 전환 불필요.
- **폴백 체인에 한글 시스템 폰트를 넣었다.** SUIT는 한글 완성형 11,172자를 100% 담지만 en dash(U+2013)·em dash(U+2014)가 없다. 앱은 `—`를 빈 값 자리표시자로 여러 곳(`frontend/src/pages/BudgetsPage.tsx:178,182`, `frontend/src/pages/SettingsPage.tsx:371,376`, `frontend/src/pages/DashboardPage.tsx:247` 등)에서 쓰므로 `-apple-system`/`Apple SD Gothic Neo`/`Malgun Gothic`/`Segoe UI`/`system-ui`를 이어 붙였다.
- **`--font-heading--font-feature-settings`를 별도 선언.** `font-heading`은 `--font-sans`와 다른 테마 키라 sans의 수정자를 물려받지 않는다. 빌드 산출물에서 `.font-heading{font-family:var(--font-sans);font-feature-settings:"tnum", "ss17", "ss18"}` 확인.
- **차트 폰트는 `--font-sans`를 런타임에 읽되 1회만 읽는다.** 폴백 체인을 TS/CSS 두 곳에 중복 정의하면 어긋나므로 CSS를 단일 출처로 두고, `--font-sans`는 런타임에 바뀌지 않으므로 모듈 스코프 lazy 캐시로 강제 스타일 재계산 반복을 없앴다. canvas는 OpenType feature를 적용할 수 없어 차트 텍스트에는 패밀리만 통일되고 tnum/ss17/ss18은 반영되지 않는다(수용된 제약).
- **preload href를 `index.html`에 하드코딩하지 않았다.** 빌드 산출물 파일명에 콘텐츠 해시가 붙어(`SUIT-Variable-<hash>.woff2`) 폰트를 갱신하면 하드코딩 경로가 조용히 깨진다. `transformIndexHtml`에서 번들의 실제 파일명을 찾아 주입하고, 번들이 없는 dev에서는 Vite가 CSS `url()`을 재작성하는 것과 **동일한** `/node_modules/...` 경로를 쓴다(불일치 시 폰트를 두 번 받게 되므로 dev 실측으로 일치를 확인했다). `frontend/index.html`은 무변경.
- **고정 폭 요소는 보정하지 않았다.** /qa 브라우저 실측 기준 `w-24`(96px)의 최악 케이스 `2026-11` = 60.4px, 차트 `grid.left:80` 대비 y축 라벨 `111,111만`@12px = 60.2px로 여유가 충분하다.
- **`MarkdownView.tsx`는 손대지 않았다.** 사용자 결정(코드 블록 monospace 유지)에 따라 Tailwind preflight의 mono 리셋에 맡겼다.

## 자체 검증 결과

**(재작업 2회차)** — /qa 2회차 PASS 이후, 재작업 1회차에서 내가 넣은 코드의 결함 2건과 유실된 락파일 정리를 마무리했다.

- **[Low-1] 락파일 되돌림 유실** → `@emnapi/wasi-threads` `1.2.3 → 1.2.2` 재적용. 1회차 되돌림 직후에는 깨끗했으나(`npm install`이 `up to date` 응답) 이후 누군가의 `npm install`이 재해석하며 되살아났다. **`^1.2.2` 범위 의존성이라 앞으로도 `npm install`이 다시 올릴 수 있다** — 커밋 직전에 `git diff -- frontend/package-lock.json`으로 재확인이 필요하다
- **[Low-2] preload href가 Vite `base`를 무시** → `configResolved`에서 resolved base를 받아 붙이도록 수정(`frontend/vite.config.ts`). 현재 설정(base=`/`)에서는 출력이 동일해 회귀 없음을 빌드로 확인했고, 서브패스 배포 시 404가 되던 잠재 결함을 제거했다
- **[Low-4] 비표준 `format('woff2-variations')`** → `format('woff2')`로 교체(`frontend/src/index.css`). 업스트림 동봉 CSS가 쓰던 구문이지만 Safari 10~11 시절의 비표준 표기라, 모르는 엔진은 `src` 항목 전체를 건너뛰어 **폰트가 아예 안 뜰 수 있다**. plain `woff2`는 모든 현행 엔진이 이해하며 가변 축도 정상 동작한다(아래 실측)
- **[Low-3] dev preload 경로 하드코딩** → 미처리. dev 전용 경로이고 프로덕션 배포에 영향이 없으며, 어긋남을 자동 감지하려면 CSS 변환 결과를 파싱해야 해 비용 대비 실익이 낮다고 판단했다. 대신 두 경로가 같아야 하는 이유를 코드 주석에 남기고 dev 실측으로 일치를 확인했다

재작업 2회차 검증(프로덕션 빌드를 `vite preview`로 서빙 후 브라우저 실측):

- `document.fonts.check('16px "SUIT Variable"')` = **true**, 등록 face = `{fam:"SUIT Variable", w:"100 900", status:"loaded", display:"swap"}` 1개 → `format('woff2')` 교체 후에도 정상 로드
- **가변 축 동작 확인**: 동일 텍스트 폭이 w100=648.21px / w400=669.71px / w900=696.5px로 굵기마다 다름 → `woff2-variations`를 뺐어도 wght 축이 살아 있다
- **폰트 요청 횟수 = 1회** (`/static/SUIT-Variable-gqD86R3M.woff2`) → preload href와 CSS `url()`이 일치해 624KB 중복 다운로드 없음
- `getComputedStyle(document.documentElement).fontFeatureSettings` = `"ss17", "ss18", "tnum"`, 본문 `fontFamily` = `"SUIT Variable", -apple-system...`
- tnum 자릿수 advance = `618 / 654` (변동 없음)
- `npm run build` EXIT=0 / `npm run lint` EXIT=0 / `git diff -- package-lock.json`에 `emnapi` 변경 **0건**
- 검증에 띄운 dev·preview 서버(5199/5200/5201)는 모두 종료 확인

**(재작업 1회차)** — /qa FAIL 판정의 High 1건과 Low 3건을 처리했다.

- **[High] AC-5 미충족** → 사용자 결정으로 해소. QA 지적이 정확했고 최초 구현 보고가 틀렸다. 폰트 바이너리 hmtx 파싱으로 "전 자릿수 618 균일"이라고 기록했으나 **브라우저 실측 결과 `1`만 0.654em, 나머지 9개는 0.618em**이다. 원인 재조사 결과: `tnum` 단독으로도 동일해 ss17 간섭이 아니고, wght 400/500/600/700 전부 동일해 gvar 변형도 아니며, `ss01`·`fwid`·`pnum` 조합과 static 빌드도 모두 동일하고, `@sun-typeface/suit`는 2.0.5가 최신이라 상위 버전 수정본도 없다 → **SUIT 폰트 자체의 결함으로 확정**. 사용자에게 보고해 **수용** 결정을 받았고 `research.md`의 AC-5를 "자릿수 `1` 제외 균일"로 개정, 영향도에 `tabular-nums` 21곳의 정렬 회귀(7자리 금액 최대 2.25px@14px)를 명시했다
- **[Low] implementation.md 사실 오류** → /qa가 정정한 내용을 유지하고, 본 문서 전체를 실측값 기준으로 갱신
- **[Low] EChart 강제 스타일 재계산** → `chartFontFamily()`에 모듈 스코프 lazy 캐시 도입 (`frontend/src/components/charts/EChart.tsx`)
- **[Low] 폰트 preload 없음** → `frontend/vite.config.ts`에 `preloadSuitFont()` 플러그인 추가
- **[Low] package-lock 노이즈** → 1회차에 되돌렸으나 이후 `npm install`로 되살아났고(/qa가 정확히 지적), **재작업 2회차에서 재적용**했다

검증 명령과 결과:

- `npm run build` (tsc -b + vite build) → **통과** (EXIT=0). `dist/static/SUIT-Variable-gqD86R3M.woff2` 624.53 kB 방출
- `npm run lint` (eslint) → **통과** (EXIT=0, 0 errors). 경고 2건은 `frontend/src/pages/TransactionsPage.tsx`의 기존 `useReactTable` 항목이며 이번 변경이 건드리지 않은 파일이다
- `dist/index.html` 검사: `<link rel="preload" as="font" type="font/woff2" crossorigin="" href="/static/SUIT-Variable-gqD86R3M.woff2">`가 스타일시트보다 앞에 주입됨
- dev 모드 실측(`npx vite --port 5199`): 주입된 preload href와 CSS가 참조하는 URL이 `/node_modules/@sun-typeface/suit/fonts/variable/woff2/SUIT-Variable.woff2`로 **동일**, `status=200 type=font/woff2 size=624536`. 검증 후 dev 서버 종료 확인
- `git diff -- package-lock.json`: 1회차 시점에는 폰트 의존성 교체 외 변경 0건이었으나 이후 `npm install`로 `@emnapi/wasi-threads`가 되살아났다 (재작업 2회차에서 재적용)
- 빌드 CSS 검사: `html{font-feature-settings:"tnum", "ss17", "ss18";font-family:SUIT Variable,-apple-system,...}` / `@font-face{...font-display:swap;src:url(/static/SUIT-Variable-gqD86R3M.woff2)format("woff2-variations")}`
- 브라우저 실측(자릿수 advance, em / 100px 기준): `tnum` 적용 시 `0,2~9`=**0.618** 균일, `1`=**0.654**. 미적용 시 0.409~0.622로 제각각 → tnum 유지가 유리함을 확인. wght 400/500/600/700에서 동일
- 폰트 GSUB 룩업 검사: `ss17` → `0`,`1`,`l`,`I` 치환 / `ss18` → `→ ← ↑ ↓` 치환(`↔`는 대체 글립 없음)
- cmap 검사: 한글 음절 **11,172/11,172(100%)**, `→ ← ↑ ↓ ↔ ₩ · … ★ ✓ ① ㈜ ㎡ ℃` 포함, `— –` 미포함
- Geist 잔재: 코드·설정 전체(`node_modules`/`dist`/`docs` 제외) grep **0건**
- 재작업 변경분(preload·캐싱)의 브라우저 E2E 재확인은 `/qa` 위임

## 성공 기준 자가 체크

- [x] AC-1: `html{font-family:SUIT Variable,...}` 전역 상속 — /qa가 3개 페이지 `getComputedStyle`로 확인 완료
- [x] AC-2: 폰트가 동일 출처 `/static/SUIT-Variable-gqD86R3M.woff2`로 200 응답, 외부 CDN 요청 0건 — /qa 네트워크 실측 완료
- [x] AC-3: `html`/`body`/표본 요소의 `fontFeatureSettings` = `"ss17", "ss18", "tnum"` — /qa 확인 완료
- [x] AC-4: ss18이 갈매기형→샤프트 화살표로, ss17이 `0`/`l`/`I`를 치환 — /qa 스크린샷 대조 완료. variable 폰트에 feature가 존재하므로 static 전환 불필요
- [x] AC-5 (개정본): `tnum` 적용 시 `0,2~9`가 0.618em으로 균일하고 `1`만 0.654em — 브라우저 실측으로 확인. **`1`의 예외는 SUIT 폰트 결함이며 사용자가 수용해 계약을 개정했다**. 재작업 전 원문 AC(전 자릿수 완전 균일)로는 미충족이 맞다
- [x] AC-6: `EChart`가 실제로 SUIT를 canvas에 설정 — /qa가 `CanvasRenderingContext2D.prototype.font` 후킹으로 확인 완료
- [x] AC-7: `MarkdownView`의 `pre/code`가 mono 계열 유지, SUIT feature 미침투 — /qa 확인 완료
- [x] AC-8: geist 제거·suit 추가, 락파일 갱신, 코드 내 grep 0건 — 확인 완료
- [x] AC-9: 375px 5개 페이지 + 캘린더 뷰 가로 스크롤·오버플로 0 — /qa 실측 완료. 캘린더 truncate 39건은 폰트 A/B로 폰트 무관임이 입증됨
- [x] AC-10: `npm run build`, `npm run lint` 모두 EXIT=0

## 보류/미완 항목

- **`ss17`은 숫자 `0`/`1`에 적용되지 않는다** — `tnum`(GSUB lookup 5)이 `ss17`(lookup 8)보다 먼저 적용되고 ss17의 coverage에 tnum 결과 글립이 없다. OpenType은 feature 선언 순서가 아니라 lookup 인덱스 순으로 적용하므로 CSS로 뒤집을 수 없다. 숫자는 고정폭이 우선하고 ss17은 `l`/`I` 식별에 작용한다
- **tabular `1`이 5.8% 넓다** — 위 AC-5 항목 참조. 사용자 수용 결정에 따라 코드 변경 없이 유지하며, `tabular-nums`가 걸린 21곳에서 `1`이 포함된 금액의 자릿수 정렬이 최대 2.25px(14px 기준) 어긋난다
- **em dash(`—`)는 폴백 폰트로 렌더된다** — SUIT에 U+2014 글립이 없다. 자리표시자용 단일 약물이라 레이아웃 영향은 없고, 문자 교체는 요청 범위 밖이라 손대지 않았다
- **`package-lock.json`의 transitive 되돌림은 불안정하다** — `@emnapi/wasi-threads`는 `^1.2.2` 범위 의존성이라 `npm install`이 다시 1.2.3으로 올릴 수 있다(실제로 1회 발생). 커밋 직전에 `git diff -- frontend/package-lock.json`으로 재확인이 필요하다
- **dev 모드 preload 경로는 하드코딩 상태다** — `frontend/vite.config.ts`의 `SUIT_DEV_PATH`. Vite가 CSS `url()`을 재작성한 결과와 어긋나면 dev에서 624KB를 두 번 받는다. 자동 감지 장치는 없고 dev 전용이라 프로덕션 영향은 없다
- **작업 트리에 이번 작업과 무관한 변경이 함께 있다** — `backend/app/{models,schemas}.py`, `backend/app/routers/{accounts,analytics,transactions}.py`, `backend/alembic/versions/0013_transaction_linked_account.py`, `frontend/src/pages/{AssetsPage,SettingsPage,TransactionsPage}.tsx`, `frontend/src/stores/masterData.ts`, `frontend/src/types.ts`, `docs/tasks/2026-07-31-easy-pay-per-transaction-link/`. 병행 작업(간편결제 거래별 연결)의 산출물이며 **이번 폰트 작업의 변경이 아니다**. 이번 작업 변경은 위 "변경 파일" 5개로 한정된다
