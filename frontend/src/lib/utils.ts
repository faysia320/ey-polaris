import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 작은 아이콘 버튼(icon-sm=28px 등)의 터치 히트 영역을 44px로 넓히는 유틸 클래스.
// 시각 크기는 그대로 두고 의사요소(after)로만 확장해 모바일 오탭을 줄인다.
// 인접 버튼 클러스터에서는 부모 gap을 넉넉히 둬 히트영역 중심이 겹치지 않게 한다.
export const touchTarget =
  "relative after:absolute after:-inset-2 after:content-['']"
