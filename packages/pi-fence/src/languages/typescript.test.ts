import { describe, expect, it } from "vitest";
import { typescript, typescriptTsx } from "./typescript.js";

describe("typescript — extractCommentNodes", () => {
  it("finds line comments", async () => {
    const src = `
// ---- helpers ----
const x = 1;
// regular comment
`.trim();
    const nodes = await typescript.extractCommentNodes(src);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].text).toBe("// ---- helpers ----");
    expect(nodes[0].startLine).toBe(1);
    expect(nodes[0].endLine).toBe(1);
    expect(nodes[0].endCol).toBe(20);
    expect(nodes[1].text).toBe("// regular comment");
    expect(nodes[1].startLine).toBe(3);
  });

  it("does not extract // inside a string literal", async () => {
    const nodes = await typescript.extractCommentNodes(`const s = "// this is not a comment";`);
    expect(nodes).toHaveLength(0);
  });

  it("finds block comments", async () => {
    const nodes = await typescript.extractCommentNodes(`/* ===== section ===== */\nconst x = 1;`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("/* ===== section ===== */");
  });

  it("reports correct columns", async () => {
    const nodes = await typescript.extractCommentNodes(`const x = 1; // ---- fence ----`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].startCol).toBe(13);
    expect(nodes[0].endCol).toBe(13 + "// ---- fence ----".length);
  });

});

describe("typescriptTsx — extractCommentNodes", () => {
  it("finds line comments in TSX", async () => {
    const nodes = await typescriptTsx.extractCommentNodes(`// ---- section ----\nconst x = 1;`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- section ----");
  });
});
