import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// react-markdown 기본값은 raw HTML을 렌더하지 않는다(rehype-raw 미사용) — XSS 방지.
// 모바일(375px)에서 깨지지 않도록 긴 단어/코드블록은 줄바꿈·가로 스크롤로 흡수한다.
//
// 타이포는 SEED 스케일을 쓴다. 본문은 article-body(시맨틱 스타일 — 읽기용 긴 글에 쓰라고
// 정의된 것), 제목은 t5-bold/t4-bold, 보조 텍스트는 t3-*.
const components = {
  h1: ({ ...props }) => <h1 className="t5-bold mt-x3" {...props} />,
  h2: ({ ...props }) => <h2 className="t5-bold mt-x3" {...props} />,
  h3: ({ ...props }) => <h3 className="t4-bold mt-x2" {...props} />,
  p: ({ ...props }) => <p className="my-x2" {...props} />,
  ul: ({ ...props }) => <ul className="my-x2 list-disc space-y-(--dimension-x1) pl-x5" {...props} />,
  ol: ({ ...props }) => <ol className="my-x2 list-decimal space-y-(--dimension-x1) pl-x5" {...props} />,
  li: ({ ...props }) => <li {...props} />,
  strong: ({ ...props }) => <strong className="font-bold text-fg-neutral" {...props} />,
  a: ({ ...props }) => (
    <a
      className="text-fg-brand underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: ({ ...props }) => (
    <blockquote
      className="my-x2 border-l-2 border-stroke-neutral-weak pl-x3 text-fg-neutral-muted"
      {...props}
    />
  ),
  // 인라인 코드만 배경을 입히고, 블록 코드(pre > code)는 pre 측에서 배경을 빼 이중 배경을 막는다
  code: ({ ...props }) => (
    <code className="t3-regular rounded-r1 bg-bg-neutral-weak px-x1 py-x0_5" {...props} />
  ),
  pre: ({ ...props }) => (
    <pre
      className="t3-regular my-x2 overflow-x-auto rounded-r1 bg-bg-neutral-weak p-x3 [&>code]:bg-transparent [&>code]:p-0"
      {...props}
    />
  ),
  table: ({ ...props }) => (
    <div className="my-x2 overflow-x-auto">
      <table className="t3-regular w-full" {...props} />
    </div>
  ),
  th: ({ ...props }) => (
    <th className="border border-stroke-neutral-weak px-x2 py-x1 text-left" {...props} />
  ),
  td: ({ ...props }) => (
    <td className="border border-stroke-neutral-weak px-x2 py-x1" {...props} />
  ),
}

/** AI 리포트 등 마크다운 텍스트를 안전하게 렌더링한다. */
export function MarkdownView({ children }: { children: string }) {
  return (
    <div className="article-body break-words text-fg-neutral">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
