import { describe, expect, it } from "vitest";
import { extractComments } from "../parse.js";

// These tests load real WASM grammars — they're slower than unit tests (~1-2s
// for first run due to WASM initialisation, then fast via the grammar cache).

describe("extractComments — TypeScript", () => {
  it("finds line comments", async () => {
    const src = `
// ---- helpers ----
const x = 1;
// regular comment
`.trim();
    const nodes = await extractComments(src, "src/utils.ts");
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
    const nodes = await extractComments(src, "src/utils.ts");
    expect(nodes).toHaveLength(0);
  });

  it("finds block comments", async () => {
    const src = `/* ===== section ===== */\nconst x = 1;`;
    const nodes = await extractComments(src, "src/utils.ts");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("/* ===== section ===== */");
    expect(nodes[0].startLine).toBe(1);
  });

  it("reports correct columns", async () => {
    const src = `const x = 1; // ---- fence ----`;
    const nodes = await extractComments(src, "src/utils.ts");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].startCol).toBe(13);
    expect(nodes[0].endCol).toBe(13 + "// ---- fence ----".length);
  });

  it("returns [] for unsupported extension", async () => {
    const nodes = await extractComments("// comment", "src/template.html");
    expect(nodes).toHaveLength(0);
  });
});

describe("extractComments — JavaScript", () => {
  it("finds comments in .js files", async () => {
    const src = `// ---- section ----\nfunction foo() {}`;
    const nodes = await extractComments(src, "lib/utils.js");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- section ----");
  });
});

describe("extractComments — Python", () => {
  it("finds hash comments", async () => {
    const src = `# ---- helpers ----\ndef foo():\n    pass`;
    const nodes = await extractComments(src, "src/utils.py");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("# ---- helpers ----");
    expect(nodes[0].startLine).toBe(1);
  });

  it("does not extract # inside a string", async () => {
    const src = `s = "# not a comment"`;
    const nodes = await extractComments(src, "src/utils.py");
    expect(nodes).toHaveLength(0);
  });
});

describe("extractComments — Go", () => {
  it("finds line comments", async () => {
    const src = `package main\n// ---- section ----\nfunc main() {}`;
    const nodes = await extractComments(src, "main.go");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- section ----");
  });
});

describe("extractComments — Rust", () => {
  it("finds line_comment nodes", async () => {
    const src = `// ---- helpers ----\nfn main() {}`;
    const nodes = await extractComments(src, "src/main.rs");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- helpers ----");
  });
});

describe("extractComments — TypeScript (.cts/.mts)", () => {
  it("finds comments in .cts files", async () => {
    const src = `// ---- section ----\nconst x = 1;`;
    const nodes = await extractComments(src, "lib/utils.cts");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- section ----");
  });

  it("finds comments in .mts files", async () => {
    const src = `// ---- section ----\nexport const x = 1;`;
    const nodes = await extractComments(src, "lib/utils.mts");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- section ----");
  });
});

describe("extractComments — Ruby", () => {
  it("finds hash comments", async () => {
    const src = `# ---- helpers ----\ndef foo\nend`;
    const nodes = await extractComments(src, "lib/utils.rb");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("# ---- helpers ----");
  });
});

describe("extractComments — Java", () => {
  it("finds line comments", async () => {
    const src = `// ---- helpers ----\nclass Foo {}`;
    const nodes = await extractComments(src, "src/Foo.java");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- helpers ----");
  });

  it("finds block comments", async () => {
    const src = `/* ===== section ===== */\nclass Foo {}`;
    const nodes = await extractComments(src, "src/Foo.java");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("/* ===== section ===== */");
  });
});

describe("extractComments — Bash", () => {
  it("finds hash comments in .sh files", async () => {
    const src = `#!/bin/bash\n# ---- helpers ----\necho hello`;
    const nodes = await extractComments(src, "deploy.sh");
    expect(nodes.map((n) => n.text)).toContain("# ---- helpers ----");
  });

  it("finds hash comments in .bash files", async () => {
    const src = `# ---- section ----\necho hello`;
    const nodes = await extractComments(src, "run.bash");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("# ---- section ----");
  });
});

describe("extractComments — C", () => {
  it("finds comments in .c files", async () => {
    const src = `// ---- helpers ----\nint main() { return 0; }`;
    const nodes = await extractComments(src, "main.c");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("// ---- helpers ----");
  });

  it("finds comments in .h files", async () => {
    const src = `/* ===== section ===== */\nvoid foo(void);`;
    const nodes = await extractComments(src, "include/foo.h");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("/* ===== section ===== */");
  });
});

describe("extractComments — CSS", () => {
  it("finds block comments in .css files", async () => {
    const src = `/* ===== section ===== */\n.foo { color: red; }`;
    const nodes = await extractComments(src, "styles.css");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe("/* ===== section ===== */");
  });
});
