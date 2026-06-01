import type { ReviewComment } from "../types";
import { CommentCard } from "./CommentCard";

interface Props {
  comments: ReviewComment[];
  onSend: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onSendAll: () => void;
}

export function CommentSidebar({ comments, onSend, onDelete, onRetry, onSendAll }: Props) {
  const unsentCount = comments.filter((c) => !c.sent).length;

  return (
    <aside
      aria-label="Review comments"
      className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col"
    >
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <span className="font-medium text-sm text-gray-700 dark:text-gray-300">Comments</span>
        {comments.length > 0 && (
          <span
            role="status"
            className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full"
            aria-label={`${comments.length} comment${comments.length === 1 ? "" : "s"}`}
          >
            {comments.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-600 gap-3">
            <span className="text-4xl" aria-hidden="true">
              💬
            </span>
            <p className="text-sm">Select text in the document to add a comment.</p>
            <p className="text-xs">Comments can be sent to the Pi agent with one click.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {comments.map((c) => (
              <CommentCard
                key={c.id}
                comment={c}
                onSend={onSend}
                onDelete={onDelete}
                onRetry={onRetry}
              />
            ))}
          </ul>
        )}
      </div>

      {unsentCount > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-800 p-3">
          <button
            type="button"
            onClick={onSendAll}
            aria-label={`Send all ${unsentCount} unsent comment${unsentCount === 1 ? "" : "s"} to agent`}
            className="w-full text-sm px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors font-medium"
          >
            Send all ({unsentCount}) to Agent
          </button>
        </div>
      )}
    </aside>
  );
}
