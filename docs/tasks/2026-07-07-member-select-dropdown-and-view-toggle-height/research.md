# Research: 구성원 Select 드롭다운 위치 및 테이블/캘린더 토글 높이 정렬

- 날짜: 2026-07-07
- 요청 원문: 앱에 사용중인 구성원 select의 ddl이 생성되는 위치가 이상해. select 아래로 생성되도록 수정해줘. 지출/수입내역의 테이블|캘린더 라디오 버튼의 높이가 select 높이와 동일하도록 수정해줘

## 요약
두 가지 UI 결함이다. (1) 공용 `SelectContent`의 기본 위치 모드가 `item-aligned`로 설정되어 있어(`select.tsx:63`), 드롭다운 목록(DDL)이 트리거 아래가 아니라 선택된 항목을 트리거 위에 겹쳐 정렬하는 방식으로 뜬다. 이 때문에 목록이 트리거를 덮거나 위쪽에 생성되어 "위치가 이상"하게 보인다. 앱의 모든 Select가 `position`을 명시하지 않아 이 기본값을 공유하므로, 기본값을 shadcn 표준인 `popper`(+ side=bottom, sideOffset)로 바꾸면 모든 Select 드롭다운이 트리거 아래로 뜬다. (2) 지출/수입 내역 페이지의 테이블/캘린더 뷰 토글은 `border + p-0.5` 컨테이너 안에 `size="sm"`(h-7 = 28px) 버튼을 담아 총 렌더 높이가 약 34px인 반면, 같은 헤더 줄의 `MemberFilterSelect` 트리거는 `h-8`(32px)이라 높이가 어긋난다. 토글 그룹의 렌더 높이를 32px로 맞추면 정렬된다.

## 관련 파일 및 근거
- `frontend/src/components/ui/select.tsx:63` — `SelectContent`의 `position = "item-aligned"` 기본값. DDL이 트리거 아래가 아닌 겹침/위쪽으로 뜨는 직접 원인.
- `frontend/src/components/ui/select.tsx:71` — `data-align-trigger={position === "item-aligned"}` — 기본값 변경 시 이 파생 속성 및 line 72의 `data-[align-trigger=true]:animate-none` 애니메이션 처리에도 영향.
- `frontend/src/components/ui/select.tsx:72,81-82` — 이미 `position === "popper"`용 translate 클래스(`data-[side=bottom]:translate-y-1` 등)와 뷰포트 크기 클래스가 존재. popper로 전환 시 재사용 가능. 단 `sideOffset`은 현재 미지정.
- `frontend/src/components/members/MemberFilterSelect.tsx:29` — `<SelectTrigger className="w-32">` (size 미지정 → 기본 `data-[size=default]:h-8` = 32px). 토글이 맞춰야 할 기준 높이.
- `frontend/src/pages/TransactionsPage.tsx:449-464` — 테이블/캘린더 토글 그룹. 컨테이너 `flex rounded-lg border p-0.5` + 두 개의 `<Button size="sm">`(h-7). MemberFilterSelect와 같은 헤더 줄(`TransactionsPage.tsx:447` `flex flex-wrap items-center gap-2`)에 나란히 배치됨.
- `frontend/src/components/ui/button.tsx:26-27` — `size="sm"`은 `h-7`(28px), 기본 size는 `h-8`(32px). 토글 버튼이 sm이라 컨테이너 높이가 select보다 큼(border+padding 포함 시 약 34px).
- `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/TransactionsPage.tsx` — `SelectContent`를 다수 사용(총 46개 사용처, 4개 파일)하나 어느 곳도 `position`을 명시하지 않음(`grep` 확인). 따라서 기본값 변경은 앱 전역 Select에 일괄 적용됨.

## 영향도
- **select.tsx 기본값 변경(전역)**: `SelectContent`의 `position` 기본값을 바꾸면 앱 내 모든 Select 드롭다운의 위치 동작이 바뀐다. 이는 요청의 의도("앱에 사용중인 구성원 select" 및 동일 컴포넌트를 쓰는 모든 Select)와 일치한다. 부작용 후보: (a) `item-aligned` 전용으로 남아 있던 애니메이션 분기(`data-[align-trigger=true]:animate-none`, `select.tsx:72`)가 더 이상 트리거되지 않아 open 애니메이션이 popper용(`slide-in`/`zoom-in`)으로 적용됨 — 시각적 회귀 확인 필요. (b) 좁은 `w-28`/`w-32` 트리거(예: 이체 검토 Select `TransactionsPage.tsx:1011`)에서 popper의 `min-w-(--radix-select-trigger-width)`로 목록 최소 너비가 트리거 폭에 맞춰지는지 확인.
- **토글 높이 변경(국소)**: `TransactionsPage.tsx:449-464`만 수정. 다른 페이지·컴포넌트에 영향 없음. 단 같은 줄의 `엑셀 업로드`/`거래 추가` 버튼(기본 h-8)과도 시각적으로 일관되게 유지되는지 함께 확인.

## 성공 기준 (Acceptance Criteria)
- [ ] AC-1: 구성원 필터 Select(및 앱 내 다른 Select들)를 열면 드롭다운 목록이 트리거를 덮지 않고 트리거 **바로 아래(side=bottom)**에 표시된다 — /qa 단계에서 브라우저 도구로 지출/수입 내역 페이지의 구성원 Select를 열어 목록의 상단 y좌표가 트리거 하단 y좌표보다 아래임을 육안/스크린샷으로 확인. (공간 부족으로 Radix가 위로 뒤집는 경우는 정상 동작으로 예외)
- [ ] AC-2: `select.tsx`에서 `SelectContent` 기본 `position`이 `popper`로 설정되고, 앱의 어떤 사용처도 이 동작을 얻기 위해 개별 수정이 필요하지 않다 — 코드에서 `position` 기본값 확인 및 `npm run build`(tsc+vite) 통과로 확인.
- [ ] AC-3: 지출/수입 내역 페이지 헤더의 테이블/캘린더 토글 그룹의 렌더 높이가 같은 줄 `MemberFilterSelect` 트리거 높이(32px, h-8)와 동일하다 — /qa 단계에서 브라우저 도구로 두 요소의 `getBoundingClientRect().height`(또는 offsetHeight)를 비교해 동일(±1px)함을 확인.
- [ ] AC-4 (모바일): 375px 뷰포트에서 지출/수입 내역 페이지 헤더 줄에 가로 스크롤·요소 겹침·잘림이 없고, 드롭다운 열림 시에도 목록이 화면을 벗어나 잘리지 않는다 — /qa 단계에서 브라우저 도구를 375px로 리사이즈해 확인.
- [ ] AC-5: 기존 Select 기능(값 선택, 선택값 표시, 스크롤 버튼)이 회귀 없이 동작한다 — /qa 단계에서 구성원 필터에서 항목 하나를 선택해 트리거에 반영되고 목록이 정상 닫힘을 확인.

## Action Items
- [ ] `select.tsx`의 `SelectContent` 기본 `position`을 `item-aligned` → `popper`로 변경하고, 트리거와의 간격을 위해 `sideOffset`(예: 4) 지정 여부를 결정한다. `align` 기본값 및 `data-align-trigger`/애니메이션 분기 클래스가 popper 기본에서 어색하지 않은지 함께 정리한다(구현 재량).
- [ ] popper 전환 후 좁은 트리거(w-28/w-32)에서 목록 너비·정렬이 자연스러운지 확인하고 필요 시 `align="start"` 등 조정(구현 재량).
- [ ] `TransactionsPage.tsx:449-464` 토글 그룹의 렌더 높이를 32px(select와 동일)로 맞춘다. 컨테이너 padding/border와 버튼 `size`를 함께 고려해 총 높이가 h-8과 일치하도록 조정(예: 컨테이너에 고정 높이 부여 후 버튼을 채우거나, 버튼 높이·padding 재조정 — 구현 재량).
- [ ] `npm run build`로 타입/빌드 검증.

## 미해결 질문
- 없음. (구현 세부 — sideOffset 값, 토글 높이를 맞추는 정확한 방식 — 은 위 AC의 관찰 가능한 계약을 충족하는 선에서 구현 재량으로 남김.)
