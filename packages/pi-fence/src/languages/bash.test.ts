import { describe, expect, it } from "vitest";
import { bash } from "./bash.js";

describe("bash — extractCommentNodes", () => {
  it("finds hash comments in .sh files", async () => {
    const nodes = await bash.extractCommentNodes(`#!/bin/bash\n# ---- helpers ----\necho hello`);
    expect(nodes.map((n) => n.text)).toContain("# ---- helpers ----");
  });

  it("finds hash comments in standalone scripts", async () => {
    const nodes = await bash.extractCommentNodes(`# ---- section ----\necho hello`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("# ---- section ----");
  });

  it("handles .sh and .bash via the same definition", () => {
    expect(bash.supportedExtensions).toContain("sh");
    expect(bash.supportedExtensions).toContain("bash");
  });
});
