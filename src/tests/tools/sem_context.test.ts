import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { registerSemContext } from "../../tools/sem_context.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ExecResult = {
  content: Array<{ type: string; text: string }>;
  details: Record<string, unknown>;
};

function buildMockPi() {
  let captured: ToolDefinition<any, any, any> | undefined;
  const exec = vi.fn();
  const pi = {
    exec,
    registerTool: vi.fn((def: ToolDefinition<any, any, any>) => {
      captured = def;
    }),
  };
  registerSemContext(pi as any);
  const execute = (params: Record<string, unknown>): Promise<ExecResult> =>
    captured!.execute("id", params as any, undefined, undefined, {} as any) as Promise<ExecResult>;
  return { pi, exec, tool: captured!, execute };
}

const MOCK_TEXT = `context for function myFunc (budget: 4000, used: 50)

  target:
    function myFunc (src/utils.ts, ~10 tokens)
      function myFunc() {}`;

const MOCK_EXEC_OK = { stdout: MOCK_TEXT, stderr: "", code: 0, killed: false };

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe("registerSemContext", () => {
  it("registers a tool named sem_context", () => {
    const { pi } = buildMockPi();
    expect(pi.registerTool).toHaveBeenCalledOnce();
    const def = vi.mocked(pi.registerTool).mock.calls[0][0];
    expect(def.name).toBe("sem_context");
  });

  it("includes promptGuidelines", () => {
    const { tool } = buildMockPi();
    expect(tool.promptGuidelines?.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// execute — happy path
// ---------------------------------------------------------------------------

describe("sem_context execute", () => {
  it("calls sem context with entity name (no --json)", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    await execute({ entity: "myFunc" });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["context", "myFunc"]),
      expect.anything(),
    );
    expect(exec).not.toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--json"]),
      expect.anything(),
    );
  });

  it("forwards sem terminal output directly as content", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    const result = await execute({ entity: "myFunc" });
    expect(result.content[0].text).toBe(MOCK_TEXT);
  });

  it("passes budget to sem", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    await execute({ entity: "myFunc", budget: 2000 });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--budget", "2000"]),
      expect.anything(),
    );
  });

  it("passes file to sem when provided", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    await execute({ entity: "myFunc", file: "src/utils.ts" });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--file", "src/utils.ts"]),
      expect.anything(),
    );
  });

  it("passes entity_id to sem when provided", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    await execute({ entity: "myFunc", entity_id: "src/utils.ts::function::myFunc" });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--entity-id", "src/utils.ts::function::myFunc"]),
      expect.anything(),
    );
  });

  it("includes entity in details", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    const result = await execute({ entity: "myFunc" });
    expect(result.details).toMatchObject({ entity: "myFunc" });
  });
});

// ---------------------------------------------------------------------------
// execute — error handling
// ---------------------------------------------------------------------------

describe("sem_context execute errors", () => {
  it("returns error text on sem failure", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue({ stdout: "", stderr: "entity not found", code: 1, killed: false });
    const result = await execute({ entity: "noSuchEntity" });
    expect(result.content[0].text).toContain("sem_context failed");
    expect(result.details).toMatchObject({ error: true });
  });

  it("returns error text on unexpected exception", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockRejectedValue(new Error("ENOENT"));
    const result = await execute({ entity: "myFunc" });
    expect(result.content[0].text).toContain("sem_context error");
    expect(result.details).toMatchObject({ error: true });
  });
});
