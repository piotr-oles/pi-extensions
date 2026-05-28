import { describe, expect, it } from "vitest";
import { java } from "./java.js";

describe("java — extractCommentNodes", () => {
  it("finds line comments", async () => {
    const nodes = await java.extractCommentNodes(`// ---- helpers ----\nclass Foo {}`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- helpers ----");
  });

  it("finds block comments", async () => {
    const nodes = await java.extractCommentNodes(`/* ===== section ===== */\nclass Foo {}`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("/* ===== section ===== */");
  });
});
