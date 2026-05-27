import type { CommentNode } from "./parse.js";

export interface Finding {
  relativePath: string;
  fences: CommentNode[];
}
