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
  ])("%s", (input) => {
    expect(isFenceComment(input)).toBe(true);
  });
});

// ─── isFenceComment — true negatives ─────────────────────────────────────────

describe("isFenceComment — not fences (should return false)", () => {
  it.each([
    // zero separators
    ["// TODO: fix this"],
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
