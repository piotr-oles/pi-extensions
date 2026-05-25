import { describe, expect, it, vi } from "vitest";
import type { SemContextResult, SemEntity, SemImpactResult } from "../sem.js";
import { SemError, semContext, semDiff, semEntities, semImpact } from "../sem.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITIES: SemEntity[] = [
  { name: "myFunc", type: "function", start_line: 1, end_line: 5, parent_id: null },
  { name: "MyClass", type: "class", start_line: 7, end_line: 20, parent_id: null },
];

const CONTEXT_RESULT: SemContextResult = {
  entity: "myFunc",
  entityId: "src/utils.ts::function::myFunc",
  budget: 4000,
  total_tokens: 50,
  entries: [
    {
      entityId: "src/utils.ts::function::myFunc",
      file: "src/utils.ts",
      name: "myFunc",
      type: "function",
      role: "target",
      content: "function myFunc() {}",
      tokens: 10,
    },
  ],
};

const IMPACT_RESULT: SemImpactResult = {
  entity: {
    entityId: "src/utils.ts::function::myFunc",
    name: "myFunc",
    type: "function",
    file: "src/utils.ts",
    lines: [1, 5],
  },
  dependencies: [],
  dependents: [],
  impact: { depth: 2, total: 0, entities: [] },
  tests: [],
};

// ---------------------------------------------------------------------------
// Helper: build a mock exec that returns JSON stdout
// ---------------------------------------------------------------------------

function makeExec(stdout: string, code = 0) {
  return vi.fn().mockResolvedValue({ stdout, stderr: "", code, killed: false });
}

function makeFailingExec(stderr: string, code = 1) {
  return vi.fn().mockResolvedValue({ stdout: "", stderr, code, killed: false });
}

// ---------------------------------------------------------------------------
// semEntities
// ---------------------------------------------------------------------------

describe("semEntities", () => {
  it("calls sem entities with --json and the given path", async () => {
    const exec = makeExec(JSON.stringify(ENTITIES));
    await semEntities(exec, "src/");
    expect(exec).toHaveBeenCalledWith("sem", ["entities", "--json", "src/"], expect.anything());
  });

  it("parses and returns entity array", async () => {
    const exec = makeExec(JSON.stringify(ENTITIES));
    const result = await semEntities(exec, "src/");
    expect(result).toEqual(ENTITIES);
  });

  it("returns empty array when sem outputs []", async () => {
    const exec = makeExec("[]");
    const result = await semEntities(exec, ".");
    expect(result).toEqual([]);
  });

  it("throws SemError on non-zero exit code", async () => {
    const exec = makeFailingExec("not a git repository");
    await expect(semEntities(exec, ".")).rejects.toBeInstanceOf(SemError);
  });

  it("SemError includes stderr and code", async () => {
    const exec = makeFailingExec("not a git repository", 2);
    const err = await semEntities(exec, ".").catch((e) => e);
    expect(err).toBeInstanceOf(SemError);
    expect(err.stderr).toBe("not a git repository");
    expect(err.code).toBe(2);
  });

  it("forwards AbortSignal to exec", async () => {
    const exec = makeExec("[]");
    const signal = AbortSignal.abort();
    await semEntities(exec, ".", signal);
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.any(Array),
      expect.objectContaining({ signal }),
    );
  });
});

// ---------------------------------------------------------------------------
// semContext
// ---------------------------------------------------------------------------

describe("semContext", () => {
  it("calls sem context with --json and entity name", async () => {
    const exec = makeExec(JSON.stringify(CONTEXT_RESULT));
    await semContext(exec, "myFunc", {});
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["context", "--json", "myFunc"]),
      expect.anything(),
    );
  });

  it("parses and returns context result", async () => {
    const exec = makeExec(JSON.stringify(CONTEXT_RESULT));
    const result = await semContext(exec, "myFunc", {});
    expect(result).toEqual(CONTEXT_RESULT);
  });

  it("appends --file when provided", async () => {
    const exec = makeExec(JSON.stringify(CONTEXT_RESULT));
    await semContext(exec, "myFunc", { file: "src/utils.ts" });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--file", "src/utils.ts"]),
      expect.anything(),
    );
  });

  it("appends --budget when provided", async () => {
    const exec = makeExec(JSON.stringify(CONTEXT_RESULT));
    await semContext(exec, "myFunc", { budget: 2000 });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--budget", "2000"]),
      expect.anything(),
    );
  });

  it("appends --entity-id when provided", async () => {
    const exec = makeExec(JSON.stringify(CONTEXT_RESULT));
    await semContext(exec, "myFunc", { entityId: "src/utils.ts::function::myFunc" });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--entity-id", "src/utils.ts::function::myFunc"]),
      expect.anything(),
    );
  });

  it("throws SemError on failure", async () => {
    const exec = makeFailingExec("entity not found");
    await expect(semContext(exec, "noSuchEntity", {})).rejects.toBeInstanceOf(SemError);
  });
});

// ---------------------------------------------------------------------------
// semImpact
// ---------------------------------------------------------------------------

describe("semImpact", () => {
  it("calls sem impact with --json and entity name", async () => {
    const exec = makeExec(JSON.stringify(IMPACT_RESULT));
    await semImpact(exec, "myFunc", {});
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["impact", "--json", "myFunc"]),
      expect.anything(),
    );
  });

  it("parses and returns impact result", async () => {
    const exec = makeExec(JSON.stringify(IMPACT_RESULT));
    const result = await semImpact(exec, "myFunc", {});
    expect(result).toEqual(IMPACT_RESULT);
  });

  it("appends --deps flag when deps is true", async () => {
    const exec = makeExec(JSON.stringify(IMPACT_RESULT));
    await semImpact(exec, "myFunc", { deps: true });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--deps"]), expect.anything());
  });

  it("appends --dependents flag when dependents is true", async () => {
    const exec = makeExec(JSON.stringify(IMPACT_RESULT));
    await semImpact(exec, "myFunc", { dependents: true });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--dependents"]),
      expect.anything(),
    );
  });

  it("appends --tests flag when tests is true", async () => {
    const exec = makeExec(JSON.stringify(IMPACT_RESULT));
    await semImpact(exec, "myFunc", { tests: true });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--tests"]),
      expect.anything(),
    );
  });

  it("appends --depth when provided", async () => {
    const exec = makeExec(JSON.stringify(IMPACT_RESULT));
    await semImpact(exec, "myFunc", { depth: 5 });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--depth", "5"]),
      expect.anything(),
    );
  });

  it("does not append flags when false/undefined", async () => {
    const exec = makeExec(JSON.stringify(IMPACT_RESULT));
    await semImpact(exec, "myFunc", { deps: false, dependents: false, tests: false });
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

// ---------------------------------------------------------------------------
// semDiff
// ---------------------------------------------------------------------------

describe("semDiff", () => {
  it("calls sem diff with markdown format by default", async () => {
    const exec = makeExec("## Changes\n\nNo changes.");
    await semDiff(exec, {});
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["diff", "--format", "markdown"]),
      expect.anything(),
    );
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
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--staged"]),
      expect.anything(),
    );
  });

  it("appends --from when provided", async () => {
    const exec = makeExec("");
    await semDiff(exec, { from: "main" });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--from", "main"]),
      expect.anything(),
    );
  });

  it("appends --to when provided", async () => {
    const exec = makeExec("");
    await semDiff(exec, { from: "main", to: "HEAD" });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--to", "HEAD"]),
      expect.anything(),
    );
  });

  it("uses json format when explicitly requested", async () => {
    const exec = makeExec("{}");
    await semDiff(exec, { format: "json" });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--format", "json"]),
      expect.anything(),
    );
  });

  it("throws SemError on failure", async () => {
    const exec = makeFailingExec("not a git repository");
    await expect(semDiff(exec, {})).rejects.toBeInstanceOf(SemError);
  });
});
