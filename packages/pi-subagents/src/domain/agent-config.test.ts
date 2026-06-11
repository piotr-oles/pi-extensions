import { describe, expect, it } from "vitest";
import { AgentConfig } from "./agent-config.js";
import { AgentTemplate } from "./types.js";

const BASE_TEMPLATE = new AgentTemplate({
  name: "coder",
  description: "Writes code",
  instructions: "Write clean code.",
  excludedTools: ["bash"],
  model: "claude-3",
  thinkingLevel: "medium",
  maxTurns: 10,
  graceTurns: 3,
  enabled: true,
  source: "global",
});

describe("AgentConfig constructor", () => {
  it("copies non-overridable fields from template", () => {
    const cfg = new AgentConfig({
      template: BASE_TEMPLATE,
      description: "task desc",
      prompt: "do the thing",
      activeTools: [],
    });
    expect(cfg.name).toBe("coder");
    expect(cfg.instructions).toBe("Write clean code.");
  });

  it("uses template overridable fields when no overrides given", () => {
    const cfg = new AgentConfig({
      template: BASE_TEMPLATE,
      description: "d",
      prompt: "p",
      activeTools: [],
    });
    expect(cfg.model).toBe("claude-3");
    expect(cfg.thinkingLevel).toBe("medium");
    expect(cfg.maxTurns).toBe(10);
    expect(cfg.graceTurns).toBe(3);
  });

  it("applies overrides over template values", () => {
    const cfg = new AgentConfig({
      template: BASE_TEMPLATE,
      overrides: { model: "gpt-4o", maxTurns: 20, graceTurns: 1 },
      description: "d",
      prompt: "p",
      activeTools: [],
    });
    expect(cfg.model).toBe("gpt-4o");
    expect(cfg.maxTurns).toBe(20);
    expect(cfg.graceTurns).toBe(1);
    expect(cfg.thinkingLevel).toBe("medium");
  });

  it("defaults graceTurns to 5 when neither override nor template specifies it", () => {
    const tpl = new AgentTemplate({
      name: "x",
      description: "x",
      instructions: "",
      source: "global",
    });
    const cfg = new AgentConfig({
      template: tpl,
      description: "d",
      prompt: "p",
      activeTools: [],
    });
    expect(cfg.graceTurns).toBe(5);
  });

  it("stores run-specific fields", () => {
    const cfg = new AgentConfig({
      template: BASE_TEMPLATE,
      description: "my task",
      prompt: "run tests",
      activeTools: ["read", "write"],
    });
    expect(cfg.description).toBe("my task");
    expect(cfg.prompt).toBe("run tests");
  });

  it("stores original template", () => {
    const cfg = new AgentConfig({
      template: BASE_TEMPLATE,
      overrides: { model: "gpt-4o" },
      description: "d",
      prompt: "p",
      activeTools: [],
    });
    expect(cfg.template).toBe(BASE_TEMPLATE);
  });

  it("excludes subagent tools from enabledTools regardless of activeTools", () => {
    const cfg = new AgentConfig({
      template: new AgentTemplate({
        name: "t",
        description: "",
        instructions: "",
        source: "global",
      }),
      description: "d",
      prompt: "p",
      activeTools: ["read", "subagent", "subagent_check", "subagent_steer", "write"],
    });
    expect(cfg.enabledTools).not.toContain("subagent");
    expect(cfg.enabledTools).not.toContain("subagent_check");
    expect(cfg.enabledTools).not.toContain("subagent_steer");
    expect(cfg.enabledTools).toContain("read");
    expect(cfg.enabledTools).toContain("write");
  });

  it("excludes template-level excludedTools from enabledTools", () => {
    const cfg = new AgentConfig({
      template: BASE_TEMPLATE,
      description: "d",
      prompt: "p",
      activeTools: ["read", "bash", "write"],
    });
    expect(cfg.enabledTools).not.toContain("bash");
    expect(cfg.enabledTools).toContain("read");
    expect(cfg.enabledTools).toContain("write");
  });

  it("enabledTools only contains tools from activeTools", () => {
    const cfg = new AgentConfig({
      template: BASE_TEMPLATE,
      description: "d",
      prompt: "p",
      activeTools: ["read"],
    });
    expect(cfg.enabledTools).toEqual(["read"]);
  });
});
