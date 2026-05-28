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

export interface FencesFinding {
  /** Relative path to the file containing the fences. */
  path: string;
  /** Fences found in the file. */
  fences: CommentNode[];
}
