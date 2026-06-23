import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { commitFile, computeGitDiff, ensureGitRepo, formatLineDiff, getRepoName } from "./git.js";

type ExecResult = { stdout: string; stderr: string; code: number; killed: boolean };
type ExecFn = (command: string, args: string[]) => Promise<ExecResult>;

const ok = (): ExecResult => ({ stdout: "", stderr: "", code: 0, killed: false });

describe("getRepoName", () => {
  it("returns directory basename", () => {
    expect(getRepoName("/tmp/my-repo")).toBe("my-repo");
  });
});

describe("ensureGitRepo", () => {
  it("calls git init when .git missing", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-test-"));
    const exec = vi.fn<ExecFn>().mockResolvedValue(ok());

    try {
      await ensureGitRepo(exec, tmp);

      expect(exec).toHaveBeenCalledOnce();
      expect(exec).toHaveBeenCalledWith("git", ["init"], { cwd: tmp });
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("does nothing when .git already exists", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-test-"));
    const exec = vi.fn<ExecFn>().mockResolvedValue(ok());

    try {
      await mkdir(join(tmp, ".git"));
      await ensureGitRepo(exec, tmp);
      expect(exec).not.toHaveBeenCalled();
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("commitFile", () => {
  it("returns true when git commit exits 0", async () => {
    const exec = vi.fn<ExecFn>().mockImplementation(async (_command, args) => {
      if (args.includes("commit")) {
        return ok();
      }
      return ok();
    });

    const changed = await commitFile(exec, "/repo", "plan.md", "create: plan.md");
    expect(changed).toBe(true);
  });

  it("returns false when git commit exits non-zero", async () => {
    const exec = vi.fn<ExecFn>().mockImplementation(async (_command, args) => {
      if (args.includes("commit")) {
        return { ...ok(), code: 1 };
      }
      return ok();
    });

    const changed = await commitFile(exec, "/repo", "plan.md", "create: plan.md");
    expect(changed).toBe(false);
  });
});

describe("computeGitDiff", () => {
  it("returns empty string when there is no parent commit", async () => {
    const exec = vi.fn<ExecFn>().mockImplementation(async (_command, args) => {
      if (args.includes("rev-parse")) {
        return { ...ok(), code: 1 };
      }
      return ok();
    });

    const diff = await computeGitDiff(exec, "/repo", "plan.md");
    expect(diff).toBe("");
    expect(exec.mock.calls.some(([, args]) => args.includes("show"))).toBe(false);
  });

  it("returns added line diff", async () => {
    const exec = vi.fn<ExecFn>().mockImplementation(async (_command, args) => {
      const last = args.at(-1);
      if (args.includes("rev-parse")) {
        return ok();
      }
      if (last === "HEAD~1:plan.md") {
        return { ...ok(), stdout: "# Plan\n\n1. Step one\n" };
      }
      if (last === "HEAD:plan.md") {
        return { ...ok(), stdout: "# Plan\n\n1. Step one\n2. Step two\n" };
      }
      return ok();
    });

    const diff = await computeGitDiff(exec, "/repo", "plan.md");
    expect(diff).toMatch(/^\+\d+ 2\. Step two$/m);
    expect(diff).not.toMatch(/^-/m);
  });

  it("returns removed lines diff", async () => {
    const exec = vi.fn<ExecFn>().mockImplementation(async (_command, args) => {
      const last = args.at(-1);
      if (args.includes("rev-parse")) {
        return ok();
      }
      if (last === "HEAD~1:plan.md") {
        return { ...ok(), stdout: "# Plan\n\n1. Step A\n2. Step B\n3. Step C\n" };
      }
      if (last === "HEAD:plan.md") {
        return { ...ok(), stdout: "# Plan\n\n1. Step A\n" };
      }
      return ok();
    });

    const diff = await computeGitDiff(exec, "/repo", "plan.md");
    expect(diff).toMatch(/^-\d+ 2\. Step B$/m);
    expect(diff).toMatch(/^-\d+ 3\. Step C$/m);
    expect(diff).not.toMatch(/^\+/m);
  });
});

describe("formatLineDiff", () => {
  it("returns empty string for identical content", () => {
    expect(formatLineDiff(["a", "b", "c"], ["a", "b", "c"])).toBe("");
  });

  it("marks added lines with + prefix and 1-indexed line number", () => {
    const result = formatLineDiff(["a", "c"], ["a", "b", "c"]);
    expect(result).toMatch(/^\+2 b$/m);
    expect(result).not.toMatch(/^-/m);
  });

  it("marks removed lines with - prefix and 1-indexed line number", () => {
    const result = formatLineDiff(["a", "b", "c"], ["a", "c"]);
    expect(result).toMatch(/^-2 b$/m);
    expect(result).not.toMatch(/^\+/m);
  });

  it("shows correct line numbers for multiple removed lines", () => {
    const result = formatLineDiff(["a", "b", "c", "d"], ["a", "d"]);
    expect(result).toMatch(/^-2 b$/m);
    expect(result).toMatch(/^-3 c$/m);
    expect(result).not.toMatch(/^\+/m);
  });

  it("shows both - and + lines for replacements", () => {
    const result = formatLineDiff(["a", "old", "c"], ["a", "new", "c"]);
    expect(result).toMatch(/^-2 old$/m);
    expect(result).toMatch(/^\+2 new$/m);
  });

  it("pads line numbers to consistent width", () => {
    const old = Array.from({ length: 10 }, (_, i) => `line${i + 1}`);
    const next = [...old];
    next[9] = "changed";
    const result = formatLineDiff(old, next);
    expect(result).toMatch(/^-10 line10$/m);
    expect(result).toMatch(/^\+10 changed$/m);
  });
});
