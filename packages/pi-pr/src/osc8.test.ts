import { describe, expect, it } from "vitest";
import { hyperlink } from "./osc8.js";

describe("hyperlink", () => {
  it("wraps text in an OSC 8 open/close pair", () => {
    expect(hyperlink("https://example.com/pr/1", "#1")).toBe(
      "\x1b]8;;https://example.com/pr/1\x1b\\#1\x1b]8;;\x1b\\",
    );
  });

  it("emits an empty URL and empty text faithfully", () => {
    expect(hyperlink("", "")).toBe("\x1b]8;;\x1b\\\x1b]8;;\x1b\\");
  });
});
