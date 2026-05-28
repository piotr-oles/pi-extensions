import { describe, expect, it } from "vitest";
import { buildBlockReason, buildFindingLines, buildRemoveText, buildWarnText } from "./messages.js";
import type { CommentNode, FencesFinding } from "./types.js";

function node(text: string, startLine: number, startCol = 0): CommentNode {
  return { text, startLine, startCol, endLine: startLine, endCol: startCol + text.length };
}

function finding(path: string, fences: CommentNode[]): FencesFinding {
  return { path, fences };
}

describe("buildFindingLines", () => {
  it("returns empty array for empty findings", () => {
    expect(buildFindingLines([])).toMatchInlineSnapshot(`[]`);
  });

  it("formats a single file with one fence", () => {
    expect(buildFindingLines([finding("src/foo.ts", [node("// ----", 1)])])).toMatchInlineSnapshot(`
      [
        "  src/foo.ts:2:1: // ----",
      ]
    `);
  });

  it("formats multiple fences in one file", () => {
    expect(
      buildFindingLines([finding("src/bar.ts", [node("// ====", 0), node("// ####", 4)])]),
    ).toMatchInlineSnapshot(`
      [
        "  src/bar.ts:",
        "    1:1: // ====",
        "    5:1: // ####",
      ]
    `);
  });

  it("formats multiple files", () => {
    expect(
      buildFindingLines([
        finding("a.ts", [node("// ---", 0)]),
        finding("b.ts", [node("// ===", 2)]),
      ]),
    ).toMatchInlineSnapshot(`
      [
        "  a.ts:1:1: // ---",
        "  b.ts:3:1: // ===",
      ]
    `);
  });
});

describe("buildBlockReason", () => {
  it("formats the full message", () => {
    expect(buildBlockReason([finding("src/x.ts", [node("// ----", 6)])])).toMatchInlineSnapshot(`
      "Write blocked — fence/divider comments in added code:
        src/x.ts:7:1: // ----
      Remove these comments and retry."
    `);
  });
});

describe("buildWarnText", () => {
  it("formats the full message", () => {
    expect(buildWarnText([finding("src/y.ts", [node("// ===", 1)])])).toMatchInlineSnapshot(`
      "⚠ pi-fence: fence/divider comments detected in added code:
        src/y.ts:2:1: // ===
      Please remove them."
    `);
  });
});

describe("buildRemoveText", () => {
  it("formats the full message", () => {
    expect(buildRemoveText([finding("src/z.ts", [node("// ***", 3)])])).toMatchInlineSnapshot(`
      "ℹ pi-fence: fence/divider comments were automatically removed:
        src/z.ts:4:1: // ***
      Do not add them back."
    `);
  });

  it("formats multiple files", () => {
    expect(
      buildRemoveText([
        finding("a.ts", [node("// ---", 0), node("// ===", 2)]),
        finding("b.ts", [node("// ###", 9)]),
      ]),
    ).toMatchInlineSnapshot(`
      "ℹ pi-fence: fence/divider comments were automatically removed:
        a.ts:
          1:1: // ---
          3:1: // ===
        b.ts:10:1: // ###
      Do not add them back."
    `);
  });
});
