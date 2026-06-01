import type { RefObject } from "react";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface Props {
  markdown: string;
  contentRef: RefObject<HTMLDivElement | null>;
}

function MarkdownRenderer({ markdown, contentRef }: Props) {
  return (
    <div ref={contentRef} role="document">
      <article className="prose prose-slate dark:prose-invert max-w-none prose-pre:bg-gray-900 prose-pre:rounded-xl">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}

export default memo(MarkdownRenderer, (prev, next) => {
  return prev.markdown === next.markdown && prev.contentRef === next.contentRef;
});
