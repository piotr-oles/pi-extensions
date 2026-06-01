import { useCallback, useEffect, useRef, useState } from "react";
import type { SelectionInfo } from "../types";

interface Props {
  info: SelectionInfo;
  onAdd: (text: string) => void;
  onDismiss: () => void;
}

export function SelectionToolbar({ info, onAdd, onDismiss }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && value.trim()) {
        e.preventDefault();
        onAdd(value.trim());
        setValue("");
      }
      if (e.key === "Escape") {
        onDismiss();
      }
    },
    [value, onAdd, onDismiss],
  );

  const handleSubmit = useCallback(() => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
  }, [value, onAdd]);

  return (
    <div
      role="dialog"
      aria-label="Add comment"
      aria-modal="true"
      className="absolute z-50 shadow-xl rounded-xl border border-blue-200 bg-white dark:bg-gray-900 dark:border-gray-700 overflow-hidden"
      style={{
        top: info.rect.bottom + 6,
        left: Math.max(8, info.rect.left),
        minWidth: 320,
        maxWidth: 420,
      }}
    >
      <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950 border-b border-blue-100 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300 font-medium truncate">
        <span aria-hidden="true">💬</span> Comment on:{" "}
        <em>
          &ldquo;
          {info.quote.slice(0, 60)}
          {info.quote.length > 60 ? "…" : ""}
          &rdquo;
        </em>
      </div>
      <div className="p-2 flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment… (Enter to save, Shift+Enter for newline, Esc to cancel)"
          aria-label="Comment text"
          className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim()}
            aria-label="Save comment"
            className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40 transition-colors font-medium"
          >
            Add
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cancel"
            className="px-3 py-1.5 text-sm rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
