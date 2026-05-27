import { describe, expect, it } from "vitest";
import { isFenceComment, removeFenceComments, stripMarkers } from "../fence.js";
import type { CommentNode } from "../parse.js";

// Helper: build a minimal CommentNode from a single-line comment string.
function node(text: string, startLine: number, startCol = 0): CommentNode {
  return { text, startLine, startCol, endLine: startLine, endCol: startCol + text.length };
}

describe("stripMarkers", () => {
  it("strips // prefix", () => {
    expect(stripMarkers("// hello")).toBe("hello");
  });
  it("strips // with no space", () => {
    expect(stripMarkers("//hello")).toBe("hello");
  });
  it("strips # prefix", () => {
    expect(stripMarkers("# hello")).toBe("hello");
  });
  it("strips /* */ markers", () => {
    expect(stripMarkers("/* hello */")).toBe("hello");
  });
  it("strips leading * (block comment continuation)", () => {
    expect(stripMarkers("* hello")).toBe("hello");
  });
  it("preserves inner content intact", () => {
    expect(stripMarkers("// ---- section ----")).toBe("---- section ----");
  });
});

describe("isFenceComment — fences (should return true)", () => {
  it.each([
    // dash fences
    ["// ---- section ----"],
    ["// ---"],
    ["  // ------- helpers -------"],
    // equals fences
    ["// ===== Auth Module ====="],
    ["// =================="],
    // hash fences
    ["# ################"],
    ["// ###"],
    // mixed separators
    ["/* ~~~ helpers ~~~ */"],
    ["// +++ section +++"],
    ["// ________________"],
    ["// *** MODULE ***"],
    // no text, pure separator
    ["// --------------------"],
    ["// ===================="],
    // pipe fences
    ["// |||||||"],
    // indented
    ["    // ---- section ----"],
    // block comment
    ["/* ===== section ===== */"],
    // bookended: separators on both sides with meaningful text in the middle
    ["// --- NOTE: this is important ---"],
    ["// --- start of function (do not remove) ---"],
    ["// === Auth: login flow ==="],
    // UTF-8 box-drawing characters (U+2500–U+257F)
    ["// ──────────────────"], // U+2500 light horizontal
    ["// ━━━━━━━━━━━━━━━━━━"], // U+2501 heavy horizontal
    ["// ════════════════"], // U+2550 double horizontal
    ["// ─── section ───"], // bookended box-drawing
    ["// ━━━ NOTE: important ━━━"], // bookended heavy
    ["// ═══ Auth Module ═══"], // bookended double
  ])("%s", (input) => {
    expect(isFenceComment(input)).toBe(true);
  });
});

describe("isFenceComment — not fences (should return false)", () => {
  it.each([
    // zero separators
    ["// TODO: fix this"],
    // UTF-8 — fewer than 3 consecutive (same rule as ASCII "// -- section --")
    ["// ── section ──"], // only 2 consecutive box chars each side
    ["// ─ ─ ─ ─"], // spaced — no 3-consecutive sequence
    ["// Copyright (c) 2024"],
    ["// regular comment"],
    ["# Python comment here"],
    ["// See the docs"],
    // URLs with paths (slashes, hyphens in words)
    ["// https://example.com/some-path"],
    // too short
    ["//"],
    ["// -"],
    ["// --"],
    [""],
    // two separator chars — below threshold of 3
    ["// =="],
  ])("%s", (input) => {
    expect(isFenceComment(input)).toBe(false);
  });
});

describe("removeFenceComments", () => {
  it("returns content unchanged when no nodes given", () => {
    const src = "const x = 1;\n";
    expect(removeFenceComments(src, [])).toBe(src);
  });

  it("removes a standalone fence line", () => {
    expect(
      removeFenceComments("// ---- section ----\nconst x = 1;\n", [
        node("// ---- section ----", 1),
      ]),
    ).toBe("const x = 1;\n");
  });

  it("removes a standalone fence between code lines", () => {
    expect(removeFenceComments("const a = 1;\n// ===\nconst b = 2;\n", [node("// ===", 2)])).toBe(
      "const a = 1;\nconst b = 2;\n",
    );
  });

  it("removes multiple standalone fences", () => {
    expect(
      removeFenceComments("// ---- a ----\nconst x = 1;\n// ---- b ----\nconst y = 2;\n", [
        node("// ---- a ----", 1),
        node("// ---- b ----", 3),
      ]),
    ).toBe("const x = 1;\nconst y = 2;\n");
  });

  it("strips an inline fence comment, keeps the code", () => {
    expect(
      removeFenceComments("const x = 1; // ---- section ----\n", [
        node("// ---- section ----", 1, 13),
      ]),
    ).toBe("const x = 1;\n");
  });

  it("handles an indented standalone fence", () => {
    expect(
      removeFenceComments("  // ---- section ----\nconst x = 1;\n", [
        node("// ---- section ----", 1, 2),
      ]),
    ).toBe("const x = 1;\n");
  });

  it("preserves lines without fences untouched", () => {
    const src = "// TODO: fix this\nconst x = 1;\n";
    expect(removeFenceComments(src, [])).toBe(src);
  });
});
