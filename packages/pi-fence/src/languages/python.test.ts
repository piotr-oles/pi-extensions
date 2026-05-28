import { describe, expect, it } from "vitest";
import { python } from "./python.js";

describe("python — extractCommentNodes", () => {
  it("finds hash comments", async () => {
    const nodes = await python.extractCommentNodes(`# ---- helpers ----\ndef foo():\n    pass`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("# ---- helpers ----");
    expect(nodes[0].startLine).toBe(0);
  });

  it("does not extract # inside a string", async () => {
    const nodes = await python.extractCommentNodes(`s = "# not a comment"`);
    expect(nodes).toHaveLength(0);
  });
});
