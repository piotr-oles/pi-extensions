import type { ReviewComment } from "./types";

export async function fetchContent(_file: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch("/api/content", { signal });
  if (!res.ok) {
    throw new Error(`Failed to load file: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { content: string };
  return data.content;
}

export async function sendComments(file: string, comments: ReviewComment[]): Promise<void> {
  const payload = {
    file,
    comments: comments.map((c) => ({
      quote: c.quote,
      comment: c.comment,
      timestamp: c.timestamp,
    })),
  };
  const res = await fetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to send comments: ${res.status} ${res.statusText}`);
  }
}
