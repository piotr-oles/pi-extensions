import { useCallback, useEffect, useRef, useState } from "react";
import { sendComments } from "../api";
import type { ReviewComment } from "../types";

function storageKey(filePath: string): string {
  return `review-comments:${filePath}`;
}

function load(filePath: string): ReviewComment[] {
  try {
    const raw = localStorage.getItem(storageKey(filePath));
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as ReviewComment[];
  } catch {
    return [];
  }
}

function save(filePath: string, comments: ReviewComment[]): void {
  try {
    localStorage.setItem(storageKey(filePath), JSON.stringify(comments));
  } catch {
    // quota exceeded — ignore
  }
}

export function useComments(filePath: string) {
  const [comments, setComments] = useState<ReviewComment[]>(() => load(filePath));
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setComments(load(filePath));
  }, [filePath]);

  useEffect(() => {
    save(filePath, comments);
  }, [filePath, comments]);

  const addComment = useCallback((quote: string, commentText: string) => {
    const next: ReviewComment = {
      id: crypto.randomUUID(),
      quote,
      comment: commentText,
      timestamp: new Date().toISOString(),
      sent: false,
      error: false,
    };
    setComments((prev) => [next, ...prev]);
  }, []);

  const deleteComment = useCallback((id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const sendOne = useCallback(
    async (id: string) => {
      const comment = comments.find((c) => c.id === id);
      if (!comment) {
        return;
      }
      try {
        await sendComments(filePath, [comment]);
        setComments((prev) =>
          prev.map((c) => (c.id === id ? { ...c, sent: true, error: false } : c)),
        );
      } catch {
        setComments((prev) =>
          prev.map((c) => (c.id === id ? { ...c, sent: false, error: true } : c)),
        );
      }
    },
    [filePath, comments],
  );

  const sendAll = useCallback(async () => {
    const unsent = comments.filter((c) => !c.sent);
    if (unsent.length === 0) {
      return;
    }
    const unsentIds = new Set(unsent.map((c) => c.id));
    try {
      await sendComments(filePath, unsent);
      setComments((prev) =>
        prev.map((c) => (unsentIds.has(c.id) ? { ...c, sent: true, error: false } : c)),
      );
    } catch {
      setComments((prev) =>
        prev.map((c) => (unsentIds.has(c.id) ? { ...c, sent: false, error: true } : c)),
      );
    }
  }, [filePath, comments]);

  return { comments, addComment, deleteComment, sendOne, sendAll };
}
