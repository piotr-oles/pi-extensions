import { describe, expect, it } from "vitest";
import { rewriteCommand } from "./shell.js";

function rewritten(cmd: string): string {
  return rewriteCommand(cmd).rewritten;
}

function changed(cmd: string): boolean {
  return rewriteCommand(cmd).changed;
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
