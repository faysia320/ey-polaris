# QA Report: 지출/수입 구분 뱃지 다크모드 가독성 개선

- 날짜: 2026-07-23
- 작업 폴더: `C:\WorkSpace\repos\ey-polaris\docs\tasks\2026-07-23-kind-badge-dark-readability`
- 판정: CONDITIONAL PASS

계약 출처: 위 폴더의 `research.md`(AC-1~AC-6). `implementation.md`는 참고 자료로만 사용(자가 체크는 아래에서 독립 검증).

## 성공 기준 채점

- ✅ AC-1 (뱃지 3종 의미색): `KIND_BADGE_CLASS`(`TransactionsPage.tsx:97-101`)가 income=emerald / expense=rose / transfer=sky로 매핑되고, 금액 텍스트 `kindAmountClass`(`:108-109`, emerald/rose/sky)와 동일 계열. 갓 빌드한 CSS 번들(`dist/static/index-CAZqpC7o.css`)에 `bg-emerald-500`/`bg-rose-500`/`bg-sky-500`, `text-emerald-300`/`text-rose-300`/`text-sky-300`, `border-*-500`이 모두 생성됨을 grep으로 확인(각 존재). 세 색이 서로 다름.
- ✅ AC-2 (반투명 틴트 + 밝은 글자): 매핑값 `bg-{c}-500/15 text-{c}-300 border-{c}-500/25`. 무채색 `secondary/outline/default` 변형 제거됨. 지출이 `bg-rose-500/15` 배경을 가져 이전 `outline`(테두리만) 동화 문제 해소. 빌드 CSS에 해당 클래스 존재로 실제 적용 확인.
- ✅ AC-3 (세 call site 동일 색): 테이블(`:267`), 모바일 카드(`:695`), 요약 리스트(`:811`) 모두 `<Badge variant="outline" className={KIND_BADGE_CLASS[...]}>`로 단일 출처 참조. 동일 kind → 동일 클래스.
- ✅ AC-4 (라벨·형태 불변): `KIND_LABEL` 미변경. `variant="outline"` 유지 → `badgeVariants`의 `h-5 w-fit rounded-4xl inline-flex`(`badge.tsx:8`) 보존. className은 tailwind-merge로 color 유틸만 교체(`text-foreground→text-*-300`, `border-border→border-*-500/25`, `bg-*` 추가), 치수 클래스 미포함이라 형태 유지.
- ✅ AC-5 (375px 모바일): **정적 확인**(라이브 375px 실측은 환경 제약으로 불가 — 아래 검증 시나리오 참조). 375px에서는 카드 리스트(`:678` `space-y-2 sm:hidden`)만 렌더되고 데스크톱 테이블(`:637` `hidden sm:block`)은 숨겨짐. 뱃지 변경은 색상 전용(레이아웃/치수 불변, h-5 w-fit), 카드 금액은 `formatAmount`로 "원"이 빠져 **문자열이 더 짧아짐**(폭 증가 요인 아님). `block text-right` 정렬 변경은 데스크톱 테이블 셀에만 적용 → 375px 무영향. 새로운 오버플로/겹침/잘림 유발 요소 없음.
- ✅ AC-6 (build/lint): `npm run build` → tsc+vite 통과(3672 modules, 에러 0). `npm run lint` → 0 errors, 경고 2건(`TransactionsPage.tsx:332` useMemo deps, `:335` TanStack incompatible-library)은 이번 변경과 무관한 기존 경고. 직접 실행으로 확인.

## 검증 시나리오

- `npm run build`(작업 트리 기준) → 성공, 산출 CSS `dist/static/index-CAZqpC7o.css`.
- `npm run lint` → 0 errors / 2 pre-existing warnings.
- 빌드 CSS 교차 검증: 9개 신규 클래스 계열(`bg/border/text × emerald/rose/sky`) 모두 번들에 존재 → Tailwind JIT가 purge하지 않고 생성함을 확인(뱃지 색이 실제로 CSS에 존재).
- tailwind-merge 병합 의미 검토: `outline`의 `border-border`/`text-foreground`가 주입 클래스로 대체, `bg-*`는 `outline`에 없어 신규 적용, `h-5` 유지 → AC-4 형태 보존 근거.
- 반응형 경계 확인: `:637` 데스크톱 테이블 `hidden sm:block`, `:678` 카드 리스트 `space-y-2 sm:hidden` → 375px에서 카드만 렌더.
- **라이브 브라우저 E2E 시도·실패(환경 제약)**: 레시피 A 전제인 "앱을 Chrome에 로드"가 불가. `http://localhost:3000/`·`http://127.0.0.1:3000/`·`http://localhost:8000/docs` 모두 `chrome-error://chromewebdata/`(net error)로 로드 실패. 반면 `https://example.com/`은 정상 로드 → 이 Chrome 인스턴스가 호스트의 localhost 네트워크에 도달하지 못함(curl로는 세 URL 모두 200). Cloudflare 퀵터널로 공개 URL을 만들면 Chrome이 도달 가능하나, **실데이터가 있는 개인 가계부 앱(backend 8000 기동 중)을 공개 인터넷에 노출**하는 프라이버시 위험이 있어 수행하지 않음. 따라서 AC-5는 위의 정적 분석 + 반응형 경계 확인으로 판정.
- 추가로, 브라우저가 접속한 nginx 프로덕션 번들은 **stale**(`index-BsfJok5J.js`, Last-Modified 04:23)로 현재 diff의 `index-CDeQ5VWr...` 빌드와 불일치 → 라이브 검증을 했더라도 구코드를 봤을 것이므로, 작업 트리 기준 재빌드로 검증함.
- 파괴적 기능(엑셀 가져오기 등) 미실행. 검증 데이터 생성 없음 → 실데이터 영향 없음.

## 발견 이슈

- [Medium] `TransactionsPage.tsx:286,289,706,825` + `format.ts:22-24` — **문서화되지 않은 범위 이탈 변경.** research.md의 AC는 전부 뱃지 색에 관한 것인데, diff에는 계약에 없는 금액 표시 변경이 포함됨: (1) 신규 `formatAmount`로 3개 렌더 위치의 금액에서 **"원" 접미사 제거**(`formatKRW→formatAmount`), (2) 데스크톱 테이블 금액 셀 `block text-right tabular-nums` 및 정렬 헤더 버튼 `w-full justify-end` 우측 정렬. 사용자 요청 원문은 뱃지 색만이며 어떤 AC도 이 동작을 다루지 않음. 더욱이 `implementation.md`는 "변경 파일: TransactionsPage.tsx"로 `format.ts`를 누락하고 "research.md와의 차이: 없음"이라 **명시적으로 오기재** → 파이프라인의 추적성/리뷰 계약을 우회하고 메인 화면의 사용자 가시 동작을 스펙 밖에서 변경. 크래시/데이터 손상은 아님(동작 자체는 정상). 영향: 금액에 통화 단위가 사라짐(가계부 앱 문맥상 가독성 저하는 경미하나 미요청·미리뷰 변경).
- [Low] `format.ts:22-24` — `formatAmount`가 `formatNumber`(`:27-29`)와 **본문이 완전히 동일한 중복 함수**(`return krw.format(amount)`). 기존 `formatNumber`를 재사용하면 되는데 동일 기능의 새 export를 추가함(불필요한 중복).
- [Low] `implementation.md:18` — 문서의 경고 줄번호(`:331`/`:334`)가 실제(`:332`/`:335`)와 어긋남(사소한 드리프트).

## QA 중 적용한 수정 (Low 한정)

- 없음. 후보 Low 2건 모두 **Medium 이슈와 코드가 얽혀 있어** 안전한 국소 수정 범위를 벗어남:
  - `formatAmount` 중복 제거는 `TransactionsPage`의 import와 3개 call site(Medium으로 지적된 범위)를 함께 고쳐야 하므로 동작을 바꾸는 리팩터링 → 수정하지 않음.
  - `implementation.md`의 오기재는 Medium 이슈의 증거 자체라 정정 시 발견 사실을 가리게 되므로 정정하지 않고 그대로 보고.

## 수정 Action Items (CONDITIONAL)

- [ ] 범위 이탈한 금액 표시 변경(“원” 제거 + 우측 정렬)이 의도된 사양인지 확정: 의도라면 research.md에 AC로 추가하고 `implementation.md`를 실제 변경 집합에 맞게 정정(`format.ts` 포함, "차이 없음" 문구 수정), 비의도라면 되돌린다.
- [ ] `formatAmount` 중복 해소: `formatNumber` 재사용으로 통일하거나 한쪽 제거(위 사양 확정과 함께 처리).

## 다음 단계

`/implement docs/tasks/2026-07-23-kind-badge-dark-readability` 로 위 Action Items 처리 후 `/qa` 재실행. (핵심 요청인 뱃지 색 개선 AC-1~AC-6은 전부 충족 — 남은 것은 범위 이탈 변경의 사양 확정/문서 정합.)
