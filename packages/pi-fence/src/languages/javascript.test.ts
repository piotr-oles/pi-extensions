import { describe, expect, it } from "vitest";
import { javascript } from "./javascript.js";

describe("javascript — extractCommentNodes", () => {
  it("finds line comments", async () => {
    const nodes = await javascript.extractCommentNodes(`// ---- section ----\nfunction foo() {}`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- section ----");
  });

  it("handles .jsx, .mjs, .cjs via the same definition", () => {
    expect(javascript.supportedExtensions).toContain("jsx");
    expect(javascript.supportedExtensions).toContain("mjs");
    expect(javascript.supportedExtensions).toContain("cjs");
  });
});
