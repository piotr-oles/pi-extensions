import { describe, expect, it } from "vitest";
import {
  buildBlockReason,
  buildFindingLines,
  buildRemoveText,
  buildWarnText,
  formatFinding,
} from "../messages.js";
import type { CommentNode } from "../parse.js";
import type { Finding } from "../types.js";

function node(text: string, startLine: number, startCol = 0): CommentNode {
  return { text, startLine, startCol, endLine: startLine, endCol: startCol + text.length };
}

function finding(relativePath: string, fences: CommentNode[]): Finding {
  return { relativePath, fences };
}

describe("formatFinding", () => {
  it("formats line and col (1-indexed) with trimmed text", () => {
    expect(formatFinding(node("// ---- section ----", 3, 0))).toMatchInlineSnapshot(
      `"    line 3, col 1: // ---- section ----"`,
    );
  });

  it("adjusts col to 1-indexed", () => {
    expect(formatFinding(node("// ===", 10, 4))).toMatchInlineSnapshot(
      `"    line 10, col 5: // ==="`,
    );
  });

  it("trims surrounding whitespace from the comment text", () => {
    expect(formatFinding(node("  // --- trim me ---  ", 1))).toMatchInlineSnapshot(
      `"    line 1, col 1: // --- trim me ---"`,
    );
  });
});

describe("buildFindingLines", () => {
  it("returns empty array for empty findings", () => {
    expect(buildFindingLines([])).toMatchInlineSnapshot(`[]`);
  });

  it("formats a single file with one fence", () => {
    expect(buildFindingLines([finding("src/foo.ts", [node("// ----", 2)])])).toMatchInlineSnapshot(`
      [
        "  src/foo.ts:",
        "    line 2, col 1: // ----",
      ]
    `);
  });

  it("formats multiple fences in one file", () => {
    expect(
      buildFindingLines([finding("src/bar.ts", [node("// ====", 1), node("// ####", 5)])]),
    ).toMatchInlineSnapshot(`
      [
        "  src/bar.ts:",
        "    line 1, col 1: // ====",
        "    line 5, col 1: // ####",
      ]
    `);
  });

  it("formats multiple files", () => {
    expect(
      buildFindingLines([
        finding("a.ts", [node("// ---", 1)]),
        finding("b.ts", [node("// ===", 3)]),
      ]),
    ).toMatchInlineSnapshot(`
      [
        "  a.ts:",
        "    line 1, col 1: // ---",
        "  b.ts:",
        "    line 3, col 1: // ===",
      ]
    `);
  });
});

describe("buildBlockReason", () => {
  it("formats the full message", () => {
    expect(buildBlockReason([finding("src/x.ts", [node("// ----", 7)])])).toMatchInlineSnapshot(`
      "Write blocked — fence/divider comments in added code:
        src/x.ts:
          line 7, col 1: // ----
      Remove these comments and retry."
    `);
  });
});

describe("buildWarnText", () => {
  it("formats the full message", () => {
    expect(buildWarnText([finding("src/y.ts", [node("// ===", 2)])])).toMatchInlineSnapshot(`
      "⚠ pi-fence: fence/divider comments detected in added code:
        src/y.ts:
          line 2, col 1: // ===
      Please remove them."
    `);
  });
});

describe("buildRemoveText", () => {
  it("formats the full message", () => {
    expect(buildRemoveText([finding("src/z.ts", [node("// ***", 4)])])).toMatchInlineSnapshot(`
      "ℹ pi-fence: fence/divider comments were automatically removed:
        src/z.ts:
          line 4, col 1: // ***
      Do not add them back."
    `);
  });

  it("formats multiple files", () => {
    expect(
      buildRemoveText([
        finding("a.ts", [node("// ---", 1), node("// ===", 3)]),
        finding("b.ts", [node("// ###", 10)]),
      ]),
    ).toMatchInlineSnapshot(`
      "ℹ pi-fence: fence/divider comments were automatically removed:
        a.ts:
          line 1, col 1: // ---
          line 3, col 1: // ===
        b.ts:
          line 10, col 1: // ###
      Do not add them back."
    `);
  });
});
