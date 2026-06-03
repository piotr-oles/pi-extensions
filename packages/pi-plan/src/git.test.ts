import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { commitFile, computeGitDiff, ensureGitRepo, formatLineDiff, getRepoName } from "./git.js";

const execFileAsync = promisify(execFile);

async function testExec(
  command: string,
  args: string[],
  options?: { cwd?: string },
): Promise<{ stdout: string; stderr: string; code: number; killed: boolean }> {
  try {
    const result = await execFileAsync(command, args, {
      cwd: options?.cwd,
      encoding: "utf8",
    });
    return { stdout: result.stdout, stderr: result.stderr, code: 0, killed: false };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      code: err.code ?? 1,
      killed: false,
    };
  }
}

describe("getRepoName", () => {
  it("returns directory basename", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-test-"));
    try {
      const name = getRepoName(tmp);
      expect(name.length).toBeGreaterThan(0);
      expect(name).not.toContain("/");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("ensureGitRepo", () => {
  it("creates .git when absent", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-test-"));
    try {
      await ensureGitRepo(testExec, tmp);
      const { existsSync } = await import("node:fs");
      expect(existsSync(join(tmp, ".git"))).toBe(true);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("is idempotent — does not throw when .git already exists", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-test-"));
    try {
      await ensureGitRepo(testExec, tmp);
      await expect(ensureGitRepo(testExec, tmp)).resolves.not.toThrow();
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("commitFile", () => {
  it("creates a commit for a new file and returns true", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-test-"));
    try {
      await ensureGitRepo(testExec, tmp);
      await writeFile(join(tmp, "plan.md"), "# Plan\n", "utf8");
      expect(await commitFile(testExec, tmp, "plan.md", "create: plan.md")).toBe(true);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("returns false when nothing to commit", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-test-"));
    try {
      await ensureGitRepo(testExec, tmp);
      await writeFile(join(tmp, "plan.md"), "# Plan\n", "utf8");
      await commitFile(testExec, tmp, "plan.md", "create: plan.md");
      expect(await commitFile(testExec, tmp, "plan.md", "confirm: plan.md")).toBe(false);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("commits files in subdirectories", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-test-"));
    try {
      await ensureGitRepo(testExec, tmp);
      await mkdir(join(tmp, "repo"), { recursive: true });
      await writeFile(join(tmp, "repo", "plan.md"), "# Plan\n", "utf8");
      expect(await commitFile(testExec, tmp, "repo/plan.md", "create: plan.md")).toBe(true);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("computeGitDiff", () => {
  it("returns empty string after first commit (no parent)", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-test-"));
    try {
      await ensureGitRepo(testExec, tmp);
      await writeFile(join(tmp, "plan.md"), "# Plan\n", "utf8");
      await commitFile(testExec, tmp, "plan.md", "create: plan.md");
      expect(await computeGitDiff(testExec, tmp, "plan.md")).toBe("");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("returns diff between commits (line added)", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-test-"));
    try {
      await ensureGitRepo(testExec, tmp);
      await writeFile(join(tmp, "plan.md"), "# Plan\n\n1. Step one\n", "utf8");
      await commitFile(testExec, tmp, "plan.md", "create: plan.md");

      await writeFile(join(tmp, "plan.md"), "# Plan\n\n1. Step one\n2. Step two\n", "utf8");
      await commitFile(testExec, tmp, "plan.md", "confirm: plan.md");

      const diff = await computeGitDiff(testExec, tmp, "plan.md");
      expect(diff).toMatch(/^\+\d+ 2\. Step two$/m);
      expect(diff).not.toMatch(/^-/m);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("returns diff between commits (multiple lines removed)", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-test-"));
    try {
      await ensureGitRepo(testExec, tmp);
      await writeFile(join(tmp, "plan.md"), "# Plan\n\n1. Step A\n2. Step B\n3. Step C\n", "utf8");
      await commitFile(testExec, tmp, "plan.md", "create: plan.md");

      await writeFile(join(tmp, "plan.md"), "# Plan\n\n1. Step A\n", "utf8");
      await commitFile(testExec, tmp, "plan.md", "confirm: plan.md");

      const diff = await computeGitDiff(testExec, tmp, "plan.md");
      expect(diff).toMatch(/^-\d+ 2\. Step B$/m);
      expect(diff).toMatch(/^-\d+ 3\. Step C$/m);
      expect(diff).not.toMatch(/^\+/m);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
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
