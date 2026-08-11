# 작업 이력: 앱 전체를 SEED Design으로 전환

- **날짜**: 2026-08-11
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

같은 날 오전에 SEED를 **병존** 방식으로 얹었는데([2026-08-11-seed-design-setup](2026-08-11-seed-design-setup.md)), 이어서 그 병존을 끝내고 **앱 UI 전체를 SEED로 갈아탔다.** shadcn/ui는 컴포넌트도 토큰도 남아 있지 않다.

사용자 결정 사항:
- 기존 컬러·사이즈·간격·곡률은 전부 폐기하고 SEED 파운데이션으로 교체
- 브랜드 색은 SEED 기본(당근 오렌지 `#f60`) 그대로 — 우주/별 모티브의 노란 액센트는 사라졌다
- 아이콘은 `@karrotmarket/react-monochrome-icon`으로 전면 교체
- 앱 셸은 SEED SideNavigation 도입
- 단계별 커밋

`frontend/src` 약 7,200줄, UI 컴포넌트 15개, 페이지 5개가 대상이었다.

## 커밋 (0~7단계)

| 커밋 | 내용 |
| --- | --- |
| `5d54b7f` | 0단계 — shadcn 토큰 레이어 제거, SEED 스니펫 20종 설치, Surface 신설 |
| `8109a6e` | 1단계 — 앱 셸을 SEED SideNavigation으로 |
| `eba294b` | 2단계 — 대시보드·예산 + table.tsx 재작성 |
| `861f56a` | 3단계 — 자산 + DateField 신설 |
| `5611797` | 4단계 — 기준정보 관리 |
| `7d37fa2` | 5단계 — 지출/수입 내역 + TransactionCalendar 재구현 + MonthField 신설 |
| `3892d06` | 6단계 — 잔여 shadcn 파일 14종·의존성 5개 제거 |
| (이 커밋) | 7단계 — 차트 팔레트 SEED 전환 + 문서 갱신 |

## 상세 변경 내용

### 토큰 전환

`index.css`에서 shadcn CSS 변수(`:root`/`.dark`)와 `@theme inline`의 `--color-*`/`--radius-*` 매핑을 전부 지웠다. 남긴 건 SEED가 다루지 않는 SUIT 글꼴 정의뿐이다. 색상 모드 소유권도 `html.dark` 클래스에서 SEED의 `data-seed-color-mode="dark-only"`로 넘겼다.

Tailwind v4의 `border`는 색을 `currentColor`로 두므로(텍스트 색을 따라가는 테두리는 거의 항상 실수다) `@layer base`에서 기본 테두리 색을 `--seed-color-stroke-neutral-weak`로 못박았다. shadcn 리셋(`* { @apply border-border }`)을 걷어낸 자리다.

**알아둘 함정 — `space-y-*`:** SEED `tailwind4-theme`은 `p-*`/`gap-*`/`m-*`/`w-*`/`size-*`를 `@utility`로 재정의해 값을 `--dimension-*`에서 찾는다. 그런데 `space-y-*`는 재정의 대상이 아니라 **`space-y-x6`는 아무 효과가 없다.** 세로 간격은 `flex flex-col gap-x*`로 잡거나, flex를 못 쓰는 자리에서만 `space-y-(--dimension-x1)`로 토큰을 직접 참조한다.

(반대로 Tailwind 기본 스케일 `p-4`는 **여전히 동작한다.** 커스텀 `@utility`가 값을 해석하지 못하면 Tailwind가 내장 유틸리티로 폴백한다. 작업 도중 "죽는다"고 판단해 커밋 메시지에 잘못 적었고 `7d37fa2`에서 정정했다. 간격을 SEED 스케일로 통일한 이유는 기능이 아니라 일관성이다.)

### 앱 셸

SEED `SideNavigation`을 도입해 접기 기능이 따라왔다. 접힘(56px)에서는 브랜드와 푸터 문구를 감추고 접기 버튼만 남긴다 — 브랜드를 함께 두면 `overflow-x: hidden`에 버튼이 밀려 다시 펼 방법이 없어진다.

**SEED AppBar는 도입하지 못했다.** `@seed-design/stackflow` + `@stackflow/react`에 의존하는데, Stackflow는 액티비티 기반 네이티브 내비게이션 프레임워크라 도입하면 `react-router`를 통째로 걷어내야 한다. 모바일 상단 내비는 SEED 토큰·타이포·`Icon`으로 직접 짰다.

`Layout.Root`는 `density="high"`로 뒀다. 기본값 `medium`은 콘텐츠를 1040px로 묶는데 거래 내역 표가 넓어 데스크톱에서 가로 스크롤이 상시화된다.

### SEED에 대응이 없어 직접 유지하는 것

SEED는 모바일 앱 디자인 시스템이라 웹 대시보드 관용구가 없다. `src/components/ui/`에는 4개만 남았다.

- `table.tsx` — 셸만 유지하고 내부는 SEED 토큰으로 재작성. 가로 스크롤은 shadcn ScrollArea 대신 네이티브 `overflow-x`
- `Surface.tsx` — 카드 표면 스타일을 한곳에 모은 것
- `DateField.tsx` — SEED DatePicker는 트리거 없는 인라인 달력이라 폼에 그대로 못 넣는다. SEED 권장 조합인 `FieldButton` + 달력을 담은 `Dialog`로 감쌌다
- `MonthField.tsx` — SEED에 월 단위 선택이 없다. DateField와 같은 뼈대에 연도 이동 + 12개월 그리드

날짜 값은 앱 전역에서 `'YYYY-MM-DD'` 문자열을 유지하고, SEED가 쓰는 `{year, month, day}` 변환은 `lib/format.ts`의 `toCalendarDate`/`fromCalendarDate`가 경계에서만 처리한다. `Date`를 거치지 않아 `toISOString()`의 UTC 변환으로 날짜가 하루 밀리는 사고가 원천 차단된다.

### 컴포넌트 매핑

| 이전 | 이후 |
| --- | --- |
| `Button` | `ActionButton` (variant: `brandSolid`/`neutralWeak`/`neutralOutline`/`criticalSolid`/`ghost`) |
| `Badge` | SEED `Badge` (`tone`: neutral/positive/critical/informative) |
| `Input` + `Label` | `TextField` (라벨·설명·에러 슬롯 내장) |
| `Select` | SEED `Select` (값이 `string[]`) |
| `Dialog` | SEED `Dialog` / 파괴적 확인은 `AlertDialog` |
| `Tabs` | SEED `Tabs` |
| 표/캘린더 전환 박스 | `SegmentedControl` |
| 계정 활성 여부 Select | `Switch` |
| `Card` | `Surface` |
| `ScrollArea` | 네이티브 `overflow-y-auto` / `DialogBody` |
| lucide 아이콘 20여 종 | `@karrotmarket/react-monochrome-icon` |

`TransactionCalendar`는 직접 만든 7열 그리드를 버리고 SEED DatePicker의 `renderDateCellSupplement`로 재구현했다 — 날짜 셀 아래 부가 정보를 붙이라고 정의된 확장 지점이라 일별 수입/지출 합계에 정확히 맞고, 셀의 DOM·ARIA·키보드 이동을 컴포넌트가 계속 소유해 접근성이 따라온다.

### 차트

`lib/chartTheme.ts`를 신설해 SEED CSS 변수를 런타임에 읽는다. echarts 내장 `dark` 테마 대신 SEED 토큰으로 만든 테마를 `registerTheme`으로 등록했다. 카테고리 배색은 `blue → green → carrot → purple → red → yellow`를 500/700/300 단계로 돌려 18색을 만든다(색상군을 먼저 한 바퀴 돌아 인접 항목이 붙지 않는다). 트리맵 라벨은 블록 휘도로 명/암을 골라 대비를 확보한다.

### 알아둘 제약

- **당근 오렌지가 앱 전체를 지배한다.** 기본 CTA·선택 상태·포커스 링이 전부 `#f60`이다. 되돌리려면 `--seed-color-palette-carrot-*` 오버라이드가 필요하다
- **입력 컴포넌트의 `size`는 반드시 `responsive`로 준다.** 기본값이 `large`(52px, 터치 기준)라 데스크톱 표 안에서 지나치게 두툼하고, 일부만 `responsive`로 두면 `lg`(1280px) 이상에서 필드 높이가 갈린다. `responsive`는 1280px 미만 `large` / 이상 `medium`(40px)이다
- **SEED Tabs 안의 오버레이는 `Portal`로 감싸야 한다.** `seed-tabs__content`에 transform이 걸려 있어 `position: fixed`의 containing block이 되고, 감싸지 않으면 사이드 패널·바텀시트가 뷰포트가 아니라 탭 패널 안에 갇힌다
- **BottomSheetBody는 스크롤하지 않는다.** `height: auto`라 내용만큼 자란다 — SidePanelBody(스크롤 컨테이너)와 정반대다. ResponsiveSidePanel을 쓰면 한 컴포넌트가 두 성격을 오가므로, 본문 높이 규칙도 md 경계로 갈라야 한다 (`lib/utils.ts`의 `panelBodyScroll`)
- **푸터는 빈 컨테이너다.** SEED의 `*Footer`는 `flex-direction: column`만 걸린 껍데기라 버튼을 직접 넣으면 간격 0으로 세로로 붙는다. SEED 문서의 모든 예제가 `ResponsivePair`/`HStack`/`VStack`으로 감싸고 `gap="x2"`를 준다
- **네이티브 날짜/시간 input은 쓸 수 없다.** SEED text-input 스타일이 Chrome의 `::-webkit-calendar-picker-indicator` 박스를 입력 전체 크기로 늘려, 시계 아이콘을 눌러도 피커가 열리지 않고 포커스만 들어간다. `DateField`/`TimeField`/`MonthField`로 감싼 SEED 피커를 쓴다
- **`touchTarget`은 남겼다.** SEED ActionButton은 `size=small`이 36px, `size=medium`+iconOnly가 40px로 44px 권장치에 못 미쳐 모바일 히트 영역 확장이 여전히 값을 한다
- **내비 항목이 링크가 아니라 버튼이다.** `SideNavigationGroup`의 `items` API가 `onClick`만 받는다(SEED 블록 예제와 동일) — 새 탭으로 열기가 지원되지 않는다

## 테스트 방법

1. `cd frontend && npm install && npm run build && npm run lint` — lint는 기존 TanStack 경고 2건만 남아야 한다
2. `npm run dev` 후 5개 화면(대시보드/자산/내역/예산/설정)을 눌러본다
3. **잔존 토큰 검사** — 아래 둘 다 0건이어야 한다
   ```
   grep -rE '\b(bg|text|border|ring)-(primary|secondary|muted|accent|destructive|card|popover|background|foreground|border|input|ring|sidebar)\b' frontend/src --include=*.tsx
   grep -rE '\b(bg|text|border)-(rose|emerald|amber|sky|violet|yellow|zinc)-[0-9]' frontend/src --include=*.tsx
   ```
4. **레이어 순서 회귀 검사** — SEED 컴포넌트에 Tailwind 유틸이 먹히는지. 안 먹히면 `index.html`/`index.css`의 `@layer` 선언이 깨진 것
   - 검사에는 **앱에서 실제로 쓰는 클래스**를 써야 한다. `bg-red-500`처럼 소스에 없는 클래스는 Tailwind가 생성조차 하지 않아 "레이어가 깨진 것"처럼 오독하기 쉽다 (실제로 한 번 그렇게 잘못 판단했다). `bg-bg-neutral-weak`처럼 번들에 있는 유틸로 검사한다
5. **375px 모바일** — `resize_window`가 이 환경에서 동작하지 않아 iframe 프로브로 검사한다. 5개 화면 모두 `document.documentElement.scrollWidth === window.innerWidth`(=371)로 가로 스크롤 0을 확인했다
   ```js
   const f = document.createElement('iframe')
   f.src = '/transactions'
   f.style.cssText = 'position:fixed;top:0;left:0;width:375px;height:800px;z-index:2147483647'
   document.body.appendChild(f)
   // f.contentDocument.documentElement.scrollWidth 를 f.contentWindow.innerWidth 와 비교
   ```
6. 배포 반영에는 프론트엔드 컨테이너 재빌드가 필요하다
