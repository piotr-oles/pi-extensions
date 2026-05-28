/**
 * Fence comment detection.
 *
 * A comment is a "fence" when its inner text (after stripping comment markers)
 * contains a sequence of 3 or more consecutive separator characters.
 *
 * Separator characters: ASCII  - = * # ~ _ ^ + |
 *                        Unicode \u2500-\u257F (box-drawing block: ─ ━ │ ═ ║ …)
 *
 * Examples flagged as fences:
 *   // ---- section ----
 *   // ===== Auth Module =====
 *   // --- NOTE: this is important ---   ← use // NOTE: this is important instead
 *   // --- start of function ---
 *   # ################
 *   /* ~~~ helpers ~~~ * /
 *   // ─────────────────────            ← Unicode box-drawing
 *   // ━━━ section ━━━
 *
 * Examples NOT flagged (no 3-consecutive separator sequence):
 *   // TODO: fix this
 *   // Copyright (c) 2024
 *   // https://example.com
 *   // fix the off-by-one error          ← single dashes in words
 */

import type { LanguageDefinition } from "./languages/index.js";
import type { CommentNode } from "./types.js";

// ASCII separators + Unicode box-drawing block (U+2500–U+257F: ─ ━ │ ═ ║ ┌ ┐ └ ┘ …)
const FENCE_SEQUENCE_RE = /[-=*#~_^+|\u2500-\u257F]{3,}/u;

/**
 * Strip leading comment markers and surrounding whitespace from a raw comment.
 * Only one prefix marker is stripped (the first one that matches), preventing
 * double-stripping on inputs like `// ###` where `#` would otherwise be
 * consumed as a second marker.
 */
export function stripMarkers(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("//")) {
    return t.replace(/^\/\/\s?/, "").trim();
  }
  if (t.startsWith("#")) {
    return t.replace(/^#\s?/, "").trim();
  }
  // Block comment: strip /* ... */
  return t
    .replace(/^\/\*+\s?/, "")
    .replace(/\s?\*+\/$/, "")
    .replace(/^\*+\s?/, "")
    .trim();
}

/**
 * Returns true if the raw comment text is a decorative fence/divider comment.
 * The rawText should be the full text of the comment node as returned by tree-sitter
 * (including comment markers like `//`, `#`, `/* ... * /`).
 */
export function isFenceComment(rawText: string): boolean {
  return FENCE_SEQUENCE_RE.test(stripMarkers(rawText));
}

export async function getFenceComments(
  content: string,
  def: LanguageDefinition,
  signal?: AbortSignal,
): Promise<CommentNode[]> {
  if (signal?.aborted) {
    return [];
  }
  const nodes = await def.extractCommentNodes(content, signal);
  return nodes.filter((c) => isFenceComment(c.text));
}

export function removeFenceComments(content: string, nodes: CommentNode[]): string {
  if (nodes.length === 0) {
    return content;
  }

  const lines = content.split("\n");

  // Descending by startLine then startCol keeps earlier splices from
  // shifting the indices of nodes we haven't processed yet.
  const sorted = [...nodes].sort((a, b) => b.startLine - a.startLine || b.startCol - a.startCol);

  for (const node of sorted) {
    const startIdx = node.startLine;
    const endIdx = node.endLine;
    if (startIdx < 0 || startIdx >= lines.length) {
      continue;
    }

    const beforeComment = lines[startIdx].slice(0, node.startCol);
    const isStandalone = beforeComment.trim() === "";

    if (isStandalone) {
      // Remove every line the comment spans (single-line or block).
      lines.splice(startIdx, endIdx - startIdx + 1);
    } else {
      // Inline: keep the code that precedes the comment on the first line.
      // For multi-line block comments also drop the intermediate/last lines.
      const afterComment = (lines[endIdx] ?? "").slice(node.endCol);
      if (endIdx > startIdx) {
        lines.splice(startIdx + 1, endIdx - startIdx);
      }
      lines[startIdx] = (beforeComment.trimEnd() + afterComment).trimEnd();
    }
  }

  return lines.join("\n");
}
