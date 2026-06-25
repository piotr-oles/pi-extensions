/**
 * Tests for find→fd argument translation.
 * Cases ported from:
 *   - kaofelix/greprip-rs tests/test_find_to_fd.rs
 *   - kluzzebass/reflag translator/find2fd/translator_test.go
 */
import { describe, expect, it } from "vitest";
import { translateFindArgs } from "./find.js";

function t(args: string[]): string[] | undefined {
  return translateFindArgs(args);
}

describe("hidden files", () => {
  it("always adds -H to match find default", () => {
    expect(t([".", "-name", "*.ts"])).toEqual(["-H", "-g", "*.ts"]);
  });

  it("adds -H even with no args", () => {
    expect(t([])).toEqual(["-H"]);
  });
});

describe("path handling", () => {
  it("skips . (fd defaults to current dir)", () => {
    expect(t([".", "-name", "*.ts"])).toEqual(["-H", "-g", "*.ts"]);
  });

  it("passes through specific path", () => {
    expect(t(["/some/path", "-name", "*.ts"])).toEqual(["-H", "-g", "*.ts", "/some/path"]);
  });

  it("passes through multiple paths", () => {
    expect(t(["/tmp", "/var/tmp", "-type", "f"])).toEqual([
      "-H",
      "-t",
      "f",
      ".",
      "/tmp",
      "/var/tmp",
    ]);
  });

  it("path comes after pattern in output", () => {
    expect(t(["/some/path", "-name", "*.ts"])).toEqual(["-H", "-g", "*.ts", "/some/path"]);
  });

  it("adds . match-all pattern when path present but no name filter", () => {
    expect(t(["/tmp", "-type", "f"])).toEqual(["-H", "-t", "f", ".", "/tmp"]);
  });

  it("no match-all . added when no explicit path and no pattern", () => {
    expect(t([".", "-type", "f"])).toEqual(["-H", "-t", "f"]);
  });
});

describe("-name patterns", () => {
  it("single -name → -g glob", () => {
    expect(t([".", "-name", "*.ts"])).toEqual(["-H", "-g", "*.ts"]);
  });

  it("-name exact filename", () => {
    expect(t([".", "-name", "Makefile"])).toEqual(["-H", "-g", "Makefile"]);
  });

  it("-name compound extension", () => {
    expect(t([".", "-name", "*.tar.gz"])).toEqual(["-H", "-g", "*.tar.gz"]);
  });

  it("multiple -name OR'd → brace expansion", () => {
    expect(t([".", "-name", "*.ts", "-o", "-name", "*.tsx"])).toEqual(["-H", "-g", "{*.ts,*.tsx}"]);
  });

  it("three -name patterns OR'd", () => {
    expect(
      t([
        ".",
        "-name",
        ".ruby-version",
        "-o",
        "-name",
        ".tool-versions",
        "-o",
        "-name",
        "mise.toml",
      ]),
    ).toEqual(["-H", "-g", "{.ruby-version,.tool-versions,mise.toml}"]);
  });

  it("-iname → -i flag + -g glob", () => {
    expect(t([".", "-iname", "*.TXT"])).toEqual(["-H", "-i", "-g", "*.TXT"]);
  });

  it("-iname positions -i before pattern", () => {
    expect(t([".", "-iname", "readme*"])).toEqual(["-H", "-i", "-g", "readme*"]);
  });
});

describe("negation", () => {
  it("! -name PAT → -E PAT", () => {
    expect(t([".", "!", "-name", "*.pyc"])).toEqual(["-H", "-E", "*.pyc"]);
  });

  it("-not -name PAT → -E PAT", () => {
    expect(t([".", "-not", "-name", "*.pyc"])).toEqual(["-H", "-E", "*.pyc"]);
  });

  it("! -path ./build → strips leading ./ → fd -H -E build", () => {
    expect(t([".", "!", "-path", "./build"])).toEqual(["-H", "-E", "build"]);
  });

  it("! -path ./build/* → strips leading ./ and trailing /* → fd -H -E build", () => {
    expect(t([".", "!", "-path", "./build/*"])).toEqual(["-H", "-E", "build"]);
  });
});

describe("type filter", () => {
  it("-type f → -t f", () => {
    expect(t([".", "-type", "f"])).toEqual(["-H", "-t", "f"]);
  });

  it("-type d → -t d", () => {
    expect(t([".", "-type", "d"])).toEqual(["-H", "-t", "d"]);
  });

  it("-type l → -t l", () => {
    expect(t([".", "-type", "l"])).toEqual(["-H", "-t", "l"]);
  });
});

describe("depth", () => {
  it("-maxdepth N → -d N", () => {
    expect(t([".", "-maxdepth", "2"])).toEqual(["-H", "-d", "2"]);
  });

  it("-mindepth N → --min-depth N", () => {
    expect(t([".", "-mindepth", "1"])).toEqual(["-H", "--min-depth", "1"]);
  });

  it("both -mindepth and -maxdepth", () => {
    expect(t([".", "-mindepth", "2", "-maxdepth", "4"])).toEqual([
      "-H",
      "--min-depth",
      "2",
      "-d",
      "4",
    ]);
  });
});

describe("exec", () => {
  it("-exec cmd {} ; → -x cmd {}", () => {
    expect(t([".", "-name", "*.py", "-exec", "wc", "-l", "{}", ";"])).toEqual([
      "-H",
      "-g",
      "*.py",
      "-x",
      "wc",
      "-l",
      "{}",
    ]);
  });

  it("-exec cmd {} + → -X cmd {}", () => {
    expect(t([".", "-type", "f", "-exec", "chmod", "644", "{}", "+"])).toEqual([
      "-H",
      "-t",
      "f",
      "-X",
      "chmod",
      "644",
      "{}",
    ]);
  });

  it("exec args come after paths", () => {
    expect(t(["/path", "-name", "*.ts", "-exec", "cat", "{}", ";"])).toEqual([
      "-H",
      "-g",
      "*.ts",
      "/path",
      "-x",
      "cat",
      "{}",
    ]);
  });

  it("-execdir treated same as -exec", () => {
    expect(t([".", "-execdir", "echo", "{}", ";"])).toEqual(["-H", "-x", "echo", "{}"]);
  });
});

describe("output flags", () => {
  it("-print0 → -0", () => {
    expect(t([".", "-name", "*.txt", "-print0"])).toEqual(["-H", "-0", "-g", "*.txt"]);
  });

  it("-print is dropped", () => {
    expect(t([".", "-name", "*.txt", "-print"])).toEqual(["-H", "-g", "*.txt"]);
  });
});

describe("symlink flags", () => {
  it("-L before path → -L in output", () => {
    expect(t(["-L", ".", "-name", "*.txt"])).toEqual(["-H", "-L", "-g", "*.txt"]);
  });

  it("-follow → -L", () => {
    expect(t(["-follow", ".", "-name", "*.txt"])).toEqual(["-H", "-L", "-g", "*.txt"]);
  });

  it("-L in expression position → -L", () => {
    expect(t([".", "-L", "-name", "*.txt"])).toEqual(["-H", "-L", "-g", "*.txt"]);
  });
});

describe("time filters", () => {
  it("-mtime -7 → --changed-within 7d", () => {
    expect(t([".", "-mtime", "-7"])).toEqual(["-H", "--changed-within", "7d"]);
  });

  it("-mtime +30 → --changed-before 30d", () => {
    expect(t([".", "-mtime", "+30"])).toEqual(["-H", "--changed-before", "30d"]);
  });

  it("-atime bails (access time != mtime)", () => {
    expect(t([".", "-atime", "-1"])).toBeUndefined();
  });

  it("-ctime bails (inode change time != mtime)", () => {
    expect(t([".", "-ctime", "+7"])).toBeUndefined();
  });

  it("-mmin -60 → --changed-within 60min", () => {
    expect(t([".", "-mmin", "-60"])).toEqual(["-H", "--changed-within", "60min"]);
  });

  it("-amin bails (access time != mtime)", () => {
    expect(t([".", "-amin", "+30"])).toBeUndefined();
  });

  it("-cmin bails (inode change time != mtime)", () => {
    expect(t([".", "-cmin", "-10"])).toBeUndefined();
  });

  it("-mtime 7 (unsigned) bails — semantics differ from fd", () => {
    expect(t([".", "-mtime", "7"])).toBeUndefined();
  });

  it("-mtime 0 (unsigned) bails", () => {
    expect(t([".", "-mtime", "0"])).toBeUndefined();
  });
});

describe("size", () => {
  it("-size +1M → -S +1M", () => {
    expect(t([".", "-size", "+1M"])).toEqual(["-H", "-S", "+1M"]);
  });

  it("-size +100M", () => {
    expect(t([".", "-type", "f", "-size", "+100M"])).toEqual(["-H", "-t", "f", "-S", "+100M"]);
  });
});

describe("newer", () => {
  it("-newer file → --newer file", () => {
    expect(t([".", "-newer", "go.mod"])).toEqual(["-H", "--newer", "go.mod"]);
  });
});

describe("user and group", () => {
  it("-user root → --owner root", () => {
    expect(t([".", "-user", "root"])).toEqual(["-H", "--owner", "root"]);
  });

  it("-group wheel → --owner :wheel", () => {
    expect(t([".", "-group", "wheel"])).toEqual(["-H", "--owner", ":wheel"]);
  });
});

describe("-path expression", () => {
  it("-path PAT -prune → -E with stripped pattern", () => {
    expect(t([".", "-path", "*/.git", "-prune"])).toEqual(["-H", "-E", ".git"]);
  });

  it("-path PAT without -prune → -p PAT", () => {
    expect(t([".", "-path", "*/test/*"])).toEqual(["-H", "-p", "*/test/*"]);
  });
});

describe("regex patterns", () => {
  it("-regex PAT → pattern without -g", () => {
    expect(t([".", "-regex", ".*\\.go$"])).toEqual(["-H", ".*\\.go$"]);
  });

  it("-iregex PAT → -i + pattern without -g", () => {
    expect(t([".", "-iregex", ".*\\.GO$"])).toEqual(["-H", "-i", ".*\\.GO$"]);
  });

  it("-name takes priority over -regex", () => {
    expect(t([".", "-name", "*.ts", "-regex", ".*\\.go$"])).toEqual(["-H", "-g", "*.ts"]);
  });
});

describe("misc flags", () => {
  it("-empty → -t e", () => {
    expect(t([".", "-empty"])).toEqual(["-H", "-t", "e"]);
  });

  it("-executable → -t x", () => {
    expect(t([".", "-executable"])).toEqual(["-H", "-t", "x"]);
  });

  it("-xdev → --one-file-system", () => {
    expect(t([".", "-xdev"])).toEqual(["-H", "--one-file-system"]);
  });

  it("-mount → --one-file-system", () => {
    expect(t([".", "-mount"])).toEqual(["-H", "--one-file-system"]);
  });

  it("-quit → -1", () => {
    expect(t([".", "-name", "*.go", "-quit"])).toEqual(["-H", "-1", "-g", "*.go"]);
  });

  it("-print dropped", () => {
    expect(t([".", "-print"])).toEqual(["-H"]);
  });

  it("-prune dropped", () => {
    expect(t([".", "-prune"])).toEqual(["-H"]);
  });

  it("-perm bails (no fd equivalent)", () => {
    expect(t([".", "-perm", "-755"])).toBeUndefined();
  });

  it("unknown flag not forwarded to output", () => {
    expect(t([".", "-samefile", "other.txt"])).toBeUndefined();
  });

  it("logical operators (, ), -o, -a dropped", () => {
    expect(t([".", "(", "-name", "*.ts", "-o", "-name", "*.tsx", ")"])).toEqual([
      "-H",
      "-g",
      "{*.ts,*.tsx}",
    ]);
  });
});

describe("combined real-world patterns", () => {
  it("find . -type f -name '*.ts'", () => {
    expect(t([".", "-type", "f", "-name", "*.ts"])).toEqual(["-H", "-t", "f", "-g", "*.ts"]);
  });

  it("find . -type d -name node_modules", () => {
    expect(t([".", "-type", "d", "-name", "node_modules"])).toEqual([
      "-H",
      "-t",
      "d",
      "-g",
      "node_modules",
    ]);
  });

  it("find . -maxdepth 2 -name '*.json'", () => {
    expect(t([".", "-maxdepth", "2", "-name", "*.json"])).toEqual([
      "-H",
      "-d",
      "2",
      "-g",
      "*.json",
    ]);
  });

  it("find /var/log -name '*.log' -mtime -1", () => {
    expect(t(["/var/log", "-name", "*.log", "-mtime", "-1"])).toEqual([
      "-H",
      "--changed-within",
      "1d",
      "-g",
      "*.log",
      "/var/log",
    ]);
  });

  it("find /path -maxdepth 3 -name a -o -name b", () => {
    expect(
      t(["/path", "-maxdepth", "3", "-name", ".ruby-version", "-o", "-name", ".tool-versions"]),
    ).toEqual(["-H", "-d", "3", "-g", "{.ruby-version,.tool-versions}", "/path"]);
  });

  it("find . \\( -type f \\) -exec wc {} + (parens + batch exec)", () => {
    expect(t([".", "(", "-type", "f", ")", "-exec", "wc", "{}", "+"])).toEqual([
      "-H",
      "-t",
      "f",
      "-X",
      "wc",
      "{}",
    ]);
  });

  it("find . \\( -name '*.ts' -o -name '*.tsx' \\) -type f (parens + OR)", () => {
    expect(t([".", "(", "-name", "*.ts", "-o", "-name", "*.tsx", ")", "-type", "f"])).toEqual([
      "-H",
      "-t",
      "f",
      "-g",
      "{*.ts,*.tsx}",
    ]);
  });

  it("find . -type f -name '*.log' -mtime +7 (old logs)", () => {
    expect(t([".", "-type", "f", "-name", "*.log", "-mtime", "+7"])).toEqual([
      "-H",
      "-t",
      "f",
      "--changed-before",
      "7d",
      "-g",
      "*.log",
    ]);
  });
});

describe("negation bail", () => {
  it("! -type d bails — unsupported negation target", () => {
    expect(t([".", "!", "-type", "d"])).toBeUndefined();
  });

  it("-not -type f bails — unsupported negation target", () => {
    expect(t([".", "-not", "-type", "f"])).toBeUndefined();
  });

  it("! alone (no following arg) bails", () => {
    expect(t([".", "!"])).toBeUndefined();
  });
});

describe("comma in glob pattern", () => {
  it("-name 'foo,bar' bails — comma corrupts brace expansion", () => {
    expect(t([".", "-name", "foo,bar"])).toBeUndefined();
  });

  it("-name 'a,b' -o -name '*.ts' bails — comma in first pattern", () => {
    expect(t([".", "-name", "a,b", "-o", "-name", "*.ts"])).toBeUndefined();
  });
});

describe("mixed -iname/-name", () => {
  it("-iname '*.TXT' -name '*.ts' bails — fd can't mix case sensitivity per pattern", () => {
    expect(t([".", "-iname", "*.TXT", "-name", "*.ts"])).toBeUndefined();
  });

  it("-name '*.ts' -iname '*.TXT' bails — order doesn't matter", () => {
    expect(t([".", "-name", "*.ts", "-iname", "*.TXT"])).toBeUndefined();
  });

  it("-iname alone still works", () => {
    expect(t([".", "-iname", "*.TXT"])).toEqual(["-H", "-i", "-g", "*.TXT"]);
  });

  it("-name alone still works", () => {
    expect(t([".", "-name", "*.ts"])).toEqual(["-H", "-g", "*.ts"]);
  });
});

describe("size translation", () => {
  it("-size +1c translates c → b (bytes)", () => {
    expect(t([".", "-size", "+1c"])).toEqual(["-H", "-S", "+1b"]);
  });

  it("-size -100c translates c → b", () => {
    expect(t([".", "-size", "-100c"])).toEqual(["-H", "-S", "-100b"]);
  });

  it("-size +1k bails — 512-byte blocks vs 1024-byte kibibytes differ", () => {
    expect(t([".", "-size", "+1k"])).toBeUndefined();
  });

  it("-size +1M passes through unchanged", () => {
    expect(t([".", "-size", "+1M"])).toEqual(["-H", "-S", "+1M"]);
  });
});

describe("unknown flags", () => {
  it("-samefile reported as unknown", () => {
    expect(t([".", "-samefile", "other.txt"])).toBeUndefined();
  });

  it("-inum reported as unknown", () => {
    expect(t([".", "-inum", "12345"])).toBeUndefined();
  });

  it("-links reported as unknown", () => {
    expect(t([".", "-links", "2"])).toBeUndefined();
  });

  it("-nouser reported as unknown", () => {
    expect(t([".", "-nouser"])).toBeUndefined();
  });

  it("multiple unknowns", () => {
    expect(t([".", "-samefile", "f", "-inum", "123"])).toBeUndefined();
  });

  it("logical operators not flagged as unknown", () => {
    expect(t([".", "(", "-name", "*.ts", "-o", "-name", "*.tsx", ")"])).toEqual([
      "-H",
      "-g",
      "{*.ts,*.tsx}",
    ]);
    expect(t([".", "-name", "*.ts", "-a", "-type", "f"])).toEqual(["-H", "-t", "f", "-g", "*.ts"]);
  });

  it("known-but-dropped expressions not flagged (-print, -prune, -depth)", () => {
    expect(t([".", "-print"])).toEqual(["-H"]);
    expect(t([".", "-prune"])).toEqual(["-H"]);
    expect(t([".", "-depth"])).toEqual(["-H"]);
    expect(t([".", "-daystart"])).toEqual(["-H"]);
  });

  it("-delete bails — silently dropping it would execute wrong command", () => {
    expect(t([".", "-name", "*.log", "-delete"])).toBeUndefined();
    expect(t([".", "-delete"])).toBeUndefined();
  });
});

describe("noIgnore param", () => {
  it("noIgnore=true adds --no-ignore after -H", () => {
    expect(translateFindArgs([".", "-name", "*.py"], true)).toEqual([
      "-H",
      "--no-ignore",
      "-g",
      "*.py",
    ]);
  });

  it("noIgnore=false (default) omits --no-ignore", () => {
    expect(translateFindArgs([".", "-name", "*.py"])).toEqual(["-H", "-g", "*.py"]);
  });
});
