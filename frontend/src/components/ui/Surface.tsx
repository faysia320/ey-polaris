/*
 * 앱 전역에서 콘텐츠를 담는 카드 표면.
 *
 * SEED는 모바일 앱 디자인 시스템이라 대응 컴포넌트가 없다 — 화면마다
 * `rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default`를 손으로 반복하면
 * 곧 패딩이 제각각으로 갈리므로 여기 한 곳에 모은다.
 *
 * 텍스트 색은 얹지 않는다. `index.css`의 body가 이미 `text-fg-neutral`을 상속시키므로
 * 표면마다 같은 값을 다시 선언하면 "여기서 색을 바꾼다"는 신호로 읽혀 오해를 부른다.
 * 다른 색이 필요한 자리는 그 자리에서 역할 토큰을 직접 쓴다.
 */
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * 테두리를 그릴지 여부 (기본 `true`).
   * `false`면 배경 톤만으로 영역을 구분한다.
   */
  bordered?: boolean
  /**
   * 내부 패딩(`p-x5`) 적용 여부.
   * 표를 가장자리까지 붙이고 표면 안에서 스크롤시킬 때만 끈다.
   */
  padded?: boolean
}

export function Surface({ className, bordered = true, padded = true, ...props }: SurfaceProps) {
  return (
    <div
      className={cn(
        'rounded-r2 bg-bg-layer-default',
        bordered && 'border border-stroke-neutral-weak',
        padded && 'p-x5',
        className,
      )}
      {...props}
    />
  )
}
