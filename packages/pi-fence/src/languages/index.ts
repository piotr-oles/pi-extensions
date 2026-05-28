import { extname } from "node:path";
import type { CommentNode } from "../types.js";
import { bash } from "./bash.js";
import { c } from "./c.js";
import { css } from "./css.js";
import { go } from "./go.js";
import { java } from "./java.js";
import { javascript } from "./javascript.js";
import { python } from "./python.js";
import { ruby } from "./ruby.js";
import { rust } from "./rust.js";
import { typescript, typescriptTsx } from "./typescript.js";

export interface LanguageDefinition {
  supportedExtensions: string[];
  extractCommentNodes(content: string, signal?: AbortSignal): Promise<CommentNode[]>;
}

const LANGUAGES: LanguageDefinition[] = [
  typescript,
  typescriptTsx,
  javascript,
  python,
  go,
  rust,
  ruby,
  java,
  bash,
  c,
  css,
];

const EXT_MAP = new Map<string, LanguageDefinition>();
for (const def of LANGUAGES) {
  for (const ext of def.supportedExtensions) {
    EXT_MAP.set(ext, def);
  }
}

export function getLanguageDefinition(filePath: string): LanguageDefinition | undefined {
  const ext = extname(filePath).replace(/^\./, "").toLowerCase();
  return EXT_MAP.get(ext);
}
