import type { CommentNode } from "./types.js";

/** Stable key for a comment node: combines text and line so moved/copied fences are treated as new. */
export function getCommentHash(c: CommentNode): string {
  return `${c.text}:::${c.startLine}`;
}
