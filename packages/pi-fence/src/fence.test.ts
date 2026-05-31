import { describe, expect, it } from "vitest";
import { hasFenceCandidate, isFenceComment, removeFenceComments, stripMarkers } from "./fence.js";
import type { CommentNode } from "./types.js";

// Helper: build a minimal CommentNode from a single-line comment string.
function node(text: string, startLine: number, startCol = 0): CommentNode {
  return { text, startLine, startCol, endLine: startLine, endCol: startCol + text.length };
}

describe("hasFenceCandidate", () => {
  it("returns false for empty string", () => {
    expect(hasFenceCandidate("")).toBe(false);
  });

  it("returns false for plain prose", () => {
    expect(hasFenceCandidate("const x = hello + world;")).toBe(false);
  });

  it("returns false for single-dash words", () => {
    expect(hasFenceCandidate("some-value or off-by-one")).toBe(false);
  });

  it("returns false for a URL with hyphens", () => {
    expect(hasFenceCandidate("// https://example.com/some-path")).toBe(false);
  });

  it("returns false for two consecutive separator chars (below threshold)", () => {
    expect(hasFenceCandidate("// ==")).toBe(false);
  });

  it("returns true for a line with a fence sequence", () => {
    expect(hasFenceCandidate("// ---- section ----")).toBe(true);
  });

  it("returns true for === alone", () => {
    expect(hasFenceCandidate("===")).toBe(true);
  });

  it("returns true for hash fence", () => {
    expect(hasFenceCandidate("# ################")).toBe(true);
  });

  it("returns true for Unicode box-drawing sequence", () => {
    expect(hasFenceCandidate("// ─────────────────────")).toBe(true);
  });

  it("returns true when fence sequence is buried in a large file", () => {
    const content = "const a = 1;\nconst b = 2;\n// ---- helpers ----\nconst c = 3;\n";
    expect(hasFenceCandidate(content)).toBe(true);
  });

  it("returns false for a large file with no fence sequences", () => {
    const content = "const a = 1;\n// TODO: fix\nconst b = 2;\n".repeat(100);
    expect(hasFenceCandidate(content)).toBe(false);
  });

  it("returns true even when fence sequence is inside a string literal (over-approximation)", () => {
    // The full parser would correctly reject this; hasFenceCandidate is intentionally conservative.
    expect(hasFenceCandidate('const s = "---- not a comment ----";')).toBe(true);
  });
});

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
        node("// ---- section ----", 0),
      ]),
    ).toBe("const x = 1;\n");
  });

  it("removes a standalone fence between code lines", () => {
    expect(removeFenceComments("const a = 1;\n// ===\nconst b = 2;\n", [node("// ===", 1)])).toBe(
      "const a = 1;\nconst b = 2;\n",
    );
  });

  it("removes multiple standalone fences", () => {
    expect(
      removeFenceComments("// ---- a ----\nconst x = 1;\n// ---- b ----\nconst y = 2;\n", [
        node("// ---- a ----", 0),
        node("// ---- b ----", 2),
      ]),
    ).toBe("const x = 1;\nconst y = 2;\n");
  });

  it("strips an inline fence comment, keeps the code", () => {
    expect(
      removeFenceComments("const x = 1; // ---- section ----\n", [
        node("// ---- section ----", 0, 13),
      ]),
    ).toBe("const x = 1;\n");
  });

  it("handles an indented standalone fence", () => {
    expect(
      removeFenceComments("  // ---- section ----\nconst x = 1;\n", [
        node("// ---- section ----", 0, 2),
      ]),
    ).toBe("const x = 1;\n");
  });

  it("preserves lines without fences untouched", () => {
    const src = "// TODO: fix this\nconst x = 1;\n";
    expect(removeFenceComments(src, [])).toBe(src);
  });
});
