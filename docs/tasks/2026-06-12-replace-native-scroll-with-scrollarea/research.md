# Research: 앱 native scroll을 shadcn/ui ScrollArea로 교체

- 날짜: 2026-06-12
- 요청 원문: 앱 모든 native scroll을 shadcn/ui 의 scrollarea로 교체하는 계획을 수립해줘

## 요약

frontend 앱 코드에서 native scroll(`overflow-*-auto`)을 쓰는 곳은 총 6개 위치로 전수 확인했다(`frontend/src` 전체 `overflow` grep 기준). 이 중 교체 대상은 **5개**: 공용 `Table` 컴포넌트의 가로 스크롤 래퍼 1개(테이블 사용처 5곳에 일괄 적용됨)와 페이지 내 세로 스크롤 목록 4개(TransactionsPage 2, DashboardPage 1, AssetsPage 1)다. 나머지 1개인 `select.tsx`의 `SelectContent`는 Radix Select 고유의 ScrollUp/DownButton 메커니즘과 결합된 내부 스크롤이라 ScrollArea로 감싸면 동작이 충돌하므로 제외를 권고한다(shadcn 공식 select도 native scroll 유지). 문서(body) 레벨 페이지 스크롤도 native로 유지한다 — ScrollArea로 바꾸려면 고정 높이 앱 셸로의 구조 변경이 필요하고, 모바일에서 주소창 축소·관성 스크롤 등 브라우저 기본 동작을 잃는다.

shadcn `scroll-area` 컴포넌트는 신규 추가가 필요하다(`frontend/src/components/ui/`에 현재 없음). 의존성은 추가 설치 불필요 — 이 프로젝트는 `radix-ui` 모놀리식 패키지(1.5.0)를 사용하며 `ScrollArea` 네임스페이스를 export한다. 단, shadcn 레지스트리 기본 코드는 `@radix-ui/react-scroll-area`에서 import하므로, 이 레포의 다른 ui 컴포넌트와 같은 패턴(`import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"`)으로 변환해 추가해야 한다.

핵심 리스크는 모바일이다. 직전 작업(`docs/tasks/2026-06-12-assets-page-horizontal-scroll/`)에서 375px 가로 오버플로를 잡았고, 그 AC-5는 "테이블 등 넓은 콘텐츠는 내부 `overflow-x-auto` 스크롤로 처리"를 계약으로 삼았다. Table 래퍼를 ScrollArea로 바꾸면 이 가로 스크롤이 Radix viewport로 옮겨가는데, 터치 스크롤이 계속 동작하는지와 페이지 레벨 가로 오버플로가 재발하지 않는지를 /qa에서 반드시 재검증해야 한다.

## 관련 파일 및 근거

### 교체 대상 (native scroll 사용처)
- `frontend/src/components/ui/table.tsx:7-10` — `Table`이 `<div className="relative w-full overflow-x-auto">`로 테이블을 감쌈. 여기를 ScrollArea(+가로 ScrollBar)로 바꾸면 테이블 사용처 5곳 전체에 일괄 적용됨
- `frontend/src/pages/TransactionsPage.tsx:909` — 엑셀 가져오기 결과의 건너뜀 행 목록, `max-h-40 overflow-y-auto`
- `frontend/src/pages/TransactionsPage.tsx:925` — 엑셀 가져오기 이체 검토 목록, `max-h-[50vh] overflow-y-auto pr-1` (`pr-1`은 native 스크롤바 여백 — ScrollArea 전환 시 처리 재량)
- `frontend/src/pages/DashboardPage.tsx:296` — 카테고리 지출 상세 다이얼로그 내 거래 목록, `max-h-80 overflow-y-auto`
- `frontend/src/pages/AssetsPage.tsx:381` — 자산 평가 이력 목록, `max-h-40 overflow-y-auto`

### 교체 제외 (근거 포함)
- `frontend/src/components/ui/select.tsx:72,77,87` — `SelectContent`의 `overflow-y-auto`는 `SelectScrollUpButton`/`SelectScrollDownButton`(자동 스크롤 버튼)과 결합된 Radix Select 내부 메커니즘. shadcn 공식 select도 ScrollArea를 쓰지 않음 → 제외 권고
- `frontend/src/components/layout/AppLayout.tsx:74` — 페이지 본문은 문서(body) native scroll. 별도 overflow 컨테이너가 아니며, ScrollArea화는 앱 셸 구조 변경(고정 높이 + 내부 스크롤)을 수반 → 제외 권고 (미해결 질문 참조)
- `DashboardPage.tsx:217`, `AssetsPage.tsx:268`, `badge.tsx:8`, `card.tsx:15` — `overflow-hidden`(클리핑)으로 스크롤이 아님 → 대상 아님

### 신규 추가 및 의존성
- `frontend/src/components/ui/scroll-area.tsx` — 신규 생성 필요 (Glob으로 부재 확인)
- `frontend/package.json:20` — `radix-ui@^1.5.0` 사용 중. `frontend/node_modules/radix-ui/dist/index.d.mts:45-46`에서 `ScrollArea` 네임스페이스 export 확인 → **추가 패키지 설치 불필요**
- `frontend/src/components/ui/dialog.tsx:4` — `import { Dialog as DialogPrimitive } from "radix-ui"` 패턴 확인. scroll-area.tsx도 동일 패턴으로 작성
- `frontend/src/index.css` — 커스텀 스크롤바 CSS 없음(grep 무일치) → 제거할 전역 스타일 없음

### Table 사용처 (래퍼 교체의 파급 범위)
- `frontend/src/pages/TransactionsPage.tsx:562` — 거래 내역 테이블 (행 수 많음, 모바일에서 가로 스크롤 필수)
- `frontend/src/pages/BudgetsPage.tsx:96` — 예산 테이블
- `frontend/src/pages/SettingsPage.tsx:135,329,486` — 기준정보 테이블 3개

## 영향도

- **테이블 5곳 전체**: `table.tsx` 래퍼 교체는 모든 테이블의 가로 스크롤 거동을 바꾼다. Radix ScrollArea의 Viewport는 자식을 `display:table; min-width:100%` 내부 div로 감싸므로 `<table className="w-full">` 레이아웃은 유지되지만, 스크롤바가 오버레이형으로 바뀌고 터치 스크롤은 Viewport의 숨김 native scroll로 동작한다. 375px 모바일 검증 필수 (CLAUDE.md 모바일 제약)
- **직전 작업과의 계약 충돌 가능성**: `docs/tasks/2026-06-12-assets-page-horizontal-scroll/research.md` AC-5가 "넓은 콘텐츠는 내부 `overflow-x-auto` 스크롤 처리"를 명시 — 본 작업 후에는 그 역할을 ScrollArea가 대신하므로, 같은 관찰 결과(페이지 레벨 가로 오버플로 없음 + 테이블 내부 스크롤 가능)가 유지되는지가 회귀 기준
- **다이얼로그 내부 스크롤 3곳**: DashboardPage 상세 다이얼로그, TransactionsPage 가져오기 다이얼로그(2개 목록), AssetsPage 평가 이력 — 모두 `max-h-*` 제한 목록이라 ScrollArea 루트에 동일 `max-h-*`를 옮기는 방식으로 거동 보존 가능. 콘텐츠가 max-h보다 작을 때 빈 공간이 생기지 않아야 함
- 없음 — backend: 이 작업은 frontend 렌더링 계층만 변경하며 API·상태(zustand)·라우팅을 건드리지 않음

## 성공 기준 (Acceptance Criteria)

- [ ] AC-1: `frontend/src/components/ui/scroll-area.tsx`가 추가되고, `frontend/src` 내 앱 코드에서 `overflow-x-auto`/`overflow-y-auto` 클래스 사용이 `select.tsx` 1곳을 제외하고 0건이다 — `grep -rE "overflow-(x|y)-auto" frontend/src`로 확인
- [ ] AC-2: 테이블 가로 스크롤 보존 — 1280px 뷰포트에서 `/transactions` 테이블이 정상 렌더되고, 콘텐츠가 넓을 때 가로 스크롤이 가능하다 — **/qa 단계에서** 브라우저 도구로 확인
- [ ] AC-3 (모바일 AC): 375px 뷰포트에서 `/`·`/transactions`·`/budgets`·`/assets`·`/settings` 모두 페이지 레벨 가로 스크롤·요소 겹침·잘림이 없고(`document.documentElement.scrollWidth === clientWidth`), 테이블은 ScrollArea 내부에서 가로 스크롤(스와이프/드래그)로 전체 열을 볼 수 있다 — **/qa 단계에서** 브라우저 도구로 확인
- [ ] AC-4: 세로 스크롤 목록 4곳(거래 가져오기 건너뜀 목록·이체 검토 목록, 대시보드 카테고리 상세, 자산 평가 이력)이 기존 `max-h` 제한을 유지한 채 ScrollArea로 스크롤된다 — **/qa 단계에서** 해당 다이얼로그를 열어 브라우저 도구로 확인 (데이터가 max-h를 초과하는 경우 스크롤 동작, 미만인 경우 불필요한 빈 공간 없음)
- [ ] AC-5: `SelectContent`(select.tsx)와 문서 레벨 페이지 스크롤은 변경되지 않는다 — `git diff`에 `select.tsx`·`AppLayout.tsx` 변경 없음으로 확인
- [ ] AC-6: `cd frontend && npm run build` 및 `npm run lint` 통과 — 명령 실행으로 확인

## Action Items

- [ ] `frontend/src/components/ui/scroll-area.tsx` 생성 — shadcn scroll-area 컴포넌트를 이 레포 컨벤션에 맞춰 추가: `radix-ui` 모놀리식 import 패턴(dialog.tsx:4 참조), `data-slot` 속성, `cn` 유틸 사용. `ScrollArea`(루트+Viewport)와 `ScrollBar`(orientation 지원) export
- [ ] `table.tsx`의 `Table` 래퍼 div(`overflow-x-auto`)를 ScrollArea + 가로 ScrollBar로 교체 — `relative w-full` 등 기존 레이아웃 클래스 의도 보존
- [ ] 페이지 4곳의 `overflow-y-auto` div를 ScrollArea로 교체 — 각각의 `max-h-*`·border·padding 등 시각적 거동 보존 (`pr-1` 같은 native 스크롤바 보정 여백의 유지/제거는 구현 재량)
- [ ] 375px·1280px에서 스모크 확인 후 /qa로 인계 (브라우저 E2E 채점은 /qa 담당)

## 미해결 질문

- **문서(body) 레벨 페이지 스크롤 포함 여부**: "앱 모든 native scroll"을 문자 그대로 해석하면 페이지 본문 스크롤도 대상이지만, 이는 `AppLayout`을 고정 높이 앱 셸(`h-screen` + 내부 ScrollArea)로 바꾸는 구조 변경이며 모바일 브라우저 기본 동작(주소창 축소, 당겨서 새로고침, 관성 스크롤)을 잃는다. **권고: 제외.** 사용자가 포함을 원하면 별도 작업으로 분리할 것 (/implement 시작 시 확인 권장)
- **`SelectContent` 포함 여부**: Radix Select의 스크롤 버튼 메커니즘과 충돌하므로 **권고: 제외** (shadcn 공식 구현과 동일한 판단). 사용자가 굳이 원하면 Radix 문서의 Select-in-ScrollArea 패턴 검토가 필요한 별도 작업
- ScrollArea `type` prop(기본 `hover` — 데스크톱에서 호버 시에만 스크롤바 표시) 사용 여부는 구현 재량. 단 모바일 터치 스크롤 동작에는 영향 없음이 확인되어야 함 (AC-3에서 채점)
