import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { registerSemEntities } from "../../tools/sem_entities.js";

type ExecResult = {
  content: Array<{ type: string; text: string }>;
  details: Record<string, unknown>;
};

function buildMockPi(cwd = "/project") {
  let captured: ToolDefinition | undefined;
  const exec = vi.fn();
  const pi = {
    exec,
    registerTool: vi.fn((def: ToolDefinition) => {
      captured = def;
    }),
  };
  registerSemEntities(pi as any);
  const tool = captured!;
  const ctx = { cwd };
  const execute = (params: Record<string, unknown>): Promise<ExecResult> =>
    tool.execute("id", params as any, undefined, undefined, ctx as any) as Promise<ExecResult>;
  return { pi, exec, tool, execute };
}

const MOCK_TEXT = `entities: src/utils.ts

  function myFunc (L1:5)
  class MyClass (L7:20)`;

const MOCK_EXEC_OK = { stdout: MOCK_TEXT, stderr: "", code: 0, killed: false };

describe("registerSemEntities", () => {
  it("registers a tool named sem_entities", () => {
    const { pi } = buildMockPi();
    expect(pi.registerTool).toHaveBeenCalledOnce();
    const def = vi.mocked(pi.registerTool).mock.calls[0][0];
    expect(def.name).toBe("sem_entities");
  });

  it("includes promptGuidelines", () => {
    const { tool } = buildMockPi();
    expect(tool.promptGuidelines?.length).toBeGreaterThan(0);
  });
});

describe("sem_entities execute", () => {
  it("calls sem entities with given path", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    await execute({ path: "src/utils.ts" });
    expect(exec).toHaveBeenCalledWith("sem", ["entities", "src/utils.ts"], expect.anything());
  });

  it("uses cwd when path is omitted", async () => {
    const { exec, execute } = buildMockPi("/my/project");
    exec.mockResolvedValue(MOCK_EXEC_OK);
    await execute({});
    expect(exec).toHaveBeenCalledWith("sem", ["entities", "/my/project"], expect.anything());
  });

  it("forwards sem output directly as content", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    const result = await execute({ path: "src/utils.ts" });
    expect(result.content[0].text).toBe(MOCK_TEXT);
  });

  it("includes path in details", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue(MOCK_EXEC_OK);
    const result = await execute({ path: "src/utils.ts" });
    expect(result.details).toMatchObject({ path: "src/utils.ts" });
  });

  it("returns fallback text when output is empty", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue({ stdout: "", stderr: "", code: 0, killed: false });
    const result = await execute({ path: "src/empty.ts" });
    expect(result.content[0].text).toContain("No entities found");
  });
});

describe("sem_entities execute errors", () => {
  it("returns error text on sem failure", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockResolvedValue({ stdout: "", stderr: "file not found", code: 1, killed: false });
    const result = await execute({ path: "no/such.ts" });
    expect(result.content[0].text).toContain("sem_entities failed");
    expect(result.details).toMatchObject({ error: true });
  });

  it("returns error text on unexpected exception", async () => {
    const { exec, execute } = buildMockPi();
    exec.mockRejectedValue(new Error("ENOENT"));
    const result = await execute({ path: "src/utils.ts" });
    expect(result.content[0].text).toContain("sem_entities error");
    expect(result.details).toMatchObject({ error: true });
  });
});
