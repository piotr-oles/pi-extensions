import { describe, expect, it } from "vitest";
import { c } from "./c.js";

describe("c — extractCommentNodes", () => {
  it("finds line comments in .c files", async () => {
    const nodes = await c.extractCommentNodes(`// ---- helpers ----\nint main() { return 0; }`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- helpers ----");
  });

  it("finds block comments in .h files", async () => {
    const nodes = await c.extractCommentNodes(`/* ===== section ===== */\nvoid foo(void);`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("/* ===== section ===== */");
  });
});
