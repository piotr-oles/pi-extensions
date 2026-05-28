import { describe, expect, it } from "vitest";
import { go } from "./go.js";

describe("go — extractCommentNodes", () => {
  it("finds line comments", async () => {
    const nodes = await go.extractCommentNodes(
      `package main\n// ---- section ----\nfunc main() {}`,
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- section ----");
  });
});
