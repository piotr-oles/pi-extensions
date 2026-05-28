import { describe, expect, it } from "vitest";
import { rust } from "./rust.js";

describe("rust — extractCommentNodes", () => {
  it("finds line_comment nodes", async () => {
    const nodes = await rust.extractCommentNodes(`// ---- helpers ----\nfn main() {}`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- helpers ----");
  });
});
