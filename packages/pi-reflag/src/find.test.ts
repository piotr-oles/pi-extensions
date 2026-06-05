/**
 * Tests for find→fd argument translation.
 * Cases ported from:
 *   - kaofelix/greprip-rs tests/test_find_to_fd.rs
 *   - kluzzebass/reflag translator/find2fd/translator_test.go
 */
import { describe, expect, it } from "vitest";
import { translateFindArgs } from "./find.js";

function t(args: string[]): string[] {
  return translateFindArgs(args);
}

describe("hidden files", () => {
  it("always adds -H to match find default", () => {
    expect(t([".", "-name", "*.ts"])).toContain("-H");
  });

  it("adds -H even with no args", () => {
    expect(t([])).toContain("-H");
  });
});

describe("path handling", () => {
  it("skips . (fd defaults to current dir)", () => {
    const r = t([".", "-name", "*.ts"]);
    // Only -H itself should precede flags; no bare . in output
    const dotPositions = r.flatMap((x, idx) => (x === "." ? [idx] : []));
    // If . appears, it must be the match-all pattern before a path, not a duplicate
    // Since we have a pattern via -g, there should be no bare .
    expect(dotPositions).toHaveLength(0);
  });

  it("passes through specific path", () => {
    const r = t(["/some/path", "-name", "*.ts"]);
    expect(r).toContain("/some/path");
  });

  it("passes through multiple paths", () => {
    const r = t(["/tmp", "/var/tmp", "-type", "f"]);
    expect(r).toContain("/tmp");
    expect(r).toContain("/var/tmp");
  });

  it("path comes after pattern in output", () => {
    const r = t(["/some/path", "-name", "*.ts"]);
    const gIdx = r.indexOf("-g");
    const pathIdx = r.indexOf("/some/path");
    expect(gIdx).toBeGreaterThan(-1);
    expect(pathIdx).toBeGreaterThan(gIdx + 1);
  });

  it("adds . match-all pattern when path present but no name filter", () => {
    const r = t(["/tmp", "-type", "f"]);
    const dotIdx = r.indexOf(".");
    const pathIdx = r.indexOf("/tmp");
    expect(dotIdx).toBeGreaterThan(-1);
    expect(pathIdx).toBeGreaterThan(dotIdx);
  });

  it("no match-all . added when no explicit path and no pattern", () => {
    const r = t([".", "-type", "f"]);
    expect(r).not.toContain(".");
  });
});

describe("-name patterns", () => {
  it("single -name → -g glob", () => {
    const r = t([".", "-name", "*.ts"]);
    const gIdx = r.indexOf("-g");
    expect(gIdx).toBeGreaterThan(-1);
    expect(r[gIdx + 1]).toBe("*.ts");
  });

  it("-name exact filename", () => {
    const r = t([".", "-name", "Makefile"]);
    expect(r).toContain("-g");
    expect(r).toContain("Makefile");
  });

  it("-name compound extension", () => {
    const r = t([".", "-name", "*.tar.gz"]);
    expect(r).toContain("-g");
    expect(r).toContain("*.tar.gz");
  });

  it("multiple -name OR'd → brace expansion", () => {
    const r = t([".", "-name", "*.ts", "-o", "-name", "*.tsx"]);
    const gIdx = r.indexOf("-g");
    expect(gIdx).toBeGreaterThan(-1);
    expect(r[gIdx + 1]).toBe("{*.ts,*.tsx}");
  });

  it("three -name patterns OR'd", () => {
    const r = t([".", "-name", ".ruby-version", "-o", "-name", ".tool-versions", "-o", "-name", "mise.toml"]);
    const gIdx = r.indexOf("-g");
    expect(gIdx).toBeGreaterThan(-1);
    expect(r[gIdx + 1]).toBe("{.ruby-version,.tool-versions,mise.toml}");
  });

  it("-iname → -i flag + -g glob", () => {
    const r = t([".", "-iname", "*.TXT"]);
    expect(r).toContain("-i");
    expect(r).toContain("-g");
    expect(r).toContain("*.TXT");
  });

  it("-iname positions -i before pattern", () => {
    const r = t([".", "-iname", "readme*"]);
    const iIdx = r.indexOf("-i");
    const gIdx = r.indexOf("-g");
    expect(iIdx).toBeGreaterThan(-1);
    expect(gIdx).toBeGreaterThan(iIdx);
  });
});

describe("negation", () => {
  it("! -name PAT → -E PAT", () => {
    const r = t([".", "!", "-name", "*.pyc"]);
    expect(r).toContain("-E");
    expect(r).toContain("*.pyc");
  });

  it("-not -name PAT → -E PAT", () => {
    const r = t([".", "-not", "-name", "*.pyc"]);
    expect(r).toContain("-E");
    expect(r).toContain("*.pyc");
  });
});

describe("type filter", () => {
  it("-type f → -t f", () => {
    const r = t([".", "-type", "f"]);
    expect(r).toContain("-t");
    expect(r[r.indexOf("-t") + 1]).toBe("f");
  });

  it("-type d → -t d", () => {
    const r = t([".", "-type", "d"]);
    expect(r).toContain("-t");
    expect(r[r.indexOf("-t") + 1]).toBe("d");
  });

  it("-type l → -t l", () => {
    const r = t([".", "-type", "l"]);
    expect(r).toContain("-t");
    expect(r[r.indexOf("-t") + 1]).toBe("l");
  });
});

describe("depth", () => {
  it("-maxdepth N → -d N", () => {
    const r = t([".", "-maxdepth", "2"]);
    expect(r).toContain("-d");
    expect(r[r.indexOf("-d") + 1]).toBe("2");
  });

  it("-mindepth N → --min-depth N", () => {
    const r = t([".", "-mindepth", "1"]);
    expect(r).toContain("--min-depth");
    expect(r[r.indexOf("--min-depth") + 1]).toBe("1");
  });

  it("both -mindepth and -maxdepth", () => {
    const r = t([".", "-mindepth", "2", "-maxdepth", "4"]);
    expect(r).toContain("--min-depth");
    expect(r).toContain("-d");
    expect(r[r.indexOf("--min-depth") + 1]).toBe("2");
    expect(r[r.indexOf("-d") + 1]).toBe("4");
  });
});

describe("exec", () => {
  it("-exec cmd {} ; → -x cmd {}", () => {
    const r = t([".", "-name", "*.py", "-exec", "wc", "-l", "{}", ";"]);
    expect(r).toContain("-x");
    expect(r).toContain("wc");
    expect(r).toContain("-l");
    expect(r).toContain("{}");
  });

  it("-exec cmd {} + → -X cmd {}", () => {
    const r = t([".", "-type", "f", "-exec", "chmod", "644", "{}", "+"]);
    expect(r).toContain("-X");
    expect(r).toContain("chmod");
    expect(r).toContain("644");
  });

  it("exec args come after paths", () => {
    const r = t(["/path", "-name", "*.ts", "-exec", "cat", "{}", ";"]);
    const pathIdx = r.indexOf("/path");
    const xIdx = r.indexOf("-x");
    expect(xIdx).toBeGreaterThan(pathIdx);
  });

  it("-execdir treated same as -exec", () => {
    const r = t([".", "-execdir", "echo", "{}", ";"]);
    expect(r).toContain("-x");
    expect(r).toContain("echo");
  });
});

describe("output flags", () => {
  it("-print0 → -0", () => {
    expect(t([".", "-name", "*.txt", "-print0"])).toContain("-0");
  });

  it("-print is dropped", () => {
    const r = t([".", "-name", "*.txt", "-print"]);
    expect(r).not.toContain("-print");
  });
});

describe("symlink flags", () => {
  it("-L before path → -L in output", () => {
    const r = t(["-L", ".", "-name", "*.txt"]);
    expect(r).toContain("-L");
  });

  it("-follow → -L", () => {
    const r = t(["-follow", ".", "-name", "*.txt"]);
    expect(r).toContain("-L");
  });

  it("-L in expression position → -L", () => {
    const r = t([".", "-L", "-name", "*.txt"]);
    expect(r).toContain("-L");
  });
});

describe("time filters", () => {
  it("-mtime -7 → --changed-within 7d", () => {
    const r = t([".", "-mtime", "-7"]);
    expect(r).toContain("--changed-within");
    expect(r[r.indexOf("--changed-within") + 1]).toBe("7d");
  });

  it("-mtime +30 → --changed-before 30d", () => {
    const r = t([".", "-mtime", "+30"]);
    expect(r).toContain("--changed-before");
    expect(r[r.indexOf("--changed-before") + 1]).toBe("30d");
  });

  it("-atime -1 → --changed-within 1d", () => {
    const r = t([".", "-atime", "-1"]);
    expect(r).toContain("--changed-within");
    expect(r[r.indexOf("--changed-within") + 1]).toBe("1d");
  });

  it("-ctime +7 → --changed-before 7d", () => {
    const r = t([".", "-ctime", "+7"]);
    expect(r).toContain("--changed-before");
    expect(r[r.indexOf("--changed-before") + 1]).toBe("7d");
  });

  it("-mmin -60 → --changed-within 60min", () => {
    const r = t([".", "-mmin", "-60"]);
    expect(r).toContain("--changed-within");
    expect(r[r.indexOf("--changed-within") + 1]).toBe("60min");
  });

  it("-amin +30 → --changed-before 30min", () => {
    const r = t([".", "-amin", "+30"]);
    expect(r).toContain("--changed-before");
    expect(r[r.indexOf("--changed-before") + 1]).toBe("30min");
  });
});

describe("size", () => {
  it("-size +1M → -S +1M", () => {
    const r = t([".", "-size", "+1M"]);
    expect(r).toContain("-S");
    expect(r[r.indexOf("-S") + 1]).toBe("+1M");
  });

  it("-size +100M", () => {
    const r = t([".", "-type", "f", "-size", "+100M"]);
    expect(r).toContain("-S");
    expect(r[r.indexOf("-S") + 1]).toBe("+100M");
  });
});

describe("newer", () => {
  it("-newer file → --newer file", () => {
    const r = t([".", "-newer", "go.mod"]);
    expect(r).toContain("--newer");
    expect(r[r.indexOf("--newer") + 1]).toBe("go.mod");
  });
});

describe("user and group", () => {
  it("-user root → --owner root", () => {
    const r = t([".", "-user", "root"]);
    expect(r).toContain("--owner");
    expect(r[r.indexOf("--owner") + 1]).toBe("root");
  });

  it("-group wheel → --owner :wheel", () => {
    const r = t([".", "-group", "wheel"]);
    expect(r).toContain("--owner");
    expect(r[r.indexOf("--owner") + 1]).toBe(":wheel");
  });
});

describe("-path expression", () => {
  it("-path PAT -prune → -E with stripped pattern", () => {
    const r = t([".", "-path", "*/.git", "-prune"]);
    expect(r).toContain("-E");
    expect(r[r.indexOf("-E") + 1]).toBe(".git");
  });

  it("-path PAT without -prune → -p PAT", () => {
    const r = t([".", "-path", "*/test/*"]);
    expect(r).toContain("-p");
    expect(r[r.indexOf("-p") + 1]).toBe("*/test/*");
  });
});

describe("regex patterns", () => {
  it("-regex PAT → pattern without -g", () => {
    const r = t([".", "-regex", ".*\\.go$"]);
    expect(r).toContain(".*\\.go$");
    expect(r).not.toContain("-g");
  });

  it("-iregex PAT → -i + pattern without -g", () => {
    const r = t([".", "-iregex", ".*\\.GO$"]);
    expect(r).toContain("-i");
    expect(r).toContain(".*\\.GO$");
    expect(r).not.toContain("-g");
  });

  it("-name takes priority over -regex", () => {
    const r = t([".", "-name", "*.ts", "-regex", ".*\\.go$"]);
    expect(r).toContain("-g");
    expect(r).toContain("*.ts");
    expect(r).not.toContain(".*\\.go$");
  });
});

describe("misc flags", () => {
  it("-empty → -t e", () => {
    const r = t([".", "-empty"]);
    expect(r).toContain("-t");
    expect(r[r.indexOf("-t") + 1]).toBe("e");
  });

  it("-executable → -t x", () => {
    const r = t([".", "-executable"]);
    expect(r).toContain("-t");
    expect(r[r.indexOf("-t") + 1]).toBe("x");
  });

  it("-xdev → --one-file-system", () => {
    expect(t([".", "-xdev"])).toContain("--one-file-system");
  });

  it("-mount → --one-file-system", () => {
    expect(t([".", "-mount"])).toContain("--one-file-system");
  });

  it("-quit → -1", () => {
    expect(t([".", "-name", "*.go", "-quit"])).toContain("-1");
  });

  it("-print dropped", () => {
    expect(t([".", "-print"])).not.toContain("-print");
  });

  it("-prune dropped", () => {
    expect(t([".", "-prune"])).not.toContain("-prune");
  });

  it("-perm silently dropped (no fd equivalent)", () => {
    const r = t([".", "-perm", "644"]);
    expect(r).not.toContain("-perm");
    expect(r).not.toContain("644");
  });

  it("logical operators (, ), -o, -a dropped", () => {
    const r = t([".", "(", "-name", "*.ts", "-o", "-name", "*.tsx", ")"]);
    expect(r).not.toContain("(");
    expect(r).not.toContain(")");
    expect(r).not.toContain("-o");
  });
});

describe("combined real-world patterns", () => {
  it("find . -type f -name '*.ts'", () => {
    const r = t([".", "-type", "f", "-name", "*.ts"]);
    expect(r).toContain("-H");
    expect(r).toContain("-t");
    expect(r[r.indexOf("-t") + 1]).toBe("f");
    expect(r).toContain("-g");
    expect(r).toContain("*.ts");
  });

  it("find . -type d -name node_modules", () => {
    const r = t([".", "-type", "d", "-name", "node_modules"]);
    expect(r).toContain("-t");
    expect(r[r.indexOf("-t") + 1]).toBe("d");
    expect(r).toContain("node_modules");
  });

  it("find . -maxdepth 2 -name '*.json'", () => {
    const r = t([".", "-maxdepth", "2", "-name", "*.json"]);
    expect(r).toContain("-d");
    expect(r[r.indexOf("-d") + 1]).toBe("2");
    expect(r).toContain("*.json");
  });

  it("find /var/log -name '*.log' -mtime -1", () => {
    const r = t(["/var/log", "-name", "*.log", "-mtime", "-1"]);
    expect(r).toContain("--changed-within");
    expect(r).toContain("1d");
    expect(r).toContain("*.log");
    expect(r).toContain("/var/log");
  });

  it("find /path -maxdepth 3 -name a -o -name b", () => {
    const r = t(["/path", "-maxdepth", "3", "-name", ".ruby-version", "-o", "-name", ".tool-versions"]);
    expect(r).toContain("/path");
    expect(r).toContain("-d");
    const gIdx = r.indexOf("-g");
    expect(gIdx).toBeGreaterThan(-1);
    expect(r[gIdx + 1]).toBe("{.ruby-version,.tool-versions}");
  });

  it("find . \\( -type f \\) -exec wc {} + (parens + batch exec)", () => {
    const r = t([".", "(", "-type", "f", ")", "-exec", "wc", "{}", "+"]);
    expect(r).toContain("-t");
    expect(r).toContain("-X");
    expect(r).toContain("wc");
  });

  it("find . -type f -name '*.log' -mtime +7 (old logs)", () => {
    const r = t([".", "-type", "f", "-name", "*.log", "-mtime", "+7"]);
    expect(r).toContain("-t");
    expect(r).toContain("--changed-before");
    expect(r).toContain("7d");
    expect(r).toContain("*.log");
  });
});
