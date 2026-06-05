/**
 * Tests for grep→rg argument translation.
 * Ported from:
 *   - greprip-rs/tests/test_grep_to_rg.rs
 *   - greprip-rs/src/grg.rs (inline #[cfg(test)] block)
 */
import { describe, expect, it } from "vitest";
import { translateGrepArgs } from "./grep.js";

function t(args: string[]): string[] {
  return translateGrepArgs(args).args;
}

function unknowns(args: string[]): string[] {
  return translateGrepArgs(args).unknownFlags;
}

describe("basic patterns", () => {
  it("simple pattern and file", () => {
    expect(t(["hello", "file.txt"])).toEqual(["hello", "file.txt"]);
  });

  it("pattern only", () => {
    expect(t(["hello"])).toEqual(["hello"]);
  });
});

describe("common flags", () => {
  it("case insensitive -i", () => {
    expect(t(["-i", "hello", "file.txt"])).toEqual(["-i", "hello", "file.txt"]);
  });

  it("line numbers -n", () => {
    expect(t(["-n", "hello", "file.txt"])).toEqual(["-n", "hello", "file.txt"]);
  });

  it("invert match -v", () => {
    expect(t(["-v", "hello", "file.txt"])).toEqual(["-v", "hello", "file.txt"]);
  });

  it("word boundary -w", () => {
    expect(t(["-w", "foo", "file.txt"])).toEqual(["-w", "foo", "file.txt"]);
  });

  it("files with matches -l", () => {
    expect(t(["-l", "hello", "dir/"])).toEqual(["-l", "hello", "dir/"]);
  });

  it("count -c", () => {
    expect(t(["-c", "hello", "file.txt"])).toEqual(["-c", "hello", "file.txt"]);
  });

  it("only matching -o", () => {
    expect(t(["-o", "hello", "file.txt"])).toEqual(["-o", "hello", "file.txt"]);
  });

  it("quiet -q", () => {
    expect(t(["-q", "hello", "file.txt"])).toContain("-q");
  });

  it("fixed strings -F", () => {
    const result = t(["-F", "hello.world", "file.txt"]);
    expect(result).toContain("-F");
  });

  it("perl regex -P", () => {
    const result = t(["-P", "\\bhello\\b", "file.txt"]);
    expect(result).toContain("-P");
  });

  it("null separated --null", () => {
    const result = t(["-l", "--null", "hello", "dir/"]);
    expect(result).toContain("--null");
  });
});

describe("dropped flags", () => {
  it("drops -r (rg default)", () => {
    expect(t(["-r", "hello", "dir/"])).toEqual(["hello", "dir/"]);
  });

  it("drops -R", () => {
    expect(t(["-R", "hello", "dir/"])).toEqual(["hello", "dir/"]);
  });

  it("drops -E (rg default)", () => {
    expect(t(["-E", "foo|bar", "file.txt"])).toEqual(["foo|bar", "file.txt"]);
  });

  it("drops -G", () => {
    expect(t(["-G", "hello", "file.txt"])).toEqual(["hello", "file.txt"]);
  });

  it("drops --recursive", () => {
    const result = t(["--recursive", "hello", "dir/"]);
    expect(result).toContain("hello");
    expect(result).not.toContain("--recursive");
  });

  it("drops --extended-regexp", () => {
    const result = t(["--extended-regexp", "foo|bar", "file.txt"]);
    expect(result).not.toContain("--extended-regexp");
  });

  it("drops --basic-regexp", () => {
    const result = t(["--basic-regexp", "hello", "file.txt"]);
    expect(result).not.toContain("--basic-regexp");
  });
});

describe("suppress errors", () => {
  it("maps -s to --no-messages", () => {
    const result = t(["-s", "hello", "file.txt"]);
    expect(result).toContain("--no-messages");
    expect(result).not.toContain("-s");
  });
});

describe("combined short flags", () => {
  it("drops -r but keeps -i in -ri", () => {
    const result = t(["-ri", "hello", "dir/"]);
    expect(result).toContain("-i");
    expect(result).not.toContain("-r");
    expect(result).toContain("hello");
    expect(result).toContain("dir/");
  });

  it("multiple separate flags -i -n", () => {
    const result = t(["-i", "-n", "hello", "file.txt"]);
    expect(result).toContain("-i");
    expect(result).toContain("-n");
    expect(result).toContain("hello");
  });

  it("combined -rn drops -r keeps -n", () => {
    const result = t(["-rn", "hello", "dir/"]);
    expect(result).toContain("-n");
    expect(result).not.toContain("-r");
  });
});

describe("context lines", () => {
  it("after context -A", () => {
    const result = t(["-A", "3", "hello", "file.txt"]);
    expect(result).toContain("-A");
    expect(result).toContain("3");
  });

  it("before context -B", () => {
    const result = t(["-B", "2", "hello", "file.txt"]);
    expect(result).toContain("-B");
    expect(result).toContain("2");
  });

  it("context both sides -C", () => {
    const result = t(["-C", "5", "hello", "file.txt"]);
    expect(result).toContain("-C");
    expect(result).toContain("5");
  });

  it("numeric shorthand -3 → -C 3", () => {
    const result = t(["-3", "hello", "file.txt"]);
    expect(result).toContain("-C");
    expect(result).toContain("3");
    expect(result).not.toContain("-3");
  });
});

describe("explicit pattern -e", () => {
  it("single pattern with -e", () => {
    const result = t(["-e", "hello", "file.txt"]);
    expect(result).toContain("-e");
    expect(result).toContain("hello");
  });

  it("multiple patterns with -e", () => {
    const result = t(["-e", "hello", "-e", "world", "file.txt"]);
    expect(result.filter((x) => x === "-e")).toHaveLength(2);
    expect(result).toContain("hello");
    expect(result).toContain("world");
  });
});

describe("pattern file -f", () => {
  it("patterns from file -f", () => {
    const result = t(["-f", "patterns.txt", "file.txt"]);
    expect(result).toContain("-f");
    expect(result).toContain("patterns.txt");
  });
});

describe("include/exclude", () => {
  it("--include=*.py → -g *.py", () => {
    const result = t(["--include=*.py", "-r", "hello", "dir/"]);
    expect(result).toContain("-g");
    expect(result.join(" ")).toContain("*.py");
  });

  it("--exclude=*.pyc → -g !*.pyc", () => {
    const result = t(["--exclude=*.pyc", "-r", "hello", "dir/"]);
    expect(result).toContain("-g");
    expect(result.join(" ")).toContain("!*.pyc");
  });

  it("--exclude-dir=node_modules → -g !node_modules/", () => {
    const result = t(["--exclude-dir=node_modules", "-r", "hello", "dir/"]);
    expect(result).toContain("-g");
    expect(result.join(" ")).toContain("!node_modules/");
  });
});

describe("long options", () => {
  it("--ignore-case", () => {
    const result = t(["--ignore-case", "hello", "file.txt"]);
    expect(result.join(" ")).toMatch(/-i|--ignore-case/);
  });

  it("--line-number", () => {
    const result = t(["--line-number", "hello", "file.txt"]);
    expect(result.join(" ")).toMatch(/-n|--line-number/);
  });

  it("--invert-match", () => {
    const result = t(["--invert-match", "hello", "file.txt"]);
    expect(result.join(" ")).toMatch(/-v|--invert-match/);
  });

  it("--word-regexp", () => {
    const result = t(["--word-regexp", "hello", "file.txt"]);
    expect(result.join(" ")).toMatch(/-w|--word-regexp/);
  });

  it("--files-with-matches", () => {
    const result = t(["--files-with-matches", "hello", "dir/"]);
    expect(result.join(" ")).toMatch(/-l|--files-with-matches/);
  });

  it("--count", () => {
    const result = t(["--count", "hello", "file.txt"]);
    expect(result.join(" ")).toMatch(/-c|--count/);
  });

  it("--quiet", () => {
    const result = t(["--quiet", "hello", "file.txt"]);
    expect(result.join(" ")).toMatch(/-q|--quiet/);
  });

  it("--silent", () => {
    const result = t(["--silent", "hello", "file.txt"]);
    expect(result.join(" ")).toMatch(/-q|--silent/);
  });

  it("--only-matching", () => {
    const result = t(["--only-matching", "hello", "file.txt"]);
    expect(result.join(" ")).toMatch(/-o|--only-matching/);
  });

  it("--no-filename", () => {
    const result = t(["--no-filename", "hello", "file.txt"]);
    expect(result.join(" ")).toMatch(/-h|--no-filename/);
  });

  it("--with-filename", () => {
    const result = t(["--with-filename", "hello", "file.txt"]);
    expect(result.join(" ")).toMatch(/-H|--with-filename/);
  });

  it("unknown long option detected, not passed through", () => {
    expect(unknowns(["--some-unknown-flag", "hello", "file.txt"])).toContain("--some-unknown-flag");
    expect(t(["--some-unknown-flag", "hello", "file.txt"])).not.toContain("--some-unknown-flag");
  });
});

describe("color handling", () => {
  it("--color=always pass through", () => {
    const result = t(["--color=always", "hello", "file.txt"]);
    expect(result).toContain("--color=always");
  });

  it("--color=never pass through", () => {
    const result = t(["--color=never", "hello", "file.txt"]);
    expect(result).toContain("--color=never");
  });

  it("--color=auto pass through", () => {
    const result = t(["--color=auto", "hello", "file.txt"]);
    expect(result).toContain("--color=auto");
  });

  it("--color alone → --color=always", () => {
    const result = t(["--color", "hello", "file.txt"]);
    expect(result.join(" ")).toMatch(/--color=always|--color/);
  });
});

describe("--regexp= long option", () => {
  it("--regexp=PAT → -e PAT", () => {
    const result = t(["--regexp=hello", "file.txt"]);
    expect(result).toContain("-e");
    expect(result).toContain("hello");
  });

  it("--regexp= with BRE alternation converts", () => {
    const result = t(["--regexp=foo\\|bar", "file.txt"]);
    expect(result).toContain("-e");
    expect(result).toContain("foo|bar");
  });
});

describe("BRE to ERE conversion", () => {
  it("alternation \\| → |", () => {
    expect(t(["foo\\|bar", "file.txt"])).toEqual(["foo|bar", "file.txt"]);
  });

  it("one-or-more \\+ → +", () => {
    expect(t(["foo\\+", "file.txt"])).toEqual(["foo+", "file.txt"]);
  });

  it("zero-or-one \\? → ?", () => {
    expect(t(["foo\\?", "file.txt"])).toEqual(["foo?", "file.txt"]);
  });

  it("grouping \\(...\\) → (...)", () => {
    expect(t(["\\(foo\\)\\?", "file.txt"])).toEqual(["(foo)?", "file.txt"]);
  });

  it("quantifier \\{1,3\\} → {1,3}", () => {
    expect(t(["foo\\{1,3\\}", "file.txt"])).toEqual(["foo{1,3}", "file.txt"]);
  });

  it("combined operators \\(foo\\|bar\\)\\+", () => {
    expect(t(["\\(foo\\|bar\\)\\+", "file.txt"])).toEqual(["(foo|bar)+", "file.txt"]);
  });

  it("BRE conversion applied to -e pattern", () => {
    expect(t(["-e", "foo\\|bar", "file.txt"])).toEqual(["-e", "foo|bar", "file.txt"]);
  });
});

describe("fixed strings skip BRE conversion", () => {
  it("-F suppresses BRE conversion on positional pattern", () => {
    const result = t(["-F", "foo\\|bar", "file.txt"]);
    expect(result).toContain("foo\\|bar");
  });

  it("--fixed-strings suppresses BRE conversion", () => {
    const result = t(["--fixed-strings", "foo\\|bar", "file.txt"]);
    expect(result).toContain("foo\\|bar");
  });

  it("combined -Fi suppresses BRE conversion", () => {
    const result = t(["-Fi", "foo\\|bar", "file.txt"]);
    expect(result).toContain("foo\\|bar");
  });

  it("-F with -e pattern suppresses conversion", () => {
    const result = t(["-F", "-e", "foo\\|bar", "file.txt"]);
    expect(result).toContain("foo\\|bar");
    expect(result).not.toContain("foo|bar");
  });
});

describe("unknown flags", () => {
  it("no unknowns for common flags", () => {
    expect(unknowns(["-r", "-n", "hello", "file.txt"])).toHaveLength(0);
    expect(unknowns(["-i", "hello", "file.txt"])).toHaveLength(0);
    expect(unknowns(["--ignore-case", "hello", "file.txt"])).toHaveLength(0);
    expect(unknowns(["--include=*.ts", "-r", "hello", "dir/"])).toHaveLength(0);
  });

  it("unknown long option reported", () => {
    expect(unknowns(["--binary-files=text", "hello", "file.txt"])).toContain("--binary-files=text");
    expect(unknowns(["--context-separator=--", "hello", "file.txt"])).toContain("--context-separator=--");
  });

  it("-- end-of-options marker not flagged as unknown", () => {
    expect(unknowns(["--", "hello", "file.txt"])).toHaveLength(0);
  });

  it("unknown standalone short flag reported", () => {
    expect(unknowns(["-x", "hello", "file.txt"])).toContain("-x");
    expect(unknowns(["-Z", "hello", "file.txt"])).toContain("-Z");
  });

  it("unknown char in combined short flag reported", () => {
    expect(unknowns(["-rx", "hello", "dir/"])).toContain("-x");
  });

  it("known chars in combined flag produce no unknowns", () => {
    expect(unknowns(["-rni", "hello", "dir/"])).toHaveLength(0);
    expect(unknowns(["-rl", "hello", "dir/"])).toHaveLength(0);
  });

  it("multiple unknown flags all reported", () => {
    const u = unknowns(["--foo", "--bar", "hello"]);
    expect(u).toContain("--foo");
    expect(u).toContain("--bar");
  });

  it("unknown flag excluded from translated args", () => {
    expect(t(["-x", "hello", "file.txt"])).not.toContain("-x");
    expect(t(["--foo", "hello", "file.txt"])).not.toContain("--foo");
  });
});
