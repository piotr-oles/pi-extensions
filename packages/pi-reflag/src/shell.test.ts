import { describe, expect, it } from "vitest";
import { rewriteBash } from "./shell.js";

describe("no grep — unchanged", () => {
  it("no grep at all", async () => {
    expect(await rewriteBash("echo hello")).toEqual("echo hello");
  });

  it("grep in middle of segment (not first token)", async () => {
    expect(await rewriteBash("echo grep")).toEqual("echo grep");
  });

  it("absolute path grep", async () => {
    expect(await rewriteBash("/usr/bin/grep pattern file.txt")).toEqual(
      "/usr/bin/grep pattern file.txt",
    );
  });

  it("rg command untouched", async () => {
    expect(await rewriteBash("rg pattern src/")).toEqual("rg pattern src/");
  });
});

describe("simple grep rewrites", () => {
  it("pattern and file", async () => {
    expect(await rewriteBash("grep hello file.txt")).toEqual("rg hello file.txt");
  });

  it("recursive flag dropped", async () => {
    expect(await rewriteBash("grep -rn hello src/")).toEqual("rg -n hello src/");
  });

  it("case insensitive kept", async () => {
    expect(await rewriteBash("grep -i hello file.txt")).toEqual("rg -i hello file.txt");
  });

  it("extended regex flag dropped", async () => {
    expect(await rewriteBash('grep -E "foo|bar" file.txt')).toEqual('rg "foo|bar" file.txt');
  });

  it("quoted pattern preserved as single arg", async () => {
    expect(await rewriteBash("grep 'hello world' file.txt")).toEqual("rg 'hello world' file.txt");
  });
});

describe("pipeline rewrites", () => {
  it("grep after pipe", async () => {
    expect(await rewriteBash("cat file.txt | grep hello")).toEqual("cat file.txt | rg hello");
  });

  it("both sides of pipe are grep", async () => {
    expect(await rewriteBash("grep foo file.txt | grep bar")).toEqual("rg foo file.txt | rg bar");
  });

  it("only second segment is grep", async () => {
    expect(await rewriteBash("echo something | grep pattern")).toEqual(
      "echo something | rg pattern",
    );
  });
});

describe("shell operators", () => {
  it("grep with && operator", async () => {
    expect(await rewriteBash("grep foo file.txt && echo done")).toEqual(
      "rg foo file.txt && echo done",
    );
  });

  it("grep with ; separator", async () => {
    expect(await rewriteBash("grep foo file.txt ; grep bar file.txt")).toEqual(
      "rg foo file.txt ; rg bar file.txt",
    );
  });

  it("grep with || operator", async () => {
    expect(await rewriteBash("grep foo file.txt || echo not found")).toEqual(
      "rg foo file.txt || echo not found",
    );
  });
});

describe("no find — unchanged", () => {
  it("no find at all", async () => {
    expect(await rewriteBash("echo hello")).toEqual("echo hello");
  });

  it("find in non-initial position", async () => {
    expect(await rewriteBash("echo find")).toEqual("echo find");
  });

  it("absolute path find untouched", async () => {
    expect(await rewriteBash("/usr/bin/find . -name '*.ts'")).toEqual(
      "/usr/bin/find . -name '*.ts'",
    );
  });

  it("fd command untouched", async () => {
    expect(await rewriteBash("fd '*.ts' src/")).toEqual("fd '*.ts' src/");
  });
});

describe("simple find rewrites", () => {
  it("find . -name rewrites to fd", async () => {
    expect(await rewriteBash("find . -name '*.ts'")).toEqual("fd -H -g '*.ts'");
  });

  it("find with path", async () => {
    expect(await rewriteBash("find packages/ -name 'index.ts'")).toEqual(
      "fd -H -g 'index.ts' packages/",
    );
  });

  it("-maxdepth translated", async () => {
    expect(await rewriteBash("find . -maxdepth 2 -name '*.json'")).toEqual(
      "fd -H -d 2 -g '*.json'",
    );
  });

  it("-type f kept", async () => {
    expect(await rewriteBash("find . -type f -name '*.ts'")).toEqual("fd -H -t f -g '*.ts'");
  });
});

describe("find pipeline rewrites", () => {
  it("find piped to another command", async () => {
    expect(await rewriteBash("find . -name '*.ts' | xargs wc -l")).toEqual(
      "fd -H -g '*.ts' | xargs wc -l",
    );
  });

  it("grep and find both in pipeline rewriteBash", async () => {
    expect(await rewriteBash("find . -name '*.ts' | grep import")).toEqual(
      "fd -H -g '*.ts' | rg import",
    );
  });
});

describe("unknown flag fallback", () => {
  it("unknown grep long flag → not rewriteBash, unknown reported", async () => {
    expect(await rewriteBash("grep --binary-files=text hello file.txt")).toEqual(
      "grep --binary-files=text hello file.txt",
    );
  });

  it("unknown grep short flag → not rewriteBash, unknown reported", async () => {
    expect(await rewriteBash("grep -x hello file.txt")).toEqual("grep -x hello file.txt");
  });

  it("unknown find flag → not rewriteBash, unknown reported", async () => {
    expect(await rewriteBash("find . -samefile other.txt")).toEqual("find . -samefile other.txt");
  });

  it("unknown find flag → not rewriteBash, unknown reported", async () => {
    expect(await rewriteBash("find . -inum 12345")).toEqual("find . -inum 12345");
  });

  it("known-only grep → still rewriteBash, no unknowns", async () => {
    expect(await rewriteBash("grep -rn hello src/")).toEqual("rg -n hello src/");
  });

  it("known-only find → still rewriteBash, no unknowns", async () => {
    expect(await rewriteBash("find . -type f -name '*.ts'")).toEqual("fd -H -t f -g '*.ts'");
  });

  it("pipeline: grep unknown falls back, find known still rewrites", async () => {
    expect(await rewriteBash("find . -name '*.ts' | grep --binary-files=text import")).toEqual(
      "fd -H -g '*.ts' | grep --binary-files=text import",
    );
  });

  it("pipeline: find unknown falls back, grep known still rewrites", async () => {
    expect(await rewriteBash("find . -samefile other | grep pattern")).toEqual(
      "find . -samefile other | rg pattern",
    );
  });
});

describe("redirect handling", () => {
  it("2>/dev/null — exact bug repro with pipeline", async () => {
    expect(
      await rewriteBash(
        `grep -r "foo.bar" /some/path --include="*.proto" -l 2>/dev/null | head -20`,
      ),
    ).toEqual('rg "foo.bar" /some/path -g "*.proto" -l 2>/dev/null | head -20');
  });

  it("2>/dev/null plain", async () => {
    expect(await rewriteBash("grep foo dir 2>/dev/null")).toEqual("rg foo dir 2>/dev/null");
  });

  it(">/dev/null plain redirect", async () => {
    expect(await rewriteBash("grep foo dir >/dev/null")).toEqual("rg foo dir >/dev/null");
  });

  it("2>&1", async () => {
    expect(await rewriteBash("grep foo dir 2>&1")).toEqual("rg foo dir 2>&1");
  });

  it("1>/dev/null 2>&1 (two redirects)", async () => {
    expect(await rewriteBash("grep foo dir 1>/dev/null 2>&1")).toEqual(
      "rg foo dir 1>/dev/null 2>&1",
    );
  });

  it("2>/dev/null piped to wc", async () => {
    expect(await rewriteBash("grep foo dir 2>/dev/null | wc -l")).toEqual(
      "rg foo dir 2>/dev/null | wc -l",
    );
  });
});

describe("xargs grep rewrites", () => {
  it("xargs grep basic", async () => {
    expect(await rewriteBash("xargs grep -l pattern")).toEqual("xargs rg -l pattern");
  });

  it("find piped to xargs grep", async () => {
    expect(await rewriteBash("find . -name '*.ts' | xargs grep -l 'tool_call'")).toEqual(
      "fd -H -g '*.ts' | xargs rg -l 'tool_call'",
    );
  });

  it("xargs grep with recursive flag dropped", async () => {
    expect(await rewriteBash("xargs grep -rn pattern")).toEqual("xargs rg -n pattern");
  });
});

describe("BRE conversion via shell", () => {
  it("BRE alternation: \\| converted to | within original shell quoting", async () => {
    expect(await rewriteBash("grep 'foo\\|bar' file.txt")).toEqual("rg 'foo|bar' file.txt");
  });

  it("literal ( escaped to \\(", async () => {
    expect(await rewriteBash('grep "foo(bar)" file.txt')).toEqual('rg "foo\\(bar\\)" file.txt');
  });

  it("literal | escaped to \\|", async () => {
    expect(await rewriteBash('grep "a|b" file.txt')).toEqual('rg "a\\|b" file.txt');
  });

  it("-E: ERE pattern parens not escaped", async () => {
    expect(await rewriteBash('grep -E "foo(bar)" file.txt')).toEqual('rg "foo(bar)" file.txt');
  });

  it("BRE \\| and literal ( mixed", async () => {
    expect(await rewriteBash('grep "maxTurns\\|\\.run(" file')).toEqual(
      'rg "maxTurns|\\.run\\(" file',
    );
  });
});
