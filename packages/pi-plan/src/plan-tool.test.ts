import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReviewPlanTool } from "./plan-tool.js";

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

function textContent(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  if (first.type !== "text" || typeof first.text !== "string") {
    throw new Error("Expected text content");
  }
  return first.text;
}

function makeCtx(customReturnValue: unknown) {
  const setWorkingVisible = vi.fn();
  const custom =
    customReturnValue === null ? vi.fn() : vi.fn().mockResolvedValue(customReturnValue);
  return {
    ctx: {
      hasUI: customReturnValue !== null,
      ui: { setWorkingVisible, custom },
    },
    setWorkingVisible,
    custom,
  };
}

describe("createReviewPlanTool - no UI", () => {
  it("throws when hasUI is false", async () => {
    const { ctx, custom } = makeCtx(null);
    const tool = createReviewPlanTool(testExec, "/nonexistent");

    await expect(
      tool.execute(
        "id",
        { planPath: "repo/plan.md" },
        AbortSignal.timeout(5000),
        undefined,
        ctx as any,
      ),
    ).rejects.toThrow("UI not available");
    expect(custom).not.toHaveBeenCalled();
  });
});

describe("createReviewPlanTool - execute with UI", () => {
  let plansDir: string;

  beforeEach(async () => {
    plansDir = await mkdtemp(join(tmpdir(), "pi-plan-tool-test-"));
    await mkdir(join(plansDir, "my-repo"), { recursive: true });
    await writeFile(join(plansDir, "my-repo", "plan.md"), "# Plan\n\n1. Step A\n");
  });

  afterEach(async () => {
    await rm(plansDir, { recursive: true, force: true });
  });

  it("throws when plan file does not exist", async () => {
    const { ctx, custom } = makeCtx({ type: "cancel" });
    const tool = createReviewPlanTool(testExec, plansDir);

    await expect(
      tool.execute(
        "id",
        { planPath: "my-repo/nonexistent.md" },
        AbortSignal.timeout(5000),
        undefined,
        ctx as any,
      ),
    ).rejects.toThrow("Plan file not found");
    expect(custom).not.toHaveBeenCalled();
  });

  it("returns cancel when user cancels", async () => {
    const { ctx } = makeCtx({ type: "cancel" });
    const tool = createReviewPlanTool(testExec, plansDir);

    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("cancel");
    expect(textContent(result)).toContain("cancelled");
  });

  it("includes planPath in cancel details", async () => {
    const { ctx } = makeCtx({ type: "cancel" });
    const tool = createReviewPlanTool(testExec, plansDir);

    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("cancel");
    expect((result.details as any).planPath).toBe(join(plansDir, "my-repo", "plan.md"));
  });

  it("returns question with message when user asks a question", async () => {
    const { ctx } = makeCtx({ type: "question", question: "What about step 2?" });
    const tool = createReviewPlanTool(testExec, plansDir);

    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("question");
    expect((result.details as any).message).toBe("What about step 2?");
    expect(textContent(result)).toContain("What about step 2?");
  });

  it("returns approve with empty diff when user approves without changes", async () => {
    const { ctx } = makeCtx({ type: "approve" });
    const tool = createReviewPlanTool(testExec, plansDir);

    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("approve");
    expect((result.details as any).diff).toBe("");
    expect(textContent(result)).toContain("without changes");
    expect(textContent(result)).toContain("Proceed with execution");
  });

  it("returns approve with diff when user edits plan before approving", async () => {
    const planFilePath = join(plansDir, "my-repo", "plan.md");
    const { ctx } = makeCtx(null);
    ctx.hasUI = true;
    ctx.ui.custom = vi.fn().mockImplementation(async () => {
      await writeFile(planFilePath, "# Plan\n\n1. Step A\n2. NEW STEP\n");
      return { type: "approve" };
    });

    const tool = createReviewPlanTool(testExec, plansDir);
    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("approve");
    expect((result.details as any).diff).not.toBe("");
    expect((result.details as any).diff).toMatch(/\+.*NEW STEP/);
    expect(textContent(result)).toContain("made edits");
    expect(textContent(result)).toContain("Address user comments");
  });

  it("returns request-changes with diff when user edits plan and requests changes", async () => {
    const planFilePath = join(plansDir, "my-repo", "plan.md");
    const { ctx } = makeCtx(null);
    ctx.hasUI = true;
    ctx.ui.custom = vi.fn().mockImplementation(async () => {
      await writeFile(planFilePath, "# Plan\n\n1. Step A\n- NEEDS CHANGE\n");
      return { type: "request-changes" };
    });

    const tool = createReviewPlanTool(testExec, plansDir);
    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("request-changes");
    expect((result.details as any).diff).not.toBe("");
    expect((result.details as any).diff).toMatch(/\+.*NEEDS CHANGE/);
    expect(textContent(result)).toContain("Address user comments");
    expect(textContent(result)).toContain("call review_plan again");
  });

  it("returns request-changes with empty diff when user requests changes without editing", async () => {
    const { ctx } = makeCtx({ type: "request-changes" });
    const tool = createReviewPlanTool(testExec, plansDir);

    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("request-changes");
    expect((result.details as any).diff).toBe("");
    expect(textContent(result)).toContain("No changes detected");
    expect(textContent(result)).toContain("ask what to change");
  });

  it("hides working indicator before showing UI and restores it after", async () => {
    const { ctx, setWorkingVisible } = makeCtx({ type: "cancel" });
    const tool = createReviewPlanTool(testExec, plansDir);

    await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(setWorkingVisible).toHaveBeenNthCalledWith(1, false);
    expect(setWorkingVisible).toHaveBeenNthCalledWith(2, true);
  });

  it("creates git repo and commits plan before showing UI", async () => {
    const calls: string[] = [];
    const trackingExec = async (command: string, args: string[], options?: { cwd?: string }) => {
      calls.push(`${command} ${args.join(" ")}`);
      return testExec(command, args, options);
    };

    const { ctx } = makeCtx({ type: "cancel" });
    const tool = createReviewPlanTool(trackingExec, plansDir);

    await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(calls.some((c) => c.startsWith("git init"))).toBe(true);
    expect(calls.some((c) => c.includes("commit") && c.includes("create: plan.md"))).toBe(true);
  });
});
