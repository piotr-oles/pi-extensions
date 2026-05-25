import { describe, expect, it, vi } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

type ExecResult = { content: Array<{ type: string; text: string }>; details: Record<string, unknown> };
import { registerSemDiff } from "../../tools/sem_diff.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockPi() {
  let captured: ToolDefinition | undefined;
  const exec = vi.fn();
  const pi = {
    exec,
    registerTool: vi.fn((def: ToolDefinition) => { captured = def; }),
  };
  registerSemDiff(pi as any);
  const tool = captured!;
  const execute = (params: Record<string, unknown>): Promise<ExecResult> =>
    tool.execute("id", params as any, undefined, undefined, {} as any) as Promise<ExecResult>;
  return { pi, exec, tool, execute };
}

const MOCK_MARKDOWN = "## Semantic diff\n\n### myFunc — modified\n\n```\n- old\n+ new\n```";

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe("registerSemDiff", () => {
  it("registers a tool named sem_diff", () => {
    const { pi } = buildMockPi();
    const def = vi.mocked(pi.registerTool).mock.calls[0][0];
    expect(def.name).toBe("sem_diff");
  });

  it("includes promptGuidelines", () => {
    const { tool } = buildMockPi();
    expect(tool.promptGuidelines?.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// execute — argument mapping
// ---------------------------------------------------------------------------

describe("sem_diff execute arguments", () => {
  it("calls sem diff with markdown format", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: MOCK_MARKDOWN, stderr: "", code: 0, killed: false });
    await execute({});
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["diff", "--format", "markdown"]), expect.anything());
  });

  it("appends --staged when staged is true", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: "", stderr: "", code: 0, killed: false });
    await execute({ staged: true });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--staged"]), expect.anything());
  });

  it("does not append --staged when staged is false", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: "", stderr: "", code: 0, killed: false });
    await execute({ staged: false });
    const args: string[] = exec.mock.calls[0][1];
    expect(args).not.toContain("--staged");
  });

  it("appends --from when provided", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: "", stderr: "", code: 0, killed: false });
    await execute({ from: "main" });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--from", "main"]), expect.anything());
  });

  it("appends --to when provided", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: "", stderr: "", code: 0, killed: false });
    await execute({ from: "main", to: "HEAD" });
    expect(exec).toHaveBeenCalledWith("sem", expect.arrayContaining(["--to", "HEAD"]), expect.anything());
  });

  it("does not append --from or --to when omitted", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: "", stderr: "", code: 0, killed: false });
    await execute({});
    const args: string[] = exec.mock.calls[0][1];
    expect(args).not.toContain("--from");
    expect(args).not.toContain("--to");
  });
});

// ---------------------------------------------------------------------------
// execute — output
// ---------------------------------------------------------------------------

describe("sem_diff execute output", () => {
  it("returns sem markdown output in content", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: MOCK_MARKDOWN, stderr: "", code: 0, killed: false });
    const result = await execute({});
    expect(result.content[0].text).toBe(MOCK_MARKDOWN);
  });

  it("returns fallback message when output is empty", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: "  \n  ", stderr: "", code: 0, killed: false });
    const result = await execute({});
    expect(result.content[0].text).toBe("No semantic changes found.");
  });

  it("reflects from/to in details", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: MOCK_MARKDOWN, stderr: "", code: 0, killed: false });
    const result = await execute({ from: "main", to: "HEAD" });
    expect(result.details).toMatchObject({ from: "main", to: "HEAD" });
  });

  it("reflects staged in details", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: MOCK_MARKDOWN, stderr: "", code: 0, killed: false });
    const result = await execute({ staged: true });
    expect(result.details).toMatchObject({ staged: true });
  });
});

// ---------------------------------------------------------------------------
// execute — error handling
// ---------------------------------------------------------------------------

describe("sem_diff execute errors", () => {
  it("returns error text on sem failure", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockResolvedValue({ stdout: "", stderr: "not a git repository", code: 1, killed: false });
    const result = await execute({});
    expect(result.content[0].text).toContain("sem_diff failed");
    expect(result.details).toMatchObject({ error: true });
  });

  it("returns error text on unexpected exception", async () => {
    const { execute, exec } = buildMockPi();
    exec.mockRejectedValue(new Error("sem not found"));
    const result = await execute({});
    expect(result.content[0].text).toContain("sem_diff error");
    expect(result.details).toMatchObject({ error: true });
  });
});
