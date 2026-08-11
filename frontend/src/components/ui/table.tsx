/*
 * 데이터 표.
 *
 * SEED는 모바일 앱 디자인 시스템이라 표 컴포넌트가 없다 — 웹 대시보드에 필요한
 * 이 셸만 직접 유지하고, 색·간격·타이포는 전부 SEED 토큰으로 그린다.
 * 정렬·페이지네이션 같은 동작은 호출부의 @tanstack/react-table이 담당한다.
 *
 * 가로 스크롤은 네이티브 overflow-x로 처리한다. 이전에는 shadcn ScrollArea로 감쌌지만
 * 커스텀 스크롤바를 위해 DOM을 한 겹 더 두는 값에 비해 얻는 게 없다.
 */
import * as React from 'react'

import { cn } from '@/lib/utils'

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    // 모바일(375px)에서 페이지 전체가 밀리지 않도록 표만 가로로 스크롤시킨다
    <div data-slot="table-container" className="w-full overflow-x-auto">
      <table data-slot="table" className={cn('t4-regular w-full caption-bottom', className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b [&_tr]:border-stroke-neutral-weak', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'border-t border-stroke-neutral-weak bg-bg-neutral-weak font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-stroke-neutral-weak transition-colors hover:bg-bg-layer-default-pressed has-aria-expanded:bg-bg-layer-default-pressed data-[state=selected]:bg-bg-neutral-weak',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        't3-bold h-x10 whitespace-nowrap px-x2 text-left align-middle text-fg-neutral-muted [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('whitespace-nowrap p-x2 align-middle [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('t4-regular mt-x4 text-fg-neutral-muted', className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
