import { describe, expect, it } from "vitest";
import { css } from "./css.js";

describe("css — extractCommentNodes", () => {
  it("finds block comments", async () => {
    const nodes = await css.extractCommentNodes(`/* ===== section ===== */\n.foo { color: red; }`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("/* ===== section ===== */");
  });
});
