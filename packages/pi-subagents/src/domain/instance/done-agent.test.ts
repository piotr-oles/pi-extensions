import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentConfig } from "../agent-config.js";
import { AgentTemplate } from "../types.js";
import type { DoneAgentInstance } from "./done-agent.js";
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

function makeDone(): DoneAgentInstance {
  return new RunningAgentInstance({
    queued,
    startedAt: 1000,
    onDone: () => {},
  }).done({ reason: "completed" });
}

describe("DoneAgentInstance", () => {
  it("preserves session", () => {
    expect(makeRunning().done({ reason: "completed" }).session).toBe(mockSession);
  });

  it("preserves id and config", () => {
    const done = makeDone();
    expect(done.id).toBe(queued.id);
    expect(done.config).toBe(mockConfig);
  });

  it("captures reason and result", () => {
    const done = makeRunning().done({ reason: "completed", result: "ok" });
    expect(done.status).toBe("done");
    expect(done.reason).toBe("completed");
    expect(done.result).toBe("ok");
  });

  it("captures error", () => {
    const done = makeRunning().done({ reason: "error", error: "boom" });
    expect(done.status).toBe("done");
    expect(done.reason).toBe("error");
    expect(done.error).toBe("boom");
  });

  describe("duration", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(5000);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("is completedAt minus startedAt", () => {
      vi.setSystemTime(6000);
      const done = new RunningAgentInstance({
        queued,
        startedAt: 1000,
        onDone: () => {},
      }).done({ reason: "completed" });
      expect(done.duration).toBe(5000);
    });

    it("is fixed regardless of current time after creation", () => {
      vi.setSystemTime(6000);
      const done = new RunningAgentInstance({
        queued,
        startedAt: 1000,
        onDone: () => {},
      }).done({ reason: "completed" });
      vi.setSystemTime(999_999);
      expect(done.duration).toBe(5000);
    });

    it.each([
      "completed",
      "steered",
      "aborted",
      "stopped",
      "error",
    ] as const)("uses completedAt - startedAt for reason '%s'", (reason) => {
      const r = new RunningAgentInstance({
        queued,
        startedAt: 0,
        onDone: () => {},
      });
      vi.setSystemTime(1234);
      expect(r.done({ reason }).duration).toBe(1234);
    });
  });
});
