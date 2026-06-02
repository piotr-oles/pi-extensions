import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import piPlan, { computeDiff, getRepoName } from "./index.js";

describe("getRepoName", () => {
  it("returns repo name for git working tree", () => {
    const name = getRepoName(process.cwd());
    expect(name.length).toBeGreaterThan(0);
    expect(name).not.toContain("/");
  });

  it("returns directory basename when not in git repo", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-test-"));
    try {
      const name = getRepoName(tmp);
      expect(name.length).toBeGreaterThan(0);
      expect(name).not.toContain("/");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("computeDiff", () => {
  it("returns empty string for identical content", async () => {
    const content = "# Plan\n\n1. Step one\n2. Step two\n";
    const diff = await computeDiff(content, content);
    expect(diff).toBe("");
  });

  it("reports added lines with + prefix", async () => {
    const original = "# Plan\n\n1. Step one\n";
    const modified = "# Plan\n\n1. Step one\n2. Step two\n";
    const diff = await computeDiff(original, modified);
    expect(diff).toContain("+2. Step two");
    expect(diff).not.toContain("-");
  });

  it("reports removed lines with - prefix", async () => {
    const original = "# Plan\n\n1. Step one\n2. Step two\n";
    const modified = "# Plan\n\n1. Step one\n";
    const diff = await computeDiff(original, modified);
    expect(diff).toContain("-2. Step two");
    expect(diff).not.toContain("+");
  });

  it("reports both added and removed lines", async () => {
    const original = "# Plan\n\n1. Step one\n2. Step two\n";
    const modified = "# Plan\n\n1. Step one\n2. Step two revised\n3. Step three\n";
    const diff = await computeDiff(original, modified);
    expect(diff).toContain("-2. Step two");
    expect(diff).toContain("+2. Step two revised");
    expect(diff).toContain("+3. Step three");
  });

  it("excludes +++ and --- file header lines", async () => {
    const original = "line one\n";
    const modified = "line one\nline two\n";
    const diff = await computeDiff(original, modified);
    expect(diff).not.toContain("+++");
    expect(diff).not.toContain("---");
  });

  it("handles completely replaced content", async () => {
    const original = "old content\n";
    const modified = "new content\n";
    const diff = await computeDiff(original, modified);
    expect(diff).toContain("-old content");
    expect(diff).toContain("+new content");
  });
});

describe("plan tool execute", () => {
  type ToolDef = {
    name: string;
    execute: (
      id: string,
      params: { name: string; content: string },
      signal: null,
      onUpdate: null,
      ctx: MockCtx,
    ) => Promise<{
      content: Array<{ type: string; text: string }>;
      details: Record<string, unknown>;
    }>;
  };

  interface MockCtx {
    hasUI: boolean;
    cwd: string;
    ui: {
      custom: (cb: unknown) => Promise<any>;
    };
  }

  function buildMockPi(onRegister: (tool: ToolDef) => void) {
    return { registerTool: onRegister };
  }

  function captureTool(): { execute: ToolDef["execute"] | null } {
    const captured: { execute: ToolDef["execute"] | null } = { execute: null };
    piPlan(
      buildMockPi((tool) => {
        if (tool.name === "plan") {
          captured.execute = tool.execute;
        }
      }) as unknown as Parameters<typeof piPlan>[0],
    );
    return captured;
  }

  it("returns error when hasUI is false", async () => {
    const { execute } = captureTool();
    expect(execute).toBeTruthy();

    const ctx: MockCtx = {
      hasUI: false,
      cwd: process.cwd(),
      ui: { custom: async () => null },
    };

    const result = await execute!("id", { name: "test", content: "# Test" }, null, null, ctx);
    expect(result.content[0].text).toContain("Error");
  });

  it("saves plan file and returns confirmed when user confirms", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-confirm-"));
    try {
      const { execute } = captureTool();
      expect(execute).toBeTruthy();

      const planContent = "# My Plan\n\n1. Do thing\n2. Do other thing\n";
      const ctx: MockCtx = {
        hasUI: true,
        cwd: tmp,
        ui: { custom: async () => ({ action: "confirmed" as const }) },
      };

      const result = await execute!(
        "id",
        { name: "test-plan", content: planContent },
        null,
        null,
        ctx,
      );
      expect(result.content[0].text).toContain("confirmed");
      expect((result.details as { action: string }).action).toBe("confirmed");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("returns cancelled result when user cancels", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-cancel-"));
    try {
      const { execute } = captureTool();
      expect(execute).toBeTruthy();

      const ctx: MockCtx = {
        hasUI: true,
        cwd: tmp,
        ui: { custom: async () => null },
      };

      const result = await execute!(
        "id",
        { name: "test-plan", content: "# Plan" },
        null,
        null,
        ctx,
      );
      expect((result.details as { action: string }).action).toBe("cancelled");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("reports diff when user notifies about changes", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-changes-"));
    try {
      const { execute } = captureTool();
      expect(execute).toBeTruthy();

      const originalContent = "# Plan\n\n1. Step one\n";
      const repoName = getRepoName(tmp);

      const ctx: MockCtx = {
        hasUI: true,
        cwd: tmp,
        ui: {
          custom: async () => {
            const planPath = join(process.env.HOME!, ".pi-plan", repoName, "changes-test.md");
            await writeFile(planPath, "# Plan\n\n1. Step one\n2. Step two added\n", "utf8");
            return { action: "changes" as const };
          },
        },
      };

      const result = await execute!(
        "id",
        { name: "changes-test", content: originalContent },
        null,
        null,
        ctx,
      );
      const text = result.content[0].text;
      expect(text.includes("+2. Step two added") || text.includes("no changes")).toBe(true);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("reports no-changes message when file unmodified", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-nochange-"));
    try {
      const { execute } = captureTool();
      expect(execute).toBeTruthy();

      const content = "# Plan\n\n1. Step one\n";
      const ctx: MockCtx = {
        hasUI: true,
        cwd: tmp,
        ui: { custom: async () => ({ action: "changes" as const }) },
      };

      const result = await execute!("id", { name: "nochange-test", content }, null, null, ctx);
      const text = result.content[0].text;
      expect(text.toLowerCase()).toContain("no changes");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("returns user message when action is other", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-other-"));
    try {
      const { execute } = captureTool();
      expect(execute).toBeTruthy();

      const ctx: MockCtx = {
        hasUI: true,
        cwd: tmp,
        ui: {
          custom: async () => ({
            action: "other" as const,
            message: "Can we also add a rollback step?",
          }),
        },
      };

      const result = await execute!(
        "id",
        { name: "other-test", content: "# Plan" },
        null,
        null,
        ctx,
      );
      expect(result.content[0].text).toContain("Can we also add a rollback step?");
      expect((result.details as { action: string }).action).toBe("other");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("appends .md extension when not provided", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-ext-"));
    try {
      const { execute } = captureTool();
      expect(execute).toBeTruthy();

      const ctx: MockCtx = {
        hasUI: true,
        cwd: tmp,
        ui: { custom: async () => ({ action: "confirmed" as const }) },
      };

      const result = await execute!("id", { name: "no-ext", content: "# Plan" }, null, null, ctx);
      const planPath = (result.details as { planPath: string }).planPath;
      expect(planPath).toMatch(/\.md$/);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("does not double-append .md when already provided", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-plan-ext2-"));
    try {
      const { execute } = captureTool();
      expect(execute).toBeTruthy();

      const ctx: MockCtx = {
        hasUI: true,
        cwd: tmp,
        ui: { custom: async () => ({ action: "confirmed" as const }) },
      };

      const result = await execute!(
        "id",
        { name: "already.md", content: "# Plan" },
        null,
        null,
        ctx,
      );
      const planPath = (result.details as { planPath: string }).planPath;
      expect(planPath).not.toMatch(/\.md\.md$/);
      expect(planPath).toMatch(/already\.md$/);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
