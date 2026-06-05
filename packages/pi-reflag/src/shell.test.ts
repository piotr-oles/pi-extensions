import { describe, expect, it } from "vitest";
import { rewriteCommand } from "./shell.js";

function rewritten(cmd: string): string {
  return rewriteCommand(cmd).rewritten;
}

function changed(cmd: string): boolean {
  return rewriteCommand(cmd).changed;
}

function rewrittenOpts(cmd: string, opts: { rewriteGrep?: boolean; rewriteFind?: boolean }): string {
  return rewriteCommand(cmd, opts).rewritten;
}

function changedOpts(cmd: string, opts: { rewriteGrep?: boolean; rewriteFind?: boolean }): boolean {
  return rewriteCommand(cmd, opts).changed;
}

describe("no grep — unchanged", () => {
  it("no grep at all", () => {
    expect(changed("echo hello")).toBe(false);
  });

  it("grep in middle of segment (not first token)", () => {
    expect(changed("echo grep")).toBe(false);
  });

  it("absolute path grep", () => {
    expect(changed("/usr/bin/grep pattern file.txt")).toBe(false);
  });

  it("rg command untouched", () => {
    expect(changed("rg pattern src/")).toBe(false);
  });
});

describe("simple grep rewrites", () => {
  it("pattern and file", () => {
    const r = rewritten("grep hello file.txt");
    expect(r).toContain("rg");
    expect(r).toContain("hello");
    expect(r).toContain("file.txt");
    expect(r).not.toMatch(/\bgrep\b/);
  });

  it("recursive flag dropped", () => {
    const r = rewritten("grep -rn hello src/");
    expect(r).toContain("rg");
    expect(r).toContain("-n");
    expect(r).not.toContain("-r");
    expect(changed("grep -rn hello src/")).toBe(true);
  });

  it("case insensitive kept", () => {
    const r = rewritten("grep -i hello file.txt");
    expect(r).toContain("-i");
    expect(r).not.toMatch(/\bgrep\b/);
  });

  it("extended regex flag dropped", () => {
    const r = rewritten('grep -E "foo|bar" file.txt');
    expect(r).not.toContain("-E");
    // quote() shell-escapes | to \| — check | is present in some form
    expect(r).toMatch(/foo[\\]?\|bar/);
    expect(r).toContain("rg");
  });

  it("quoted pattern preserved as single arg", () => {
    const r = rewritten("grep 'hello world' file.txt");
    expect(r).toContain("rg");
    expect(r).toContain("hello world");
    expect(r).not.toMatch(/\bgrep\b/);
  });
});

describe("pipeline rewrites", () => {
  it("grep after pipe", () => {
    const r = rewritten("cat file.txt | grep hello");
    expect(r).toContain("cat");
    expect(r).toContain("|");
    expect(r).toContain("rg");
    expect(r).not.toMatch(/\bgrep\b/);
    expect(changed("cat file.txt | grep hello")).toBe(true);
  });

  it("both sides of pipe are grep", () => {
    const r = rewritten("grep foo file.txt | grep bar");
    expect(r.match(/\brg\b/g)).toHaveLength(2);
    expect(r).not.toMatch(/\bgrep\b/);
  });

  it("only second segment is grep", () => {
    const r = rewritten("echo something | grep pattern");
    expect(r).toContain("echo something");
    expect(r).toContain("rg");
    expect(r).not.toMatch(/\bgrep\b/);
  });
});

describe("shell operators", () => {
  it("grep with && operator", () => {
    const r = rewritten("grep foo file.txt && echo done");
    expect(r).toContain("rg");
    expect(r).toContain("&&");
    expect(r).toContain("echo done");
    expect(r).not.toMatch(/\bgrep\b/);
  });

  it("grep with ; separator", () => {
    const r = rewritten("grep foo file.txt ; grep bar file.txt");
    expect(r.match(/\brg\b/g)).toHaveLength(2);
    expect(r).not.toMatch(/\bgrep\b/);
  });

  it("grep with || operator", () => {
    const r = rewritten("grep foo file.txt || echo not found");
    expect(r).toContain("rg");
    expect(r).toContain("||");
    expect(r).not.toMatch(/\bgrep\b/);
  });
});

describe("passthrough — no change flag", () => {
  it("returns changed:false when no grep", () => {
    expect(changed("ls -la")).toBe(false);
  });

  it("returns changed:true when grep rewritten", () => {
    expect(changed("grep pattern file.txt")).toBe(true);
  });

  it("returns changed:false for grep in non-initial position", () => {
    expect(changed("echo grep")).toBe(false);
  });
});

describe("no find — unchanged", () => {
  it("no find at all", () => {
    expect(changed("echo hello")).toBe(false);
  });

  it("find in non-initial position", () => {
    expect(changed("echo find")).toBe(false);
  });

  it("absolute path find untouched", () => {
    expect(changed("/usr/bin/find . -name '*.ts'")).toBe(false);
  });

  it("fd command untouched", () => {
    expect(changed("fd '*.ts' src/")).toBe(false);
  });
});

describe("simple find rewrites", () => {
  it("find . -name rewrites to fd", () => {
    const r = rewritten("find . -name '*.ts'");
    expect(r).toContain("fd");
    expect(r).toContain("*.ts");
    expect(r).not.toMatch(/\bfind\b/);
  });

  it("find with path", () => {
    const r = rewritten("find packages/ -name 'index.ts'");
    expect(r).toContain("fd");
    expect(r).toContain("packages/");
    expect(r).not.toMatch(/\bfind\b/);
  });

  it("-maxdepth translated", () => {
    const r = rewritten("find . -maxdepth 2 -name '*.json'");
    expect(r).toContain("fd");
    expect(r).toContain("-d");
    expect(r).toContain("2");
    expect(changed("find . -maxdepth 2 -name '*.json'")).toBe(true);
  });

  it("-type f kept", () => {
    const r = rewritten("find . -type f -name '*.ts'");
    expect(r).toContain("-t");
    expect(r).toContain("f");
    expect(r).not.toMatch(/\bfind\b/);
  });
});

describe("find pipeline rewrites", () => {
  it("find piped to another command", () => {
    const r = rewritten("find . -name '*.ts' | xargs wc -l");
    expect(r).toContain("fd");
    expect(r).toContain("|");
    expect(r).toContain("xargs");
    expect(r).not.toMatch(/\bfind\b/);
  });

  it("grep and find both in pipeline rewritten", () => {
    const r = rewritten("find . -name '*.ts' | grep import");
    expect(r).toContain("fd");
    expect(r).toContain("rg");
    expect(r).not.toMatch(/\bfind\b/);
    expect(r).not.toMatch(/\bgrep\b/);
  });
});

describe("rewriteCommand options", () => {
  it("rewriteGrep:false skips grep", () => {
    const r = rewrittenOpts("grep hello file.txt", { rewriteGrep: false });
    expect(r).toMatch(/\bgrep\b/);
    expect(changedOpts("grep hello file.txt", { rewriteGrep: false })).toBe(false);
  });

  it("rewriteFind:false skips find", () => {
    const r = rewrittenOpts("find . -name '*.ts'", { rewriteFind: false });
    expect(r).toMatch(/\bfind\b/);
    expect(changedOpts("find . -name '*.ts'", { rewriteFind: false })).toBe(false);
  });

  it("rewriteFind:false still rewrites grep", () => {
    const r = rewrittenOpts("grep hello file.txt", { rewriteFind: false });
    expect(r).toContain("rg");
    expect(r).not.toMatch(/\bgrep\b/);
  });

  it("rewriteGrep:false still rewrites find", () => {
    const r = rewrittenOpts("find . -name '*.ts'", { rewriteGrep: false });
    expect(r).toContain("fd");
    expect(r).not.toMatch(/\bfind\b/);
  });
});

describe("BRE conversion via shell", () => {
  it("BRE alternation: command rewritten to rg", () => {
    // Input: grep with BRE pattern foo\|bar
    // translateGrepArgs converts \| → | (ERE); quote() then shell-escapes | → \|
    // Net: command is rewritten from grep to rg (the meaningful observable change)
    const r = rewritten("grep 'foo\\|bar' file.txt");
    expect(r).toMatch(/^rg/);
    expect(r).not.toMatch(/\bgrep\b/);
    expect(changed("grep 'foo\\|bar' file.txt")).toBe(true);
  });
});
