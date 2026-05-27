/**
 * Fence comment detection.
 *
 * A comment is a "fence" when its inner text (after stripping comment markers)
 * contains at least 3 separator characters AND those separators make up ≥ 50%
 * of the non-whitespace characters.
 *
 * Separator characters: - = * # ~ _ ^ + |
 *
 * Examples flagged as fences:
 *   // ---- section ----
 *   // ===== Auth Module =====
 *   // *** helpers ***
 *   # ################
 *   /* ~~~ helpers ~~~ * /
 *   // ________________
 *
 * Examples NOT flagged (meaningful text dominates):
 *   // --- NOTE: this is important ---    (23% separators)
 *   // TODO: fix this
 *   // Copyright (c) 2024
 *   // https://example.com
 */

const SEPARATOR_RE = /[-=*#~_^+|]/g;

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
  const inner = stripMarkers(rawText);
  if (inner.length < 3) return false;

  const separators = (inner.match(SEPARATOR_RE) ?? []).length;
  if (separators < 3) return false;

  const nonSpace = inner.replace(/\s/g, "").length;
  if (nonSpace === 0) return false;

  // 40% threshold: catches `/* ~~~ helpers ~~~ */` (46%) while rejecting
  // `// --- NOTE: this is important ---` (23%) and similar meaningful text.
  return separators / nonSpace >= 0.4;
}
