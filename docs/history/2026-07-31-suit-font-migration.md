# 작업 이력: 앱 전역 폰트를 SUIT로 교체 + OpenType 기능 적용

- **날짜**: 2026-07-31
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

앱 본문 폰트를 Geist Variable에서 한글 UI 폰트 **SUIT Variable**로 교체하고, 요청된 3개 OpenType 기능을 전역 적용했다 — `tnum`(고정폭 숫자), `ss17`(영숫자 혼용 시 식별용 변형 글자), `ss18`(대체 화살표). 폰트는 npm 패키지로 자체 호스팅해 외부 CDN 의존이 없다.

## 변경 파일 목록

- `frontend/package.json`, `frontend/package-lock.json` - `@fontsource-variable/geist` 제거, `@sun-typeface/suit@^2.0.5` 추가
- `frontend/src/index.css` - SUIT `@font-face` 직접 선언(`font-display: swap`), `--font-sans`를 SUIT + 한글 시스템 폰트 폴백 체인으로 교체, `--font-sans--font-feature-settings`/`--font-heading--font-feature-settings`에 3개 태그 선언
- `frontend/src/components/charts/EChart.tsx` - canvas는 CSS를 상속하지 않으므로 echarts `textStyle.fontFamily`에 SUIT 주입(`--font-sans`를 1회 캐시), 웹폰트 로드 후 1회 재측정
- `frontend/vite.config.ts` - SUIT woff2(624KB) preload 주입 플러그인 추가

## 상세 변경 내용

상세: [docs/tasks/2026-07-31-suit-font-migration](../tasks/2026-07-31-suit-font-migration/) 참조 (research.md / implementation.md / qa-report.md).

QA 판정 **PASS** (재QA 2회차, AC 10/10). 이후 QA가 남긴 Low 이슈 중 preload의 Vite `base` 미반영과 비표준 `format('woff2-variations')`를 추가로 수정했다.

### 알아둘 제약 (모두 SUIT 폰트 자체의 특성)

- **`tnum`을 켜도 자릿수 `1`만 0.654em으로 나머지(0.618em)보다 5.8% 넓다.** 7자리 금액 기준 최대 2.25px(14px) 어긋난다. 상위 버전·`ss01`·`fwid`·static 포맷 어느 것으로도 해결되지 않아 **사용자가 수용하기로 결정**했다 (tnum을 끄면 `1`이 0.409em까지 좁아져 훨씬 나빠짐). `tabular-nums`가 걸린 21곳에 해당
- **`ss17`은 숫자 `0`/`1`에 적용되지 않는다.** `tnum`(GSUB lookup 5)이 `ss17`(lookup 8)보다 먼저 적용되고 ss17 coverage에 tnum 결과 글립이 없다. OpenType은 lookup 인덱스 순으로 적용해 CSS로 뒤집을 수 없다. ss17은 `l`/`I` 식별에 작용
- **em dash(`—`)는 폴백 폰트로 렌더된다.** SUIT에 U+2014 글립이 없다(한글 완성형은 11,172자 100% 커버). 자리표시자용 단일 약물이라 레이아웃 영향 없음
- **차트 텍스트에는 OpenType 기능이 적용되지 않는다.** canvas는 `ctx.font`만 쓰므로 폰트 패밀리만 통일된다
- `package-lock.json`의 transitive 되돌림은 불안정하다 — `@emnapi/wasi-threads`는 `^1.2.2` 범위라 `npm install`이 다시 올릴 수 있다

## 테스트 방법

1. `cd frontend && npm install && npm run build`
2. 브라우저에서 `getComputedStyle(document.body).fontFamily`가 `"SUIT Variable"`로 시작하는지 확인
3. `getComputedStyle(document.documentElement).fontFeatureSettings`에 `tnum`·`ss17`·`ss18`이 모두 있는지 확인
4. 거래 목록의 이체 표기(`A → B`)에서 화살표가 갈매기형(`>`)이 아닌 샤프트 있는 정식 화살표인지 확인
5. 네트워크 탭에서 SUIT woff2가 **동일 출처로 1회만** 요청되는지 확인 (외부 CDN 요청이 없어야 함)
6. 375px 뷰포트에서 전 페이지 가로 스크롤·잘림이 없는지 확인
7. 배포 반영에는 프론트엔드 컨테이너 재빌드가 필요하다
