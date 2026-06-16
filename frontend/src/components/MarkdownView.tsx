import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// react-markdown 기본값은 raw HTML을 렌더하지 않는다(rehype-raw 미사용) — XSS 방지.
// 모바일(375px)에서 깨지지 않도록 긴 단어/코드블록은 줄바꿈·가로 스크롤로 흡수한다.
const components = {
  h1: ({ ...props }) => <h1 className="mt-3 text-base font-semibold" {...props} />,
  h2: ({ ...props }) => <h2 className="mt-3 text-base font-semibold" {...props} />,
  h3: ({ ...props }) => <h3 className="mt-2 text-sm font-semibold" {...props} />,
  p: ({ ...props }) => <p className="my-2 leading-relaxed" {...props} />,
  ul: ({ ...props }) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
  ol: ({ ...props }) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
  li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
  strong: ({ ...props }) => <strong className="font-semibold text-foreground" {...props} />,
  a: ({ ...props }) => (
    <a
      className="text-primary underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: ({ ...props }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground" {...props} />
  ),
  // 인라인 코드만 배경을 입히고, 블록 코드(pre > code)는 pre 측에서 배경을 빼 이중 배경을 막는다
  code: ({ ...props }) => (
    <code className="rounded bg-muted px-1 py-0.5 text-xs" {...props} />
  ),
  pre: ({ ...props }) => (
    <pre
      className="my-2 overflow-x-auto rounded bg-muted p-3 text-xs [&>code]:bg-transparent [&>code]:p-0"
      {...props}
    />
  ),
  table: ({ ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full text-xs" {...props} />
    </div>
  ),
  th: ({ ...props }) => <th className="border border-border px-2 py-1 text-left" {...props} />,
  td: ({ ...props }) => <td className="border border-border px-2 py-1" {...props} />,
}

/** AI 리포트 등 마크다운 텍스트를 안전하게 렌더링한다. */
export function MarkdownView({ children }: { children: string }) {
  return (
    <div className="break-words text-sm text-foreground/90">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
