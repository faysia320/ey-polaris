# Research: 앱 전역 폰트를 SUIT로 교체 + OpenType 기능(tnum/ss17/ss18) 적용

- 날짜: 2026-07-31
- 요청 원문: 앱 전체에서 사용중인 모든 폰트를 suit 폰트로 변경해줘 (https://sun.fo/suit/) 이거야. 그리고 Font Features에서 고정폭 숫자, 명확한 표현을 위한 글자, 대체 화살표 기능을 적용해줘

## 요약

현재 앱의 본문 폰트는 `@fontsource-variable/geist`로 자체 호스팅되는 **Geist Variable** 하나뿐이다 (`frontend/src/index.css:4,10`). Tailwind v4의 `--font-sans` 테마 키에 지정되어 있고 `html`에 `@apply font-sans`로 걸려 전역 상속된다 (`frontend/src/index.css:127-129`). 따라서 폰트 교체의 실제 변경점은 **index.css의 import 한 줄 + `--font-sans` 값 + package.json 의존성** 세 곳으로 좁다.

SUIT는 npm 패키지 `@sun-typeface/suit@2.0.5`로 배포되며 variable woff2(`fonts/variable/woff2/SUIT-Variable.woff2`, 610KB, weight 100–900)와 동봉 CSS(`SUIT-Variable.css`, family명 `'SUIT Variable'`)를 제공한다. 기존 Geist와 동일한 "npm 패키지 CSS를 `@import`" 패턴을 그대로 재사용할 수 있다.

요청한 3개 Font Feature는 sun.fo/suit 문서 기준 **tnum**(정확한 자릿수 표현을 위한 고정폭 숫자), **ss17**(영문자·숫자 혼용 시 명확한 식별을 위해 변형된 글자), **ss18**(샤프트가 있는 일반적인 스타일의 화살표)에 대응한다. Tailwind v4는 `--font-sans--font-feature-settings` 테마 수정자를 공식 지원하며(`frontend/node_modules/tailwindcss/theme.css:495`), 이 값이 preflight의 `html` 규칙(`frontend/node_modules/tailwindcss/preflight.css:43`)과 `font-sans` 유틸리티 양쪽에 자동으로 실려 전역 상속된다. 즉 `index.css` 한 곳에서 폰트와 feature를 동시에 확정할 수 있다.

두 가지 사각지대가 있다. (1) **ECharts 차트 텍스트**는 canvas 렌더라 CSS를 상속하지 않고 echarts 기본값 `sans-serif`를 쓴다(`frontend/src/components/charts/EChart.tsx:30,43`) — 별도로 `textStyle.fontFamily`를 지정해야 "앱 전체"가 성립한다. (2) **코드 블록**(`frontend/src/components/MarkdownView.tsx:27-35`)은 preflight의 mono 계열 규칙을 타므로 SUIT 영향권 밖인데, 사용자 확인 결과 monospace를 그대로 유지하기로 했다.

## 관련 파일 및 근거

- `frontend/src/index.css:4` — `@import "@fontsource-variable/geist"` — 현재 폰트 파일을 로드하는 유일한 지점. SUIT CSS import로 교체 대상
- `frontend/src/index.css:10` — `--font-sans: 'Geist Variable', sans-serif;` — Tailwind 테마의 sans 정의. SUIT로 교체 + `--font-sans--font-feature-settings` 추가 지점
- `frontend/src/index.css:9` — `--font-heading: var(--font-sans);` — 헤딩도 sans를 그대로 참조하므로 별도 수정 불필요 (자동 승계 확인용 근거)
- `frontend/src/index.css:127-129` — `html { @apply font-sans; }` — 전역 상속의 진입점. Tailwind v4의 font-family 유틸리티는 `--font-*--font-feature-settings` 수정자를 함께 방출하므로 feature도 여기서 상속된다
- `frontend/package.json:13` — `"@fontsource-variable/geist": "^5.2.9"` — 제거 대상 의존성. `@sun-typeface/suit` 추가 위치
- `frontend/node_modules/tailwindcss/theme.css:495` — `--default-font-feature-settings: --theme(--font-sans--font-feature-settings, initial);` — Tailwind v4가 해당 수정자를 1급으로 지원한다는 근거
- `frontend/node_modules/tailwindcss/preflight.css:43` — `html` 요소에 `font-feature-settings: --theme(--default-font-feature-settings, normal)` 적용 — 테마 수정자만 채우면 전역 적용됨
- `frontend/node_modules/tailwindcss/preflight.css:120-124` — `code`/`pre`/`kbd`/`samp`는 `--default-mono-*` 계열로 별도 리셋 — 코드 블록이 자동으로 monospace를 유지하는 근거
- `frontend/src/components/charts/EChart.tsx:30` — `echarts.init(containerRef.current, 'dark')` — 폰트 지정 없음. canvas 텍스트가 CSS를 상속하지 않는 지점
- `frontend/src/components/charts/EChart.tsx:43` — `setOption({ backgroundColor: 'transparent', ...option }, true)` — notMerge(true)이므로 기본 `textStyle`은 이 병합 객체에 함께 넣어야 유효
- `frontend/src/components/MarkdownView.tsx:27-35` — `code`/`pre` 렌더러. font-family 미지정 → UA/preflight monospace. 사용자 결정에 따라 변경 없음
- `frontend/index.html:1-13` — `<head>`에 폰트 관련 link 없음. CDN 미사용(셀프호스팅) 결정에 따라 이 파일은 변경 없음
- `frontend/src/main.tsx:4` — `import './index.css'` — 폰트 CSS가 앱 전체에 주입되는 경로
- `frontend/Dockerfile:8,11` — `npm install` → `npm run build`. 폰트가 npm 의존성이면 컨테이너 빌드에 자동 포함되고 런타임 외부 네트워크 의존이 없다는 근거
- `frontend/src/components/ui/dialog.tsx:133`, `frontend/src/components/ui/card.tsx:41` — `font-heading` 유틸리티 사용처. `--font-heading`이 `--font-sans`를 참조하므로 자동 반영 확인 대상
- `frontend/src/pages/TransactionsPage.tsx:219,521,1157,1307` / `frontend/src/pages/SettingsPage.tsx:367` — 화면에 노출되는 `→` 문자 (계정 이체 표기). **ss18(대체 화살표) 육안 검증 지점**
- `frontend/src/pages/TransactionsPage.tsx:1894` — `자동 페어 ↔ ...` — 양방향 화살표 노출 지점
- `frontend/src/pages/TransactionsPage.tsx:446,506,1179,1265` / `frontend/src/pages/DashboardPage.tsx:282,341,348` / `frontend/src/pages/BudgetsPage.tsx:127` — 기존 `tabular-nums` 클래스 사용처(총 21곳). tnum 전역 적용 후에도 `font-variant-numeric`이 우선하므로 충돌 없음을 확인할 지점
- `frontend/src/pages/AssetsPage.tsx:146-148` — 차트 axis 설정. 페이지 측에서 `textStyle`을 지정한 곳은 없어(전 페이지 grep 0건) EChart 공통 기본값이 안전하게 먹히는 근거

## 영향도

- **전 페이지·전 컴포넌트 시각적 영향** — Dashboard/Transactions/Budgets/Assets/Settings 및 모든 `ui/*` 컴포넌트. `html` 상속이므로 예외 없이 글자 모양·자간·글자 폭·행 높이가 바뀐다
- **레이아웃 회귀 리스크(높음)** — SUIT는 한글 전용 설계라 Geist와 글립 폭·x-height가 다르다. 고정 폭 컨테이너(`frontend/src/pages/DashboardPage.tsx:181`, `frontend/src/pages/BudgetsPage.tsx:127`, `frontend/src/pages/TransactionsPage.tsx:1265`의 `w-24` 월 표시 등)와 `whitespace-nowrap`/`truncate`가 걸린 셀에서 잘림·줄바꿈·겹침이 새로 생길 수 있다. 375px 뷰포트에서 특히 위험
- **번들 크기** — variable woff2 610KB가 추가되고 Geist(unicode-range 분할, 실사용분 수십 KB)가 빠진다. 순증 약 +550KB. 초기 로딩 체감에 영향 → `font-display: swap` 필요
- **`frontend/package-lock.json`** — 의존성 교체로 재생성됨. Dockerfile이 `npm install`을 쓰므로(`frontend/Dockerfile:8`) 락파일 갱신 누락 시에도 빌드는 되지만, 커밋에 포함해야 재현성이 유지된다
- **ECharts 차트(`frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/AssetsPage.tsx`)** — `textStyle` 지정 시 축 라벨 폭이 바뀌어 `grid.left: 80`(`frontend/src/pages/AssetsPage.tsx:146`) 같은 고정 여백에서 라벨 잘림이 발생할 수 있다
- **canvas 렌더의 OpenType feature 미적용** — echarts는 `ctx.font`만 사용하므로 tnum/ss17/ss18이 차트 텍스트에는 적용되지 않는다. 폰트 패밀리만 통일된다 (알려진 제약으로 수용)
- **기존 `tabular-nums` 21곳의 자릿수 정렬이 부분적으로 어긋난다 (2026-07-31 추가 — /qa 실측)** — 이 문서의 초안은 "전역 tnum과 `tabular-nums` 유틸리티가 충돌 없음"으로만 기술했으나, 실제 회귀가 있다. SUIT의 tabular `1`이 0.654em으로 나머지 자릿수(0.618em)보다 넓어, Geist에서는 맞던 금액 열의 자릿수 정렬이 `1`이 포함된 값에서 어긋난다. 크기는 7자리 금액 기준 최대 **2.25px**(14px), **2.56px**(16px). 영향 지점은 `frontend/src/pages/TransactionsPage.tsx`(금액 열·묶음 모달), `frontend/src/pages/DashboardPage.tsx`(요약·최근 거래), `frontend/src/pages/BudgetsPage.tsx`(예산 표) 등 `tabular-nums`가 걸린 21곳 전부. 사용자 결정에 따라 수용한다
- **backend** — 영향 없음. `backend/app` 전체에 HTML/폰트 참조 없음(grep 0건)

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: 앱의 모든 텍스트가 SUIT로 렌더된다 — /qa 단계에서 브라우저 도구로 Dashboard·Transactions·Settings 각 1개 텍스트 요소에 대해 `getComputedStyle(el).fontFamily`가 `SUIT`로 시작하는지 확인 (코드 블록 제외)
- [ ] AC-2: SUIT 폰트 파일이 실제로 로드된다 — /qa 단계에서 `document.fonts.check('16px "SUIT Variable"') === true`이고, 네트워크 요청에서 SUIT woff2가 **동일 출처(앱 서버)** 200으로 응답하는지 확인 (외부 CDN 요청이 없어야 함)
- [ ] AC-3: 전역 font-feature-settings에 요청한 3개 태그가 모두 실려 있다 — /qa 단계에서 `getComputedStyle(document.documentElement).fontFeatureSettings`(및 임의 본문 요소)에 `tnum`, `ss17`, `ss18`이 모두 포함됨을 확인
- [ ] AC-4: 요청한 feature가 실제 글립 변화로 나타난다 — /qa 단계에서 화살표 노출 지점(`frontend/src/pages/TransactionsPage.tsx:219`의 이체 `A → B` 표기 등)을 스크린샷으로 캡처하고, 동일 텍스트를 `font-feature-settings: normal`로 강제한 상태와 비교해 화살표(ss18)·영숫자 글자꼴(ss17)이 다르게 렌더되는지 확인. 차이가 없으면 variable 폰트에 해당 GSUB가 없는 것이므로 static woff2 전환을 검토한다
- [ ] AC-5 (2026-07-31 개정): `tnum`이 적용되어 숫자 폭이 **자릿수 `1`을 제외하고** 균일하다 — /qa 단계에서 100px 기준 자릿수별 advance를 측정해 `0,2~9`가 모두 동일하고 `1`만 예외임을 확인. **SUIT는 tabular `1`의 advance가 0.654em으로 나머지(0.618em)보다 5.8% 넓은 폰트 자체 결함이 있으며, 사용자가 이를 수용하기로 결정했다**(아래 결정 사항 참조). 따라서 "전 자릿수 완전 균일"은 기준이 아니다. tnum 미적용 시 `1`이 0.409em까지 좁아져 편차가 훨씬 커지므로 tnum은 유지한다
- [ ] AC-6: 차트 텍스트도 SUIT로 렌더된다 — /qa 단계에서 Dashboard·Assets의 차트 축 라벨/범례를 스크린샷으로 확인하고, `EChart`에 SUIT 기본 `textStyle`이 적용되어 있는지 코드로 확인
- [ ] AC-7: 코드 블록은 monospace를 유지한다 — /qa 단계에서 AI 리포트 마크다운의 `code`/`pre` 요소 `getComputedStyle(el).fontFamily`가 monospace 계열임을 확인
- [ ] AC-8: Geist 잔재가 전혀 남지 않는다 — 저장소 전체(node_modules·dist 제외)에서 `Geist`/`fontsource` grep 결과 0건이고, `frontend/package.json`에 `@fontsource-variable/geist`가 없으며 `package-lock.json`이 갱신되어 있음을 확인
- [ ] AC-9: **모바일(375px)에서 레이아웃이 깨지지 않는다** — /qa 단계에서 브라우저 도구로 375px 뷰포트를 설정하고 Dashboard·Transactions(목록/캘린더)·Budgets·Assets·Settings 5개 페이지에서 가로 스크롤·요소 겹침·텍스트 잘림이 없는지 확인. 특히 `w-24` 월 표시와 금액 셀, 차트 축 라벨을 중점 확인
- [ ] AC-10: 빌드와 린트가 통과한다 — `cd frontend && npm run build`(tsc + vite)와 `npm run lint`가 에러 없이 종료

## Action Items

- [ ] `frontend/package.json`에서 `@fontsource-variable/geist`를 제거하고 `@sun-typeface/suit`(v2 계열)를 추가한 뒤 설치해 `package-lock.json`을 갱신한다
- [ ] `frontend/src/index.css:4`의 Geist import를 SUIT variable CSS import(`@sun-typeface/suit/fonts/variable/woff2/SUIT-Variable.css`)로 교체한다 — 패키지 동봉 CSS의 `url()`이 상대경로 `./SUIT-Variable.woff2`이므로 Vite가 woff2를 번들 산출물로 복사한다 (Geist와 동일 패턴)
- [ ] 패키지 동봉 `@font-face`에는 `font-display`가 없어 기본 `auto`(FOIT)로 동작한다 — `font-display: swap`을 보장할 방법(자체 `@font-face` 선언으로 대체하거나 동등한 수단)을 구현 단계에서 선택해 적용한다. 자체 선언으로 갈 경우 woff2 경로 해석이 Vite 빌드에서 실제로 동작하는지 반드시 빌드 산출물로 검증할 것
- [ ] `frontend/src/index.css:10`의 `--font-sans`를 SUIT variable 패밀리명(`'SUIT Variable'`)으로 교체하고, 한글/이모지 폴백을 포함한 폴백 체인을 정리한다
- [ ] `--font-sans--font-feature-settings` 테마 수정자에 `tnum`, `ss17`, `ss18`을 선언해 전역 적용한다 (`@theme inline` 블록 내부. 값 표기 형식은 구현 재량)
- [ ] `frontend/src/components/charts/EChart.tsx:43`의 기본 옵션 병합 객체에 SUIT를 가리키는 `textStyle.fontFamily` 기본값을 추가한다 — `setOption(..., true)`가 notMerge이므로 병합 객체 안에 넣어야 하고, 호출 측 `option`이 덮어쓸 수 있도록 스프레드 순서를 유지한다
- [ ] 폰트 로드 완료 전 차트가 렌더되면 canvas 텍스트가 폴백 메트릭으로 그려질 수 있다 — 필요 시 `document.fonts.ready` 이후 `resize()`/재렌더로 보정할지 구현 단계에서 판단한다 (구현 재량)
- [ ] SUIT 적용 후 폭이 달라지는 고정 크기 요소를 점검·보정한다: 월 표시 `w-24`(`frontend/src/pages/DashboardPage.tsx:181`, `frontend/src/pages/BudgetsPage.tsx:127`, `frontend/src/pages/TransactionsPage.tsx:1265`), 차트 `grid.left`(`frontend/src/pages/AssetsPage.tsx:146`), `truncate`/`whitespace-nowrap`이 걸린 거래 목록 셀
- [ ] `frontend/src/components/MarkdownView.tsx`는 변경하지 않는다 (코드 블록 monospace 유지 — 사용자 결정). preflight의 mono 리셋이 실제로 유지되는지만 확인한다
- [ ] `npm run build`와 `npm run lint`로 회귀를 확인한다

## 결정 사항 및 출처

- [사용자 확인] 코드 블록/인라인 코드도 SUIT로 바꿀 것인가? → **monospace 유지** : `frontend/src/components/MarkdownView.tsx`는 수정하지 않고, Tailwind preflight의 mono 리셋(`frontend/node_modules/tailwindcss/preflight.css:120-124`)에 맡긴다. AC-7로 검증
- [사용자 확인] 폰트 파일 배포 방식(npm 셀프호스팅 vs jsDelivr CDN)? → **npm 셀프호스팅** : `@sun-typeface/suit`를 의존성으로 추가하고 `index.css`에서 import. `frontend/index.html`에는 CDN link를 추가하지 않는다. AC-2에서 "외부 CDN 요청 없음"으로 검증
- [기술 결정] static(9종 파일) vs variable(단일 파일)? → **variable** : variable woff2 610KB 단일 파일이 9굵기를 모두 커버하며, 앱이 실제로 쓰는 굵기(medium/semibold/bold 등 21개 파일에 걸쳐 분포)를 static으로 담으면 오히려 요청 수와 총량이 늘어난다. 기존 Geist도 variable 방식(`frontend/package.json:13`)이라 패턴이 일치
- [기술 결정] Font Feature 태그 매핑? → **고정폭 숫자=`tnum`, 명확한 표현을 위한 글자=`ss17`, 대체 화살표=`ss18`** : sun.fo/suit 공식 Font Features 표 기준 — tnum "정확한 자릿수 표현을 위한 고정폭 숫자", ss17 "영문자와 숫자가 혼합된 시리얼 번호 등을 표현할 때 명확한 식별을 위해 변형된 글자", ss18 "샤프트가 있는 일반적인 스타일의 화살표". 요청에 없는 `ss01`(다른 형태의 숫자)은 적용하지 않는다
- [기술 결정] Feature 적용 지점? → **Tailwind v4 테마 수정자 `--font-sans--font-feature-settings`** : `frontend/node_modules/tailwindcss/theme.css:495`가 이 키를 `--default-font-feature-settings`로 승격하고 `preflight.css:43`이 `html`에 적용하며, `font-sans` 유틸리티도 같은 수정자를 함께 방출한다(tailwindcss `dist/lib.js`의 `resolveWith(..., ["--font"], ["--font-feature-settings", ...])`). 따라서 `index.css` 한 곳 선언으로 전역 상속 + 코드 블록 예외가 동시에 성립
- [기술 결정] 기존 `tabular-nums` 유틸리티(21곳) 제거 여부? → **유지** : `font-variant-numeric`은 `font-feature-settings`보다 우선 적용되는 상위 속성이라 전역 tnum과 충돌하지 않고, 제거는 이번 요청 범위를 벗어난 대량 수정이다
- [사용자 확인] (2026-07-31, /qa FAIL 후) SUIT는 `tnum`을 켜도 자릿수 `1`만 0.654em으로 5.8% 넓어 완전한 고정폭이 되지 않는다. 상위 버전(2.0.5가 최신)에 수정본이 없고 `ss01`·`fwid`·static 포맷 등 어떤 조합으로도 해결되지 않으며 CSS로 글립 폭을 보정할 수단도 없다. → **수용하고 SUIT 유지** : AC-5를 "자릿수 `1` 제외 균일"로 개정하고, `tabular-nums` 21곳의 정렬 회귀를 영향도에 명시한다. 대안이던 "숫자만 별도 폰트(`unicode-range: U+0030-0039`)"는 숫자 글자꼴이 SUIT가 아니게 되고 ss17도 숫자에 못 쓰게 되므로 채택하지 않는다
- [사용자 확인] (2026-07-31) /qa가 남긴 Low 이슈 3건 처리 여부? → **셋 다 처리** : ① `EChart`의 `getComputedStyle` 반복 호출을 모듈 스코프 캐시로 1회화, ② 624KB woff2에 `preload` 추가(폴백→SUIT 전환 FOUT 완화), ③ `package-lock.json`의 폰트 무관 transitive 갱신 되돌리기

## 미해결 질문

없음 — 초안의 미해결 질문 2건은 모두 해소되었다.

- ~~SUIT **variable** woff2에 `ss17`/`ss18` GSUB가 포함되어 있는지~~ → **해소(/implement)**: variable 빌드의 GSUB FeatureList에 `aalt, fwid, pnum, sinf, ss01, ss17, ss18, subs, sups, tnum` 10개가 존재. static 전환 불필요. /qa가 브라우저 렌더로 재확인
- ~~SUIT의 한글 글립 커버리지~~ → **해소(/implement)**: cmap 실측 결과 한글 완성형 **11,172/11,172(100%)**. 다만 em dash(U+2014)·en dash(U+2013)가 없어 자리표시자 `—`는 폴백 폰트로 렌더된다 (레이아웃 영향 없음, 폴백 체인으로 흡수)
