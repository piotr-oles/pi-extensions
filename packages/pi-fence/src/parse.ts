export interface CommentNode {
  /** Raw comment text including markers (e.g. `// ---- section ----`). */
  text: string;
  /** 1-indexed line number. */
  startLine: number;
  /** 0-indexed column. */
  startCol: number;
  /** 1-indexed end line (inclusive). */
  endLine: number;
  /** 0-indexed end column (exclusive — first column after the comment). */
  endCol: number;
}

/** Stable key for a comment node: combines text and line so moved/copied fences are treated as new. */
export function getCommentHash(c: CommentNode): string {
  return `${c.text}:::${c.startLine}`;
}
