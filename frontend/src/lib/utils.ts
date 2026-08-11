import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * ResponsiveSidePanel 본문에 붙이는 스크롤 규칙.
 *
 * SEED BottomSheetBody는 `height: auto`라 스스로 스크롤하지 않는다 — 내용이 길면
 * 시트가 그만큼 자라 화면을 덮고 위쪽이 잘린 채 스크롤도 안 된다.
 * (SEED 문서도 긴 콘텐츠는 본문 안에서 maxHeight + overflow로 묶으라고 안내한다)
 *
 * 반대로 md 이상에서 쓰이는 SidePanelBody는 이미 스크롤 컨테이너이므로 제한을 풀어야 한다.
 * 안 풀면 패널 높이가 남는데도 짧은 스크롤 영역이 하나 더 생긴다.
 *
 * md(768px)는 Tailwind와 SEED가 같은 값이라 ResponsiveSidePanel의 전환 지점과 정확히 맞는다.
 */
export const panelBodyScroll =
  'max-h-[60dvh] overflow-y-auto md:max-h-none md:overflow-visible'

// 작은 버튼의 터치 히트 영역을 넓히는 유틸 클래스.
// SEED ActionButton은 size=small이 36px, size=medium+iconOnly가 40px로 44px 권장치에 못 미친다.
// 시각 크기는 그대로 두고 의사요소(after)로만 확장해 모바일 오탭을 줄인다.
// 인접 버튼 클러스터에서는 부모 gap을 넉넉히 둬 히트영역 중심이 겹치지 않게 한다.
export const touchTarget =
  "relative after:absolute after:-inset-x2 after:content-['']"
