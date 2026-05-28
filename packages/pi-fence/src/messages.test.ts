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
        "  src/foo.ts:2: // ----",
      ]
    `);
  });

  it("formats multiple fences in one file", () => {
    expect(
      buildFindingLines([finding("src/bar.ts", [node("// ====", 0), node("// ####", 4)])]),
    ).toMatchInlineSnapshot(`
      [
        "  src/bar.ts:",
        "    1: // ====",
        "    5: // ####",
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
        "  a.ts:1: // ---",
        "  b.ts:3: // ===",
      ]
    `);
  });
});

describe("buildBlockReason", () => {
  it("formats the full message", () => {
    expect(buildBlockReason([finding("src/x.ts", [node("// ----", 6)])])).toMatchInlineSnapshot(`
      "Write blocked — fence comments in added code:
        src/x.ts:7: // ----
      Remove these comments and retry."
    `);
  });
});

describe("buildWarnText", () => {
  it("formats the full message", () => {
    expect(buildWarnText([finding("src/y.ts", [node("// ===", 1)])])).toMatchInlineSnapshot(`
      "Fence comments detected in added code:
        src/y.ts:2: // ===
      Please remove them."
    `);
  });
});

describe("buildRemoveText", () => {
  it("formats the full message", () => {
    expect(buildRemoveText([finding("src/z.ts", [node("// ***", 3)])])).toMatchInlineSnapshot(`
      "Fence comments were automatically removed:
        src/z.ts:4: // ***
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
      "Fence comments were automatically removed:
        a.ts:
          1: // ---
          3: // ===
        b.ts:10: // ###
      Do not add them back."
    `);
  });
});
