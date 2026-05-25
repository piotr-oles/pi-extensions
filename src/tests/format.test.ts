import { describe, expect, it } from "vitest";
import { formatContext, formatEntities, formatImpact } from "../format.js";
import type { SemContextResult, SemEntity, SemImpactResult } from "../sem.js";

// ---------------------------------------------------------------------------
// formatEntities
// ---------------------------------------------------------------------------

describe("formatEntities", () => {
  it("returns placeholder for empty list", () => {
    expect(formatEntities([])).toBe("(no entities found)");
  });

  it("formats a flat list of entities", () => {
    const entities: SemEntity[] = [
      { name: "myFunc", type: "function", start_line: 1, end_line: 5, parent_id: null },
      { name: "MY_CONST", type: "variable", start_line: 7, end_line: 7, parent_id: null },
    ];
    const out = formatEntities(entities);
    expect(out).toContain("function myFunc (L1–5)");
    expect(out).toContain("variable MY_CONST (L7)");
  });

  it("uses single-line format when start equals end", () => {
    const entities: SemEntity[] = [
      { name: "VALUE", type: "variable", start_line: 10, end_line: 10, parent_id: null },
    ];
    expect(formatEntities(entities)).toBe("variable VALUE (L10)");
  });

  it("indents children under their parent", () => {
    const entities: SemEntity[] = [
      { name: "MyClass", type: "class", start_line: 1, end_line: 20, parent_id: null },
      { name: "render", type: "method", start_line: 5, end_line: 10, parent_id: "file.ts::class::MyClass" },
      { name: "helper", type: "method", start_line: 12, end_line: 18, parent_id: "file.ts::class::MyClass" },
    ];
    const out = formatEntities(entities);
    const lines = out.split("\n");
    expect(lines[0]).toBe("class MyClass (L1–20)");
    expect(lines[1]).toBe("  method render (L5–10)");
    expect(lines[2]).toBe("  method helper (L12–18)");
  });

  it("handles multiple roots with children", () => {
    const entities: SemEntity[] = [
      { name: "ClassA", type: "class", start_line: 1, end_line: 10, parent_id: null },
      { name: "methodA", type: "method", start_line: 3, end_line: 8, parent_id: "file.ts::class::ClassA" },
      { name: "standaloneFunc", type: "function", start_line: 15, end_line: 20, parent_id: null },
    ];
    const out = formatEntities(entities);
    expect(out).toContain("class ClassA");
    expect(out).toContain("  method methodA");
    expect(out).toContain("function standaloneFunc");
  });
});

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
      entries: [
        { ...baseResult.entries[0], role: "dependency" },
      ],
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

// ---------------------------------------------------------------------------
// formatImpact
// ---------------------------------------------------------------------------

describe("formatImpact", () => {
  const baseResult: SemImpactResult = {
    entity: {
      entityId: "src/auth.ts::function::login",
      name: "login",
      type: "function",
      file: "src/auth.ts",
      lines: [10, 30],
    },
    dependencies: [],
    dependents: [],
    impact: { depth: 2, total: 0, entities: [] },
    tests: [],
  };

  it("shows entity header", () => {
    const out = formatImpact(baseResult);
    expect(out).toContain("function `login`");
    expect(out).toContain("src/auth.ts");
  });

  it("shows no-impact message when everything is empty", () => {
    const out = formatImpact(baseResult);
    expect(out).toContain("(no impact found)");
  });

  it("lists direct dependencies", () => {
    const result: SemImpactResult = {
      ...baseResult,
      dependencies: [{
        entityId: "src/db.ts::function::query",
        name: "query",
        type: "function",
        file: "src/db.ts",
        lines: [5, 15],
      }],
    };
    const out = formatImpact(result);
    expect(out).toContain("## Dependencies (1)");
    expect(out).toContain("function `query`");
    expect(out).toContain("src/db.ts L5–15");
  });

  it("lists direct dependents", () => {
    const result: SemImpactResult = {
      ...baseResult,
      dependents: [{
        entityId: "src/api.ts::function::handleLogin",
        name: "handleLogin",
        type: "function",
        file: "src/api.ts",
        lines: [20, 40],
      }],
    };
    const out = formatImpact(result);
    expect(out).toContain("## Direct dependents (1)");
    expect(out).toContain("function `handleLogin`");
  });

  it("lists transitive impact with depth markers", () => {
    const result: SemImpactResult = {
      ...baseResult,
      impact: {
        depth: 2,
        total: 1,
        entities: [{
          entityId: "src/api.ts::function::handleLogin",
          name: "handleLogin",
          type: "function",
          file: "src/api.ts",
          lines: [20, 40],
          depth: 1,
        }],
      },
    };
    const out = formatImpact(result);
    expect(out).toContain("## Transitive impact");
    expect(out).toContain("[d1]");
    expect(out).toContain("handleLogin");
  });

  it("lists affected tests", () => {
    const result: SemImpactResult = {
      ...baseResult,
      tests: [{
        entityId: "src/auth.test.ts::function::testLogin",
        name: "testLogin",
        type: "function",
        file: "src/auth.test.ts",
        lines: [5, 20],
      }],
    };
    const out = formatImpact(result);
    expect(out).toContain("## Affected tests (1)");
    expect(out).toContain("testLogin");
  });

  it("uses single-line format for same start/end lines", () => {
    const result: SemImpactResult = {
      ...baseResult,
      dependencies: [{
        entityId: "src/config.ts::variable::MAX",
        name: "MAX",
        type: "variable",
        file: "src/config.ts",
        lines: [3, 3],
      }],
    };
    const out = formatImpact(result);
    expect(out).toContain("L3)");
    expect(out).not.toContain("L3–3");
  });
});
