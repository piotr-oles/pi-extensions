import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SubagentTemplatesManager } from "./subagent-templates-manager.js";

async function load(cwd: string) {
  const templatesManager = new SubagentTemplatesManager(cwd);
  await templatesManager.reload();
  return templatesManager.listTemplates();
}

let globalAgentsDir = "";

vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => {
  const original = await importOriginal<typeof import("@earendil-works/pi-coding-agent")>();
  return { ...original, getAgentDir: () => globalAgentsDir };
});

beforeAll(async () => {
  globalAgentsDir = await mkdtemp(join(tmpdir(), "pi-sub-af-global-"));
  await mkdir(join(globalAgentsDir, "subagents"), { recursive: true });
});

afterAll(async () => {
  await rm(globalAgentsDir, { recursive: true, force: true });
});

describe("loadCustomAgents", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "pi-sub-af-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("returns empty array when neither global nor project dirs have agents", async () => {
    expect((await load(cwd)).length).toBe(0);
  });

  it("loads an agent from the global agents dir", async () => {
    const globalPath = join(globalAgentsDir, "subagents", "my-agent.md");
    await writeFile(
      globalPath,
      ["---", "description: My global agent", "---", "", "You are a helpful assistant."].join("\n"),
      "utf-8",
    );

    const cfg = (await load(cwd)).find((t) => t.name === "my-agent")!;
    expect(cfg.description).toBe("My global agent");
    expect(cfg.instructions).toBe("You are a helpful assistant.");
    expect(cfg.source).toBe("global");

    await rm(globalPath, { force: true });
  });

  it("loads an agent from the project agents dir", async () => {
    await mkdir(join(cwd, ".pi", "subagents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "subagents", "proj-agent.md"),
      ["---", "description: Project-specific agent", "---", "", "Focus on this project only."].join(
        "\n",
      ),
      "utf-8",
    );

    const cfg = (await load(cwd)).find((t) => t.name === "proj-agent")!;
    expect(cfg.source).toBe("project");
    expect(cfg.instructions).toBe("Focus on this project only.");
  });

  it("project agent overrides global agent with same name", async () => {
    const globalPath = join(globalAgentsDir, "subagents", "shared.md");
    await writeFile(
      globalPath,
      ["---", "description: Global version", "---", "", "Global prompt."].join("\n"),
      "utf-8",
    );
    await mkdir(join(cwd, ".pi", "subagents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "subagents", "shared.md"),
      ["---", "description: Project version", "---", "", "Project prompt."].join("\n"),
      "utf-8",
    );

    const cfg = (await load(cwd)).find((t) => t.name === "shared")!;
    expect(cfg.description).toBe("Project version");
    expect(cfg.source).toBe("project");

    await rm(globalPath, { force: true });
  });

  it("parses optional fields: model, thinking, max_turns, included_tools", async () => {
    await mkdir(join(cwd, ".pi", "subagents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "subagents", "full.md"),
      [
        "---",
        "description: Full agent",
        "model: anthropic/claude-haiku-4-5",
        "thinking: low",
        "max_turns: 10",
        "included_tools: edit, write",
        "---",
        "",
        "Specialized prompt.",
      ].join("\n"),
      "utf-8",
    );

    const cfg = (await load(cwd)).find((t) => t.name === "full")!;
    expect(cfg.model).toBe("anthropic/claude-haiku-4-5");
    expect(cfg.thinkingLevel).toBe("low");
    expect(cfg.maxTurns).toBe(10);
    expect(cfg.includedTools).toEqual(["edit", "write"]);
  });

  it("parses included_subagents as array", async () => {
    await mkdir(join(cwd, ".pi", "subagents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "subagents", "orchestrator.md"),
      ["---", "description: Orchestrator", "included_subagents: explorer, reviewer", "---"].join(
        "\n",
      ),
      "utf-8",
    );

    const cfg = (await load(cwd)).find((t) => t.name === "orchestrator")!;
    expect(cfg.includedSubagents).toEqual(["explorer", "reviewer"]);
  });

  it("leaves includedSubagents undefined when field absent", async () => {
    await mkdir(join(cwd, ".pi", "subagents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "subagents", "basic.md"),
      ["---", "description: Basic agent", "---"].join("\n"),
      "utf-8",
    );

    const cfg = (await load(cwd)).find((t) => t.name === "basic")!;
    expect(cfg.includedSubagents).toBeUndefined();
  });

  it("defaults enabled to true when not specified", async () => {
    await mkdir(join(cwd, ".pi", "subagents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "subagents", "default-enabled.md"),
      ["---", "description: test", "---"].join("\n"),
      "utf-8",
    );

    expect((await load(cwd)).find((t) => t.name === "default-enabled")!.enabled).toBe(true);
  });

  it("respects enabled: false", async () => {
    await mkdir(join(cwd, ".pi", "subagents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "subagents", "disabled.md"),
      ["---", "description: test", "enabled: false", "---"].join("\n"),
      "utf-8",
    );

    expect((await load(cwd)).find((t) => t.name === "disabled")!.enabled).toBe(false);
  });

  it("uses filename as description fallback when description not set", async () => {
    await mkdir(join(cwd, ".pi", "subagents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "subagents", "no-desc.md"),
      ["---", "---", "", "Some prompt."].join("\n"),
      "utf-8",
    );

    expect((await load(cwd)).find((t) => t.name === "no-desc")!.description).toBe("no-desc");
  });

  it("parses included_skills as CSV array", async () => {
    await mkdir(join(cwd, ".pi", "subagents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "subagents", "with-skills.md"),
      [
        "---",
        "description: Agent with skills",
        "included_skills: tdd, refactoring, librarian",
        "---",
        "",
        "Use these skills.",
      ].join("\n"),
      "utf-8",
    );

    const cfg = (await load(cwd)).find((t) => t.name === "with-skills")!;
    expect(cfg.includedSkills).toEqual(["tdd", "refactoring", "librarian"]);
  });

  it("handles whitespace in included_skills CSV", async () => {
    await mkdir(join(cwd, ".pi", "subagents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "subagents", "whitespace.md"),
      ["---", "description: test", "included_skills: tdd , refactoring , librarian", "---"].join(
        "\n",
      ),
      "utf-8",
    );

    const cfg = (await load(cwd)).find((t) => t.name === "whitespace")!;
    expect(cfg.includedSkills).toEqual(["tdd", "refactoring", "librarian"]);
  });

  it("leaves includedSkills undefined when field absent", async () => {
    await mkdir(join(cwd, ".pi", "subagents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "subagents", "no-skills.md"),
      ["---", "description: test", "---"].join("\n"),
      "utf-8",
    );

    const cfg = (await load(cwd)).find((t) => t.name === "no-skills")!;
    expect(cfg.includedSkills).toBeUndefined();
  });

  it("treats empty included_skills as undefined", async () => {
    await mkdir(join(cwd, ".pi", "subagents"), { recursive: true });
    await writeFile(
      join(cwd, ".pi", "subagents", "empty-skills.md"),
      ["---", "description: test", "included_skills: ", "---"].join("\n"),
      "utf-8",
    );

    const cfg = (await load(cwd)).find((t) => t.name === "empty-skills")!;
    expect(cfg.includedSkills).toBeUndefined();
  });
});
