import { describe, expect, it } from "vitest";
import { isFenceComment, stripMarkers } from "../fence.js";

// ─── stripMarkers ─────────────────────────────────────────────────────────────

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

// ─── isFenceComment — true positives ─────────────────────────────────────────

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

// ─── isFenceComment — true negatives ─────────────────────────────────────────

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
