import { describe, expect, it, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { registerSemContext } from "../../tools/sem_context.js";
import type { SemContextResult } from "../../sem.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ExecResult = { content: Array<{ type: string; text: string }>; details: Record<string, unknown> };

function buildMockPi() {
  let captured: ToolDefinition<any, any, any> | undefined;
  const exec = vi.fn();
  const pi = {
    exec,
    registerTool: vi.fn((def: ToolDefinition<any, any, any>) => { captured = def; }),
  };
  registerSemContext(pi as any);
  // Typed wrapper: supplies the required-but-unused onUpdate and ctx args, and
  // narrows content to the text-only shape our tools always return.
  const execute = (params: Record<string, unknown>): Promise<ExecResult> =>
    captured!.execute("id", params as any, undefined, undefined, {} as any) as Promise<ExecResult>;
  return { pi, exec, tool: captured!, execute };
}

const MOCK_RESULT: SemContextResult = {
  entity: "myFunc",
  entityId: "src/utils.ts::function::myFunc",
  budget: 4000,
  total_tokens: 50,
  entries: [{
    entityId: "src/utils.ts::function::myFunc",
    file: "src/utils.ts",
    name: "myFunc",
    type: "function",
    role: "target",
    content: "function myFunc() {}",
    tokens: 10,
  }],
};

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
  it("calls sem context with entity name", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue({ stdout: JSON.stringify(MOCK_RESULT), stderr: "", code: 0, killed: false });
    await execute({ entity: "myFunc" });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["context", "--json", "myFunc"]), expect.anything());
  });

  it("returns formatted text in content", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue({ stdout: JSON.stringify(MOCK_RESULT), stderr: "", code: 0, killed: false });
    const result = await execute({ entity: "myFunc" });
    expect(result.content[0].text).toContain("Entity: myFunc");
  });

  it("passes budget to sem", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue({ stdout: JSON.stringify(MOCK_RESULT), stderr: "", code: 0, killed: false });
    await execute({ entity: "myFunc", budget: 2000 });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--budget", "2000"]), expect.anything());
  });

  it("passes file to sem when provided", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue({ stdout: JSON.stringify(MOCK_RESULT), stderr: "", code: 0, killed: false });
    await execute({ entity: "myFunc", file: "src/utils.ts" });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--file", "src/utils.ts"]), expect.anything());
  });

  it("passes entity_id to sem when provided", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue({ stdout: JSON.stringify(MOCK_RESULT), stderr: "", code: 0, killed: false });
    await execute({ entity: "myFunc", entity_id: "src/utils.ts::function::myFunc" });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--entity-id", "src/utils.ts::function::myFunc"]), expect.anything());
  });

  it("includes token stats in details", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue({ stdout: JSON.stringify(MOCK_RESULT), stderr: "", code: 0, killed: false });
    const result = await execute({ entity: "myFunc" });
    expect(result.details).toMatchObject({ tokens: 50, budget: 4000 });
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
