import { describe, expect, it, vi } from "vitest";
import { SemError, semContext, semDiff, semEntities, semImpact } from "../sem.js";

const ENTITIES_TEXT = `entities: src/

  function myFunc (L1:5)
  class MyClass (L7:20)`;

const CONTEXT_TEXT = `context for function myFunc (budget: 4000, used: 50)

  target:
    function myFunc (src/utils.ts, ~10 tokens)
      function myFunc() {}`;

const IMPACT_TEXT = `⊕ function myFunc (src/utils.ts:1–5)

  ← depended on by:
    ← function caller (src/other.ts)`;

function makeExec(stdout: string, code = 0) {
  return vi.fn().mockResolvedValue({ stdout, stderr: "", code, killed: false });
}

function makeFailingExec(stderr: string, code = 1) {
  return vi.fn().mockResolvedValue({ stdout: "", stderr, code, killed: false });
}

describe("semEntities", () => {
  it("calls sem entities with the given path (no --json)", async () => {
    const exec = makeExec(ENTITIES_TEXT);
    await semEntities(exec, "src/");
    expect(exec).toHaveBeenCalledWith("sem", ["entities", "src/"], expect.anything());
  });

  it("returns raw terminal output as a string", async () => {
    const exec = makeExec(ENTITIES_TEXT);
    const result = await semEntities(exec, "src/");
    expect(result).toBe(ENTITIES_TEXT);
  });

  it("throws SemError on non-zero exit code", async () => {
    const exec = makeFailingExec("path not found");
    await expect(semEntities(exec, ".")).rejects.toBeInstanceOf(SemError);
  });

  it("SemError includes stderr and code", async () => {
    const exec = makeFailingExec("path not found", 2);
    const err = await semEntities(exec, ".").catch((e) => e);
    expect(err.stderr).toBe("path not found");
    expect(err.code).toBe(2);
  });

  it("forwards AbortSignal to exec", async () => {
    const exec = makeExec(ENTITIES_TEXT);
    const signal = AbortSignal.abort();
    await semEntities(exec, ".", signal);
    expect(exec).toHaveBeenCalledWith("sem", expect.any(Array), expect.objectContaining({ signal }));
  });
});

describe("semContext", () => {
  it("calls sem context with entity name (no --json)", async () => {
    const exec = makeExec(CONTEXT_TEXT);
    await semContext(exec, "myFunc", {});
    expect(exec).toHaveBeenCalledWith("sem", ["context", "myFunc"], expect.anything());
  });

  it("returns raw terminal output as a string", async () => {
    const exec = makeExec(CONTEXT_TEXT);
    const result = await semContext(exec, "myFunc", {});
    expect(result).toBe(CONTEXT_TEXT);
  });

  it("appends --file when provided", async () => {
    const exec = makeExec(CONTEXT_TEXT);
    await semContext(exec, "myFunc", { file: "src/utils.ts" });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--file", "src/utils.ts"]), expect.anything());
  });

  it("appends --budget when provided", async () => {
    const exec = makeExec(CONTEXT_TEXT);
    await semContext(exec, "myFunc", { budget: 2000 });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--budget", "2000"]), expect.anything());
  });

  it("appends --entity-id when provided", async () => {
    const exec = makeExec(CONTEXT_TEXT);
    await semContext(exec, "myFunc", { entityId: "src/utils.ts::function::myFunc" });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--entity-id", "src/utils.ts::function::myFunc"]), expect.anything());
  });

  it("throws SemError on failure", async () => {
    const exec = makeFailingExec("entity not found");
    await expect(semContext(exec, "noSuchEntity", {})).rejects.toBeInstanceOf(SemError);
  });
});

describe("semImpact", () => {
  it("calls sem impact with entity name (no --json, no mode flag for 'all')", async () => {
    const exec = makeExec(IMPACT_TEXT);
    await semImpact(exec, "myFunc", {});
    expect(exec).toHaveBeenCalledWith("sem", ["impact", "myFunc"], expect.anything());
  });

  it("returns raw terminal output as a string", async () => {
    const exec = makeExec(IMPACT_TEXT);
    const result = await semImpact(exec, "myFunc", {});
    expect(result).toBe(IMPACT_TEXT);
  });

  it("appends --deps for mode 'deps'", async () => {
    const exec = makeExec(IMPACT_TEXT);
    await semImpact(exec, "myFunc", { mode: "deps" });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--deps"]), expect.anything());
  });

  it("appends --dependents for mode 'dependents'", async () => {
    const exec = makeExec(IMPACT_TEXT);
    await semImpact(exec, "myFunc", { mode: "dependents" });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--dependents"]), expect.anything());
  });

  it("appends --tests for mode 'tests'", async () => {
    const exec = makeExec(IMPACT_TEXT);
    await semImpact(exec, "myFunc", { mode: "tests" });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--tests"]), expect.anything());
  });

  it("appends --depth when provided", async () => {
    const exec = makeExec(IMPACT_TEXT);
    await semImpact(exec, "myFunc", { depth: 5 });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--depth", "5"]), expect.anything());
  });

  it("passes no mode flag for mode 'all'", async () => {
    const exec = makeExec(IMPACT_TEXT);
    await semImpact(exec, "myFunc", { mode: "all" });
    const args: string[] = exec.mock.calls[0][1];
    expect(args).not.toContain("--deps");
    expect(args).not.toContain("--dependents");
    expect(args).not.toContain("--tests");
  });

  it("throws SemError on failure", async () => {
    const exec = makeFailingExec("entity not found");
    await expect(semImpact(exec, "noSuchEntity", {})).rejects.toBeInstanceOf(SemError);
  });
});

describe("semDiff", () => {
  it("calls sem diff with markdown format by default", async () => {
    const exec = makeExec("## Changes");
    await semDiff(exec, {});
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["diff", "--format", "markdown"]), expect.anything());
  });

  it("returns raw stdout as string", async () => {
    const markdown = "## Changes\n\nfoo modified";
    const exec = makeExec(markdown);
    const result = await semDiff(exec, {});
    expect(result).toBe(markdown);
  });

  it("appends --staged when staged is true", async () => {
    const exec = makeExec("");
    await semDiff(exec, { staged: true });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--staged"]), expect.anything());
  });

  it("appends --from and --to when provided", async () => {
    const exec = makeExec("");
    await semDiff(exec, { from: "main", to: "HEAD" });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--from", "main", "--to", "HEAD"]), expect.anything());
  });

  it("throws SemError on failure", async () => {
    const exec = makeFailingExec("not a git repository");
    await expect(semDiff(exec, {})).rejects.toBeInstanceOf(SemError);
  });
});
