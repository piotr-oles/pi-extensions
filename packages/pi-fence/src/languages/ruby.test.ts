import { describe, expect, it } from "vitest";
import { ruby } from "./ruby.js";

describe("ruby — extractCommentNodes", () => {
  it("finds hash comments", async () => {
    const nodes = await ruby.extractCommentNodes(`# ---- helpers ----\ndef foo\nend`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("# ---- helpers ----");
  });
});
