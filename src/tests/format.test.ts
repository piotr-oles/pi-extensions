import { describe, expect, it } from "vitest";
import { formatContext } from "../format.js";
import type { SemContextResult } from "../sem.js";

// ---------------------------------------------------------------------------
// formatContext
// ---------------------------------------------------------------------------

describe("formatContext", () => {
  const baseResult: SemContextResult = {
    entity: "myFunc",
    entityId: "src/utils.ts::function::myFunc",
    budget: 4000,
    total_tokens: 120,
    entries: [
      {
        entityId: "src/utils.ts::function::myFunc",
        file: "src/utils.ts",
        name: "myFunc",
        type: "function",
        role: "target",
        content: "function myFunc(x: number): number {\n  return x * 2;\n}",
        tokens: 20,
      },
    ],
  };

  it("includes entity name and token info in header", () => {
    const out = formatContext(baseResult);
    expect(out).toContain("Entity: myFunc");
    expect(out).toContain("120 tokens / 4000 budget");
  });

  it("labels target entry with ▶ target", () => {
    const out = formatContext(baseResult);
    expect(out).toContain("▶ target");
  });

  it("includes file path and code content", () => {
    const out = formatContext(baseResult);
    expect(out).toContain("File: src/utils.ts");
    expect(out).toContain("function myFunc(x: number): number");
  });

  it("wraps content in fenced code block", () => {
    const out = formatContext(baseResult);
    expect(out).toContain("```\nfunction myFunc");
  });

  it("uses role as-is for non-target entries", () => {
    const result: SemContextResult = {
      ...baseResult,
      entries: [{ ...baseResult.entries[0], role: "dependency" }],
    };
    const out = formatContext(result);
    expect(out).toContain("dependency");
    expect(out).not.toContain("▶ target");
  });

  it("renders multiple entries", () => {
    const result: SemContextResult = {
      ...baseResult,
      entries: [
        baseResult.entries[0],
        {
          entityId: "src/utils.ts::variable::FACTOR",
          file: "src/utils.ts",
          name: "FACTOR",
          type: "variable",
          role: "dependency",
          content: "const FACTOR = 2;",
          tokens: 5,
        },
      ],
    };
    const out = formatContext(result);
    expect(out).toContain("myFunc");
    expect(out).toContain("FACTOR");
  });
});
