import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { AgentConfig } from "../agent-config.js";
import { AgentTemplate } from "../types.js";
import { QueuedAgentInstance } from "./queued-agent.js";

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

describe("QueuedAgentInstance", () => {
  it("stores session", () => {
    expect(queued.session).toBe(mockSession);
  });

  it("run() returns RunningAgentInstance with same identity", () => {
    const q = new QueuedAgentInstance({
      id: "q1",
      config: new AgentConfig({
        template: new AgentTemplate({
          name: "n",
          description: "agent",
          instructions: "",
          maxTurns: 5,
          source: "global",
        }),
        description: "d",
        prompt: "go",
        activeTools: [],
      }),
      session: mockSession,
      signal: undefined,
    });
    const r = q.run({ onDone: () => {} });

    expect(r.status).toBe("running");
    expect(r.id).toBe("q1");
    expect(r.config.name).toBe("n");
    expect(r.config.maxTurns).toBe(5);
    expect(r.session).toBe(mockSession);
  });
});
