import { useCallback, useRef, useState } from "react";
import { CommentSidebar } from "./components/CommentSidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import MarkdownRenderer from "./components/MarkdownRenderer";
import { SelectionToolbar } from "./components/SelectionToolbar";
import { useComments } from "./hooks/useComments";
import { useMarkdown } from "./hooks/useMarkdown";
import { useSelection } from "./hooks/useSelection";
import { useTextHighlighter } from "./hooks/useTextHighlighter";
import type { SelectionInfo } from "./types";

const fileParam = new URLSearchParams(window.location.search).get("file");

export default function App() {
  const file = fileParam;
  const filePath = file ?? "sample.md";

  const { markdown, loading, error: markdownError } = useMarkdown(file);
  const { comments, addComment, deleteComment, sendOne, sendAll } = useComments(filePath);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useTextHighlighter(contentRef, comments);

  const handleSelect = useCallback((info: SelectionInfo | null) => {
    setSelection(info);
  }, []);

  const { handleMouseUp } = useSelection(containerRef, handleSelect);

  const handleAddComment = useCallback(
    (text: string) => {
      if (!selection) {
        return;
      }
      addComment(selection.quote, text);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    },
    [selection, addComment],
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            <span aria-hidden="true">📄</span> Markdown Reviewer
          </span>
        </div>
        <div className="ml-auto">
          <span className="text-xs text-gray-400">Select text to comment</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main
          aria-label="Document"
          className="flex-1 overflow-y-auto px-8 py-8 relative"
          ref={containerRef}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: text-selection container; keyboard selection is handled natively by the browser */}
          <div
            className="h-full"
            role="presentation"
            onMouseUp={handleMouseUp}
            onMouseDown={() => setSelection(null)}
          >
            {loading && (
              <div
                className="flex justify-center py-12"
                role="status"
                aria-label="Loading document"
              >
                <span className="text-gray-400 animate-pulse">Loading…</span>
              </div>
            )}
            {markdownError && (
              <div
                role="alert"
                className="mx-auto max-w-3xl p-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm"
              >
                {markdownError}
              </div>
            )}
            {!loading && !markdownError && (
              <div className="max-w-3xl mx-auto">
                <ErrorBoundary>
                  <MarkdownRenderer markdown={markdown} contentRef={contentRef} />
                </ErrorBoundary>
              </div>
            )}

            {selection && (
              <SelectionToolbar
                info={selection}
                onAdd={handleAddComment}
                onDismiss={() => setSelection(null)}
              />
            )}
          </div>
        </main>

        <CommentSidebar
          comments={comments}
          onSend={sendOne}
          onDelete={deleteComment}
          onRetry={sendOne}
          onSendAll={sendAll}
        />
      </div>
    </div>
  );
}
