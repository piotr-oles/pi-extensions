import { describe, expect, it } from "vitest";
import { getLanguageDefinition } from "../languages/index.js";

// These tests load real WASM grammars — they're slower than unit tests (~1-2s
// for first run due to WASM initialisation, then fast via the parser cache).

async function extract(src: string, file: string) {
  return getLanguageDefinition(file)?.extractCommentNodes(src) ?? [];
}

describe("getLanguageDefinition", () => {
  it("returns undefined for unsupported extensions", () => {
    expect(getLanguageDefinition("src/template.html")).toBeUndefined();
    expect(getLanguageDefinition("data.json")).toBeUndefined();
  });
});

describe("extractCommentNodes — TypeScript", () => {
  it("finds line comments", async () => {
    const src = `
// ---- helpers ----
const x = 1;
// regular comment
`.trim();
    const nodes = await extract(src, "src/utils.ts");
    expect(nodes).toHaveLength(2);
    expect(nodes[0].text).toBe("// ---- helpers ----");
    expect(nodes[0].startLine).toBe(1);
    expect(nodes[0].endLine).toBe(1);
    expect(nodes[0].endCol).toBe(20);
    expect(nodes[1].text).toBe("// regular comment");
    expect(nodes[1].startLine).toBe(3);
  });

  it("does not extract // inside a string literal", async () => {
    const src = `const s = "// this is not a comment";`;
    expect(await extract(src, "src/utils.ts")).toHaveLength(0);
  });

  it("finds block comments", async () => {
    const src = `/* ===== section ===== */\nconst x = 1;`;
    const nodes = await extract(src, "src/utils.ts");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("/* ===== section ===== */");
  });

  it("reports correct columns", async () => {
    const src = `const x = 1; // ---- fence ----`;
    const nodes = await extract(src, "src/utils.ts");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].startCol).toBe(13);
    expect(nodes[0].endCol).toBe(13 + "// ---- fence ----".length);
  });
});

describe("extractCommentNodes — TypeScript (.cts/.mts)", () => {
  it("finds comments in .cts files", async () => {
    const nodes = await extract("// ---- section ----\nconst x = 1;", "lib/utils.cts");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- section ----");
  });

  it("finds comments in .mts files", async () => {
    const nodes = await extract("// ---- section ----\nexport const x = 1;", "lib/utils.mts");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- section ----");
  });
});

describe("extractCommentNodes — JavaScript", () => {
  it("finds comments in .js files", async () => {
    const nodes = await extract("// ---- section ----\nfunction foo() {}", "lib/utils.js");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- section ----");
  });
});

describe("extractCommentNodes — Python", () => {
  it("finds hash comments", async () => {
    const src = `# ---- helpers ----\ndef foo():\n    pass`;
    const nodes = await extract(src, "src/utils.py");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("# ---- helpers ----");
    expect(nodes[0].startLine).toBe(1);
  });

  it("does not extract # inside a string", async () => {
    expect(await extract(`s = "# not a comment"`, "src/utils.py")).toHaveLength(0);
  });
});

describe("extractCommentNodes — Go", () => {
  it("finds line comments", async () => {
    const nodes = await extract("package main\n// ---- section ----\nfunc main() {}", "main.go");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- section ----");
  });
});

describe("extractCommentNodes — Rust", () => {
  it("finds line_comment nodes", async () => {
    const nodes = await extract("// ---- helpers ----\nfn main() {}", "src/main.rs");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- helpers ----");
  });
});

describe("extractCommentNodes — Ruby", () => {
  it("finds hash comments", async () => {
    const nodes = await extract("# ---- helpers ----\ndef foo\nend", "lib/utils.rb");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("# ---- helpers ----");
  });
});

describe("extractCommentNodes — Java", () => {
  it("finds line comments", async () => {
    const nodes = await extract("// ---- helpers ----\nclass Foo {}", "src/Foo.java");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- helpers ----");
  });

  it("finds block comments", async () => {
    const nodes = await extract("/* ===== section ===== */\nclass Foo {}", "src/Foo.java");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("/* ===== section ===== */");
  });
});

describe("extractCommentNodes — Bash", () => {
  it("finds hash comments in .sh files", async () => {
    const nodes = await extract("#!/bin/bash\n# ---- helpers ----\necho hello", "deploy.sh");
    expect(nodes.map((n) => n.text)).toContain("# ---- helpers ----");
  });

  it("finds hash comments in .bash files", async () => {
    const nodes = await extract("# ---- section ----\necho hello", "run.bash");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("# ---- section ----");
  });
});

describe("extractCommentNodes — C", () => {
  it("finds comments in .c files", async () => {
    const nodes = await extract("// ---- helpers ----\nint main() { return 0; }", "main.c");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- helpers ----");
  });

  it("finds comments in .h files", async () => {
    const nodes = await extract("/* ===== section ===== */\nvoid foo(void);", "include/foo.h");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("/* ===== section ===== */");
  });
});

describe("extractCommentNodes — CSS", () => {
  it("finds block comments in .css files", async () => {
    const nodes = await extract("/* ===== section ===== */\n.foo { color: red; }", "styles.css");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("/* ===== section ===== */");
  });
});
