import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentConfig } from "../agent-config.js";
import { AgentTemplate } from "../types.js";
import { QueuedAgentInstance } from "./queued-agent.js";
import { RunningAgentInstance } from "./running-agent.js";

const mockTemplate = new AgentTemplate({
  name: "test",
  description: "test agent",
  instructions: "",
  source: "global",
});

const mockConfig = new AgentConfig({
  template: mockTemplate,
  description: "test task",
  prompt: "do something",
  activeTools: [],
});

const mockSession = {
  messages: [],
  steer: async () => {},
  abort: () => {},
  bindExtensions: async () => {},
  prompt: async () => {},
  subscribe: () => () => {},
} as unknown as AgentSession;

const queued = new QueuedAgentInstance({
  id: "test-id",
  config: mockConfig,
  session: mockSession,
  signal: undefined,
});

function makeRunning(): RunningAgentInstance {
  return new RunningAgentInstance({ queued, startedAt: 0, onDone: () => {} });
}

describe("RunningAgentInstance", () => {
  it("exposes session", () => {
    expect(makeRunning().session).toBe(mockSession);
  });

  it("activeTools starts empty", () => {
    expect(makeRunning().activeTools.length).toBe(0);
  });

  describe("duration", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(5000);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns elapsed time since startedAt", () => {
      const r = new RunningAgentInstance({
        queued,
        startedAt: 2000,
        onDone: () => {},
      });
      expect(r.duration).toBe(3000);
    });
  });
});
