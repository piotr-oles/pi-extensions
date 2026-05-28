export interface EditRange {
  /** 0-indexed first line of newText in the patched content. */
  startLine: number;
  /** 0-indexed last line of newText in the patched content (inclusive). */
  endLine: number;
}

/**
 * Apply a list of edits to base content, returning the patched string and the
 * line range (0-indexed, inclusive) each edit's newText occupies in it.
 *
 * All edits are matched against the original base content (not sequentially),
 * mirroring the pi edit tool's semantics. Replacements are then applied in
 * reverse positional order so earlier character indices remain stable.
 * Edits whose oldText is not found in base are skipped gracefully and their
 * editRange is left as { startLine: 0, endLine: 0 }.
 */
export function applyEdits(
  base: string,
  edits: { oldText: string; newText: string }[],
): { content: string; editRanges: EditRange[] } {
  const editRanges: EditRange[] = edits.map(() => ({ startLine: 0, endLine: 0 }));

  const matched = edits
    .map((edit, i) => {
      const charIdx = base.indexOf(edit.oldText);
      if (charIdx === -1) {
        return null;
      }
      const lineIdx = base.slice(0, charIdx).split("\n").length - 1;
      return { i, charIdx, lineIdx, edit };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.charIdx - b.charIdx);

  // Forward pass: compute each edit's start line in the patched content,
  // accounting for line-count changes introduced by earlier edits in the file.
  let accLineDelta = 0;
  for (const m of matched) {
    const startLine = m.lineIdx + accLineDelta;
    const newLineCount = m.edit.newText.split("\n").length;
    const oldLineCount = m.edit.oldText.split("\n").length;
    editRanges[m.i] = { startLine, endLine: startLine + newLineCount - 1 };
    accLineDelta += newLineCount - oldLineCount;
  }

  // Reverse pass: apply replacements so each splice doesn't shift the indices
  // of subsequent (earlier-in-file) replacements.
  let content = base;
  for (let k = matched.length - 1; k >= 0; k--) {
    const { charIdx, edit } = matched[k];
    content =
      content.slice(0, charIdx) + edit.newText + content.slice(charIdx + edit.oldText.length);
  }

  return { content, editRanges };
}
