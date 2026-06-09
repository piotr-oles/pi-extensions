/**
 * Tests for grep→rg argument translation.
 * Ported from:
 *   - greprip-rs/tests/test_grep_to_rg.rs
 *   - greprip-rs/src/grg.rs (inline #[cfg(test)] block)
 */
import { describe, expect, it } from "vitest";
import { translateGrepArgs } from "./grep.js";

function t(args: string[]): string[] | undefined {
  return translateGrepArgs(args);
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
    expect(t(["-c", "hello", "file.txt"])).toEqual(["-c", "--include-zero", "hello", "file.txt"]);
  });

  it("only matching -o", () => {
    expect(t(["-o", "hello", "file.txt"])).toEqual(["-o", "hello", "file.txt"]);
  });

  it("quiet -q", () => {
    expect(t(["-q", "hello", "file.txt"])).toEqual(["-q", "hello", "file.txt"]);
  });

  it("fixed strings -F", () => {
    expect(t(["-F", "hello.world", "file.txt"])).toEqual(["-F", "hello.world", "file.txt"]);
  });

  it("perl regex -P", () => {
    expect(t(["-P", "\\bhello\\b", "file.txt"])).toEqual(["-P", "\\bhello\\b", "file.txt"]);
  });

  it("null separated --null", () => {
    expect(t(["-l", "--null", "hello", "dir/"])).toEqual(["-l", "--null", "hello", "dir/"]);
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
    expect(t(["--recursive", "hello", "dir/"])).toEqual(["hello", "dir/"]);
  });

  it("drops --extended-regexp", () => {
    expect(t(["--extended-regexp", "foo|bar", "file.txt"])).toEqual(["foo|bar", "file.txt"]);
  });

  it("drops --basic-regexp", () => {
    expect(t(["--basic-regexp", "hello", "file.txt"])).toEqual(["hello", "file.txt"]);
  });
});

describe("suppress errors", () => {
  it("maps -s to --no-messages", () => {
    expect(t(["-s", "hello", "file.txt"])).toEqual(["--no-messages", "hello", "file.txt"]);
  });
});

describe("combined short flags", () => {
  it("drops -r but keeps -i in -ri", () => {
    expect(t(["-ri", "hello", "dir/"])).toEqual(["-i", "hello", "dir/"]);
  });

  it("multiple separate flags -i -n", () => {
    expect(t(["-i", "-n", "hello", "file.txt"])).toEqual(["-i", "-n", "hello", "file.txt"]);
  });

  it("combined -rn drops -r keeps -n", () => {
    expect(t(["-rn", "hello", "dir/"])).toEqual(["-n", "hello", "dir/"]);
  });
});

describe("context lines", () => {
  it("after context -A", () => {
    expect(t(["-A", "3", "hello", "file.txt"])).toEqual(["-A", "3", "hello", "file.txt"]);
  });

  it("before context -B", () => {
    expect(t(["-B", "2", "hello", "file.txt"])).toEqual(["-B", "2", "hello", "file.txt"]);
  });

  it("context both sides -C", () => {
    expect(t(["-C", "5", "hello", "file.txt"])).toEqual(["-C", "5", "hello", "file.txt"]);
  });

  it("numeric shorthand -3 → -C 3", () => {
    expect(t(["-3", "hello", "file.txt"])).toEqual(["-C", "3", "hello", "file.txt"]);
  });
});

describe("explicit pattern -e", () => {
  it("single pattern with -e", () => {
    expect(t(["-e", "hello", "file.txt"])).toEqual(["-e", "hello", "file.txt"]);
  });

  it("multiple patterns with -e", () => {
    expect(t(["-e", "hello", "-e", "world", "file.txt"])).toEqual([
      "-e",
      "hello",
      "-e",
      "world",
      "file.txt",
    ]);
  });
});

describe("pattern file -f", () => {
  it("patterns from file -f", () => {
    expect(t(["-f", "patterns.txt", "file.txt"])).toEqual(["-f", "patterns.txt", "file.txt"]);
  });
});

describe("include/exclude", () => {
  it("--include=*.py → -g *.py", () => {
    expect(t(["--include=*.py", "-r", "hello", "dir/"])).toEqual(["-g", "*.py", "hello", "dir/"]);
  });

  it("--exclude=*.pyc → -g !*.pyc", () => {
    expect(t(["--exclude=*.pyc", "-r", "hello", "dir/"])).toEqual([
      "-g",
      "!*.pyc",
      "hello",
      "dir/",
    ]);
  });

  it("--exclude-dir=node_modules → -g !node_modules/", () => {
    expect(t(["--exclude-dir=node_modules", "-r", "hello", "dir/"])).toEqual([
      "-g",
      "!node_modules/",
      "hello",
      "dir/",
    ]);
  });
});

describe("long options", () => {
  it("--ignore-case", () => {
    expect(t(["--ignore-case", "hello", "file.txt"])).toEqual(["-i", "hello", "file.txt"]);
  });

  it("--line-number", () => {
    expect(t(["--line-number", "hello", "file.txt"])).toEqual(["-n", "hello", "file.txt"]);
  });

  it("--invert-match", () => {
    expect(t(["--invert-match", "hello", "file.txt"])).toEqual(["-v", "hello", "file.txt"]);
  });

  it("--word-regexp", () => {
    expect(t(["--word-regexp", "hello", "file.txt"])).toEqual(["-w", "hello", "file.txt"]);
  });

  it("--files-with-matches", () => {
    expect(t(["--files-with-matches", "hello", "dir/"])).toEqual(["-l", "hello", "dir/"]);
  });

  it("--count", () => {
    expect(t(["--count", "hello", "file.txt"])).toEqual([
      "-c",
      "--include-zero",
      "hello",
      "file.txt",
    ]);
  });

  it("--quiet", () => {
    expect(t(["--quiet", "hello", "file.txt"])).toEqual(["-q", "hello", "file.txt"]);
  });

  it("--silent", () => {
    expect(t(["--silent", "hello", "file.txt"])).toEqual(["-q", "hello", "file.txt"]);
  });

  it("--only-matching", () => {
    expect(t(["--only-matching", "hello", "file.txt"])).toEqual(["-o", "hello", "file.txt"]);
  });

  it("--no-filename", () => {
    expect(t(["--no-filename", "hello", "file.txt"])).toEqual(["-h", "hello", "file.txt"]);
  });

  it("--with-filename", () => {
    expect(t(["--with-filename", "hello", "file.txt"])).toEqual(["-H", "hello", "file.txt"]);
  });

  it("unknown long option detected, not passed through", () => {
    expect(t(["--some-unknown-flag", "hello", "file.txt"])).toBeUndefined();
  });
});

describe("color handling", () => {
  it("--color=always pass through", () => {
    expect(t(["--color=always", "hello", "file.txt"])).toEqual([
      "--color=always",
      "hello",
      "file.txt",
    ]);
  });

  it("--color=never pass through", () => {
    expect(t(["--color=never", "hello", "file.txt"])).toEqual([
      "--color=never",
      "hello",
      "file.txt",
    ]);
  });

  it("--color=auto pass through", () => {
    expect(t(["--color=auto", "hello", "file.txt"])).toEqual(["--color=auto", "hello", "file.txt"]);
  });

  it("--color alone → --color=always", () => {
    expect(t(["--color", "hello", "file.txt"])).toEqual(["--color=always", "hello", "file.txt"]);
  });
});

describe("--regexp= long option", () => {
  it("--regexp=PAT → -e PAT", () => {
    expect(t(["--regexp=hello", "file.txt"])).toEqual(["-e", "hello", "file.txt"]);
  });

  it("--regexp= with BRE alternation converts", () => {
    expect(t(["--regexp=foo\\|bar", "file.txt"])).toEqual(["-e", "foo|bar", "file.txt"]);
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
    expect(t(["-F", "foo\\|bar", "file.txt"])).toEqual(["-F", "foo\\|bar", "file.txt"]);
  });

  it("--fixed-strings suppresses BRE conversion", () => {
    expect(t(["--fixed-strings", "foo\\|bar", "file.txt"])).toEqual([
      "-F",
      "foo\\|bar",
      "file.txt",
    ]);
  });

  it("combined -Fi suppresses BRE conversion", () => {
    expect(t(["-Fi", "foo\\|bar", "file.txt"])).toEqual(["-F", "-i", "foo\\|bar", "file.txt"]);
  });

  it("-F with -e pattern suppresses conversion", () => {
    expect(t(["-F", "-e", "foo\\|bar", "file.txt"])).toEqual(["-F", "-e", "foo\\|bar", "file.txt"]);
  });
});

describe("unknown flags", () => {
  it("no unknowns for common flags", () => {
    expect(t(["-r", "-n", "hello", "file.txt"])).toEqual(["-n", "hello", "file.txt"]);
    expect(t(["-i", "hello", "file.txt"])).toEqual(["-i", "hello", "file.txt"]);
    expect(t(["--ignore-case", "hello", "file.txt"])).toEqual(["-i", "hello", "file.txt"]);
    expect(t(["--include=*.ts", "-r", "hello", "dir/"])).toEqual(["-g", "*.ts", "hello", "dir/"]);
  });

  it("unknown long option", () => {
    expect(t(["--binary-files=text", "hello", "file.txt"])).toBeUndefined();
    expect(t(["--context-separator=--", "hello", "file.txt"])).toBeUndefined();
  });

  it("-- end-of-options marker not flagged as unknown", () => {
    expect(t(["--", "hello", "file.txt"])).toEqual(["--", "hello", "file.txt"]);
  });

  it("unknown standalone short flag", () => {
    expect(t(["-x", "hello", "file.txt"])).toBeUndefined();
    expect(t(["-Z", "hello", "file.txt"])).toBeUndefined();
  });

  it("unknown char in combined short flag", () => {
    expect(t(["-rx", "hello", "dir/"])).toBeUndefined();
  });

  it("known chars in combined flag produce no unknowns", () => {
    expect(t(["-rni", "hello", "dir/"])).toEqual(["-n", "-i", "hello", "dir/"]);
    expect(t(["-rl", "hello", "dir/"])).toEqual(["-l", "hello", "dir/"]);
  });

  it("multiple unknown flags", () => {
    expect(t(["--foo", "--bar", "hello"])).toBeUndefined();
  });
});
