import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commitFile, computeGitDiff, ensureGitRepo } from "./git.js";
import { createReviewPlanTool } from "./plan-tool.js";

vi.mock("./git.js", () => ({
  ensureGitRepo: vi.fn(),
  commitFile: vi.fn(),
  computeGitDiff: vi.fn(),
}));

const mockedEnsureGitRepo = vi.mocked(ensureGitRepo);
const mockedCommitFile = vi.mocked(commitFile);
const mockedComputeGitDiff = vi.mocked(computeGitDiff);

function makeExec() {
  return vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0, killed: false });
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
    const tool = createReviewPlanTool(makeExec(), "/nonexistent");

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

    mockedEnsureGitRepo.mockReset();
    mockedCommitFile.mockReset();
    mockedComputeGitDiff.mockReset();

    mockedEnsureGitRepo.mockResolvedValue(undefined);
    mockedCommitFile.mockResolvedValue(true);
    mockedComputeGitDiff.mockResolvedValue("");
  });

  afterEach(async () => {
    await rm(plansDir, { recursive: true, force: true });
  });

  it("throws when plan file does not exist", async () => {
    const { ctx, custom } = makeCtx({ type: "cancel" });
    const tool = createReviewPlanTool(makeExec(), plansDir);

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
    const tool = createReviewPlanTool(makeExec(), plansDir);

    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("cancel");
    expect(result.content).toEqual([{ type: "text", text: "User cancelled plan review." }]);
  });

  it("includes planPath in cancel details", async () => {
    const { ctx } = makeCtx({ type: "cancel" });
    const tool = createReviewPlanTool(makeExec(), plansDir);

    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("cancel");
    if (result.details.result === "cancel") {
      expect(result.details.planPath).toBe(join(plansDir, "my-repo", "plan.md"));
    }
  });

  it("returns comment with message when user leaves a comment", async () => {
    const { ctx } = makeCtx({ type: "comment", comment: "What about step 2?" });
    const tool = createReviewPlanTool(makeExec(), plansDir);

    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("comment");
    if (result.details.result === "comment") {
      expect(result.details.message).toBe("What about step 2?");
      expect(result.content).toEqual([{ type: "text", text: "User comment: What about step 2?" }]);
      expect(result.details.diff).toBe("");
    }
  });

  it("returns approve with empty diff when user approves without changes", async () => {
    const { ctx } = makeCtx({ type: "approve" });
    const tool = createReviewPlanTool(makeExec(), plansDir);

    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("approve");
    if (result.details.result === "approve") {
      expect(result.details.diff).toBe("");
      expect(result.content).toEqual([
        {
          type: "text",
          text: 'User approved the "plan.md" plan as is. Ask user about next steps.',
        },
      ]);
    }
  });

  it("returns approve with diff when user edits plan before approving", async () => {
    mockedComputeGitDiff.mockResolvedValueOnce("+4 2. NEW STEP");

    const planFilePath = join(plansDir, "my-repo", "plan.md");
    const { ctx } = makeCtx(null);
    ctx.hasUI = true;
    ctx.ui.custom = vi.fn().mockImplementation(async () => {
      await writeFile(planFilePath, "# Plan\n\n1. Step A\n2. NEW STEP\n");
      return { type: "approve" };
    });

    const tool = createReviewPlanTool(makeExec(), plansDir);
    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("approve");
    if (result.details.result === "approve") {
      expect(result.details.diff).not.toBe("");
      expect(result.details.diff).toMatch(/NEW STEP/);
    }
    expect(result.content).toEqual([
      { type: "text", text: 'User approved the "plan.md" plan and made edits:' },
      { type: "text", text: expect.stringMatching(/NEW STEP/) },
      {
        type: "text",
        text:
          "The changes mentioned above have already been saved in the plan file.\n" +
          "Address user comments, fixup the plan, then ask user about next steps.",
      },
    ]);
  });

  it("returns request-changes with diff when user edits plan and requests changes", async () => {
    mockedComputeGitDiff.mockResolvedValueOnce("+4 - NEEDS CHANGE");

    const planFilePath = join(plansDir, "my-repo", "plan.md");
    const { ctx } = makeCtx(null);
    ctx.hasUI = true;
    ctx.ui.custom = vi.fn().mockImplementation(async () => {
      await writeFile(planFilePath, "# Plan\n\n1. Step A\n- NEEDS CHANGE\n");
      return { type: "request-changes" };
    });

    const tool = createReviewPlanTool(makeExec(), plansDir);
    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("request-changes");
    if (result.details.result === "request-changes") {
      expect(result.details.diff).not.toBe("");
      expect(result.details.diff).toMatch(/NEEDS CHANGE/);
    }
    expect(result.content).toEqual([
      { type: "text", text: 'User edited the "plan.md" plan:' },
      { type: "text", text: expect.stringMatching(/NEEDS CHANGE/) },
      {
        type: "text",
        text:
          "The changes mentioned above have already been saved in the plan file.\n" +
          "Address user comments, fixup the plan, then call review_plan again.",
      },
    ]);
  });

  it("returns request-changes with empty diff when user requests changes without editing", async () => {
    const { ctx } = makeCtx({ type: "request-changes" });
    const tool = createReviewPlanTool(makeExec(), plansDir);

    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("request-changes");
    if (result.details.result === "request-changes") {
      expect(result.details.diff).toBe("");
    }
    expect(result.content).toEqual([
      {
        type: "text",
        text:
          'No changes detected in the "plan.md" plan - matches the original. ' +
          "Tell user you found no changes and ask what to change.",
      },
    ]);
  });

  it("returns comment with message and diff when user edits plan while leaving a comment", async () => {
    mockedComputeGitDiff.mockResolvedValueOnce("+4 2. NEW STEP");

    const planFilePath = join(plansDir, "my-repo", "plan.md");
    const { ctx } = makeCtx(null);
    ctx.hasUI = true;
    ctx.ui.custom = vi.fn().mockImplementation(async () => {
      await writeFile(planFilePath, "# Plan\n\n1. Step A\n2. NEW STEP\n");
      return { type: "comment", comment: "Added a new step" };
    });

    const tool = createReviewPlanTool(makeExec(), plansDir);
    const result = await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(result.details.result).toBe("comment");
    if (result.details.result === "comment") {
      expect(result.details.message).toBe("Added a new step");
      expect(result.details.diff).not.toBe("");
      expect(result.details.diff).toMatch(/NEW STEP/);
    }
    expect(result.content).toEqual([
      { type: "text", text: "User comment: Added a new step" },
      { type: "text", text: 'User also edited the "plan.md" plan:' },
      { type: "text", text: expect.stringMatching(/NEW STEP/) },
      {
        type: "text",
        text:
          "The changes mentioned above have already been saved in the plan file.\n" +
          "Address the comment, update the plan if needed, then call review_plan again.",
      },
    ]);
  });

  it("hides working indicator before showing UI and restores it after", async () => {
    const { ctx, setWorkingVisible } = makeCtx({ type: "cancel" });
    const tool = createReviewPlanTool(makeExec(), plansDir);

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
    const exec = makeExec();
    const { ctx } = makeCtx({ type: "cancel" });
    const tool = createReviewPlanTool(exec, plansDir);

    await tool.execute(
      "id",
      { planPath: "my-repo/plan.md" },
      AbortSignal.timeout(5000),
      undefined,
      ctx as any,
    );

    expect(mockedEnsureGitRepo).toHaveBeenCalledWith(exec, plansDir);
    expect(mockedCommitFile).toHaveBeenCalledWith(
      exec,
      plansDir,
      "my-repo/plan.md",
      "create: plan.md",
    );
  });
});
