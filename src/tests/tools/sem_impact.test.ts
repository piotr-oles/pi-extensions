import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { registerSemImpact } from "../../tools/sem_impact.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ExecResult = {
  content: Array<{ type: string; text: string }>;
  details: Record<string, unknown>;
};

function buildMockPi() {
  let captured: ToolDefinition | undefined;
  const exec = vi.fn();
  const pi = {
    exec,
    registerTool: vi.fn((def: ToolDefinition) => {
      captured = def;
    }),
  };
  registerSemImpact(pi as any);
  const tool = captured!;
  const execute = (params: Record<string, unknown>): Promise<ExecResult> =>
    tool.execute("id", params as any, undefined, undefined, {} as any) as Promise<ExecResult>;
  return { pi, exec, tool, execute };
}

const MOCK_TEXT = `⊕ function login (src/auth.ts:10–30)

  → depends on:
    → function query (src/db.ts)

  ← depended on by:
    ← function handleLogin (src/api.ts)`;

const MOCK_EXEC_OK = { stdout: MOCK_TEXT, stderr: "", code: 0, killed: false };

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe("registerSemImpact", () => {
  it("registers a tool named sem_impact", () => {
    const { pi } = buildMockPi();
    const def = vi.mocked(pi.registerTool).mock.calls[0][0];
    expect(def.name).toBe("sem_impact");
  });

  it("includes promptGuidelines", () => {
    const { tool } = buildMockPi();
    expect(tool.promptGuidelines?.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// execute — mode flag mapping
// ---------------------------------------------------------------------------

describe("sem_impact execute mode flags", () => {
  it("passes no mode flag for mode 'all' (sem returns everything by default)", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    await execute({ entity: "login", mode: "all" });
    const args: string[] = exec.mock.calls[0][1];
    expect(args).not.toContain("--deps");
    expect(args).not.toContain("--dependents");
    expect(args).not.toContain("--tests");
  });

  it("sends only --deps for mode 'deps'", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    await execute({ entity: "login", mode: "deps" });
    const args: string[] = exec.mock.calls[0][1];
    expect(args).toContain("--deps");
    expect(args).not.toContain("--dependents");
    expect(args).not.toContain("--tests");
  });

  it("sends only --dependents for mode 'dependents'", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    await execute({ entity: "login", mode: "dependents" });
    const args: string[] = exec.mock.calls[0][1];
    expect(args).not.toContain("--deps");
    expect(args).toContain("--dependents");
    expect(args).not.toContain("--tests");
  });

  it("sends only --tests for mode 'tests'", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    await execute({ entity: "login", mode: "tests" });
    const args: string[] = exec.mock.calls[0][1];
    expect(args).not.toContain("--deps");
    expect(args).not.toContain("--dependents");
    expect(args).toContain("--tests");
  });

  it("defaults to no mode flag when mode is omitted", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    await execute({ entity: "login" });
    const args: string[] = exec.mock.calls[0][1];
    expect(args).not.toContain("--deps");
    expect(args).not.toContain("--dependents");
    expect(args).not.toContain("--tests");
  });

  it("passes --depth when provided", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    await execute({ entity: "login", depth: 5 });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--depth", "5"]),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// execute — output and details
// ---------------------------------------------------------------------------

describe("sem_impact execute output", () => {
  it("forwards sem terminal output directly", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    const result = await execute({ entity: "login" });
    expect(result.content[0].text).toBe(MOCK_TEXT);
  });

  it("includes entity and mode in details", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    const result = await execute({ entity: "login", mode: "deps" });
    expect(result.details).toMatchObject({ entity: "login", mode: "deps" });
  });
});

// ---------------------------------------------------------------------------
// execute — error handling
// ---------------------------------------------------------------------------

describe("sem_impact execute errors", () => {
  it("returns error text on sem failure", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: "", stderr: "entity not found", code: 1, killed: false });
    const result = await execute({ entity: "noSuchEntity" });
    expect(result.content[0].text).toContain("sem_impact failed");
    expect(result.details).toMatchObject({ error: true });
  });

  it("returns error text on unexpected exception", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockRejectedValue(new Error("ENOENT"));
    const result = await execute({ entity: "login" });
    expect(result.content[0].text).toContain("sem_impact error");
    expect(result.details).toMatchObject({ error: true });
  });
});
