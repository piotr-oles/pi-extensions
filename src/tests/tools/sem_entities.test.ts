import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";

type ExecResult = {
  content: Array<{ type: string; text: string }>;
  details: Record<string, unknown>;
};

import type { SemEntity } from "../../sem.js";
import { registerSemEntities } from "../../tools/sem_entities.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const MOCK_ENTITIES: SemEntity[] = [
  { name: "myFunc", type: "function", start_line: 1, end_line: 5, parent_id: null },
  { name: "MyClass", type: "class", start_line: 7, end_line: 20, parent_id: null },
];

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe("registerSemEntities", () => {
  it("registers a tool named sem_entities", () => {
    const { pi } = buildMockPi();
    const def = vi.mocked(pi.registerTool).mock.calls[0][0];
    expect(def.name).toBe("sem_entities");
  });

  it("includes promptGuidelines", () => {
    const { tool } = buildMockPi();
    expect(tool.promptGuidelines?.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// execute — happy path
// ---------------------------------------------------------------------------

describe("sem_entities execute", () => {
  it("uses provided path", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({
      stdout: JSON.stringify(MOCK_ENTITIES),
      stderr: "",
      code: 0,
      killed: false,
    });
    await execute({ path: "src/components" });
    expect(exec).toHaveBeenCalledWith(
      "sem",
      ["entities", "--json", "src/components"],
      expect.anything(),
    );
  });

  it("falls back to ctx.cwd when path is omitted", async () => {
    const { execute, exec } = buildMockPi("/my/project");
    exec.mockResolvedValue({
      stdout: JSON.stringify(MOCK_ENTITIES),
      stderr: "",
      code: 0,
      killed: false,
    });
    await execute({});
    expect(exec).toHaveBeenCalledWith(
      "sem",
      ["entities", "--json", "/my/project"],
      expect.anything(),
    );
  });

  it("returns formatted entity tree in content", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({
      stdout: JSON.stringify(MOCK_ENTITIES),
      stderr: "",
      code: 0,
      killed: false,
    });
    const result = await execute({ path: "src/" });
    expect(result.content[0].text).toContain("function myFunc");
    expect(result.content[0].text).toContain("class MyClass");
  });

  it("includes entity count in details", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({
      stdout: JSON.stringify(MOCK_ENTITIES),
      stderr: "",
      code: 0,
      killed: false,
    });
    const result = await execute({ path: "src/" });
    expect(result.details).toMatchObject({ count: 2 });
  });

  it("returns no-entities message when list is empty", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: "[]", stderr: "", code: 0, killed: false });
    const result = await execute({ path: "src/" });
    expect(result.content[0].text).toContain("No entities found");
    expect(result.details).toMatchObject({ count: 0 });
  });
});

// ---------------------------------------------------------------------------
// execute — error handling
// ---------------------------------------------------------------------------

describe("sem_entities execute errors", () => {
  it("returns error text on sem failure", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: "", stderr: "not a git repository", code: 1, killed: false });
    const result = await execute({ path: "." });
    expect(result.content[0].text).toContain("sem_entities failed");
    expect(result.details).toMatchObject({ error: true });
  });

  it("returns error text on unexpected exception", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockRejectedValue(new Error("ENOENT"));
    const result = await execute({ path: "." });
    expect(result.content[0].text).toContain("sem_entities error");
    expect(result.details).toMatchObject({ error: true });
  });
});
