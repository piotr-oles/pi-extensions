/**
 * Fence comment detection.
 *
 * A comment is a "fence" when its inner text (after stripping comment markers)
 * contains a sequence of 3 or more consecutive separator characters.
 *
 * Separator characters: - = * # ~ _ ^ + |
 *
 * Examples flagged as fences:
 *   // ---- section ----
 *   // ===== Auth Module =====
 *   // --- NOTE: this is important ---   ← use // NOTE: this is important instead
 *   // --- start of function ---
 *   # ################
 *   /* ~~~ helpers ~~~ * /
 *
 * Examples NOT flagged (no 3-consecutive separator sequence):
 *   // TODO: fix this
 *   // Copyright (c) 2024
 *   // https://example.com
 *   // fix the off-by-one error          ← single dashes in words
 */

const FENCE_SEQUENCE_RE = /[-=*#~_^+|]{3,}/;

/**
 * Strip leading comment markers and surrounding whitespace from a raw comment.
 * Only one prefix marker is stripped (the first one that matches), preventing
 * double-stripping on inputs like `// ###` where `#` would otherwise be
 * consumed as a second marker.
 */
export function stripMarkers(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("//")) return t.replace(/^\/\/\s?/, "").trim();
  if (t.startsWith("#")) return t.replace(/^#\s?/, "").trim();
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
