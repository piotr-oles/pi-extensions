import { describe, expect, it } from "vitest";
import { makeAgentConfig, makeAgentTemplate } from "../test-helpers.js";

const BASE_TEMPLATE = makeAgentTemplate({
  name: "coder",
  description: "Writes code",
  instructions: "Write clean code.",
  excludedTools: ["bash"],
  model: "claude-3",
  thinkingLevel: "medium",
  maxTurns: 10,
  graceTurns: 3,
});

describe("AgentConfig", () => {
  describe("configuration resolution", () => {
    it("uses template values when no overrides given", () => {
      const cfg = makeAgentConfig({ template: BASE_TEMPLATE });
      expect(cfg.name).toBe("coder");
      expect(cfg.instructions).toBe("Write clean code.");
      expect(cfg.model).toBe("claude-3");
      expect(cfg.thinkingLevel).toBe("medium");
      expect(cfg.maxTurns).toBe(10);
      expect(cfg.graceTurns).toBe(3);
    });

    it("applies overrides over template values", () => {
      const cfg = makeAgentConfig({
        template: BASE_TEMPLATE,
        overrides: { model: "gpt-4o", maxTurns: 20, graceTurns: 1 },
      });
      expect(cfg.model).toBe("gpt-4o");
      expect(cfg.maxTurns).toBe(20);
      expect(cfg.graceTurns).toBe(1);
      expect(cfg.thinkingLevel).toBe("medium");
    });

    it("defaults graceTurns to 5 when neither override nor template specifies it", () => {
      const cfg = makeAgentConfig();
      expect(cfg.graceTurns).toBe(5);
    });
  });

  describe("tool filtering", () => {
    it("never grants subagent coordination tools regardless of activeTools", () => {
      const cfg = makeAgentConfig({
        activeTools: ["read", "subagent", "subagent_check", "subagent_steer", "write"],
      });
      expect(cfg.enabledTools).not.toContain("subagent");
      expect(cfg.enabledTools).not.toContain("subagent_check");
      expect(cfg.enabledTools).not.toContain("subagent_steer");
      expect(cfg.enabledTools).toContain("read");
      expect(cfg.enabledTools).toContain("write");
    });

    it("excludes tools listed in template excludedTools", () => {
      const cfg = makeAgentConfig({
        template: BASE_TEMPLATE,
        activeTools: ["read", "bash", "write"],
      });
      expect(cfg.enabledTools).not.toContain("bash");
      expect(cfg.enabledTools).toContain("read");
      expect(cfg.enabledTools).toContain("write");
    });

    it("only enables tools that appear in activeTools", () => {
      const cfg = makeAgentConfig({ template: BASE_TEMPLATE, activeTools: ["read"] });
      expect(cfg.enabledTools).toEqual(["read"]);
    });
  });
});
