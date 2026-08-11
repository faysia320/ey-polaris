import { useBreakpoint } from '@seed-design/react'

/**
 * 툴바에서 필드와 나란히 서는 ActionButton의 size.
 *
 * SEED의 필드(Select·FieldButton·TextField)와 ActionButton은 같은 높이 사다리를 쓴다 —
 * large = 52px(x13), medium = 40px(x10). 그런데 필드에만 `responsive`가 있고
 * ActionButton에는 없어서, 필드를 responsive로 두면 같은 줄의 버튼만 높이가 어긋난다.
 *
 * 이 훅이 필드의 `responsive`와 같은 경계(SEED lg = 1280px)로 버튼 size를 골라 준다.
 * 필드 옆에 서지 않는 버튼(표 안의 행 액션 등)은 그대로 small을 쓰면 된다.
 */
export function useFieldSize(): 'large' | 'medium' {
  const breakpoint = useBreakpoint()
  return breakpoint === 'lg' || breakpoint === 'xl' ? 'medium' : 'large'
}
