import type { KeyboardEvent } from "react";
import { memo, useCallback } from "react";
import type { ReviewComment } from "../types";

interface Props {
  comment: ReviewComment;
  onSend: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}

function CommentCardInner({ comment, onSend, onDelete, onRetry }: Props) {
  const handleKeyDown = useCallback(
    (action: () => void) => (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        action();
      }
    },
    [],
  );

  return (
    <li
      className={`rounded-xl border p-3 text-sm transition-all ${
        comment.sent
          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
          : comment.error
            ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
            : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      }`}
    >
      <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mb-1 truncate">
        &ldquo;{comment.quote.slice(0, 50)}
        {comment.quote.length > 50 ? "…" : ""}&rdquo;
      </div>
      <div className="text-gray-800 dark:text-gray-200 mb-2 leading-snug">{comment.comment}</div>
      <div className="flex items-center gap-2">
        {comment.sent ? (
          <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
            ✓ Sent to agent
          </span>
        ) : comment.error ? (
          <button
            type="button"
            onClick={() => onRetry(comment.id)}
            onKeyDown={handleKeyDown(() => onRetry(comment.id))}
            aria-label="Retry sending comment"
            className="text-xs px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors font-medium"
          >
            Failed — Retry
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSend(comment.id)}
            onKeyDown={handleKeyDown(() => onSend(comment.id))}
            aria-label="Send comment to agent"
            className="text-xs px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors font-medium"
          >
            Send to Agent
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(comment.id)}
          onKeyDown={handleKeyDown(() => onDelete(comment.id))}
          aria-label="Delete comment"
          className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-auto"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

export const CommentCard = memo(CommentCardInner);
