import { describe, expect, it } from "vitest";
import { AgentConfig } from "../agent-config.js";
import { AgentTemplate } from "../types.js";
import { makeQueued, mockSession } from "./test-helpers.js";

describe("QueuedAgentInstance", () => {
  it("stores session", () => {
    const queued = makeQueued();
    expect(queued.session).toBe(mockSession);
  });

  it("run() returns RunningAgentInstance with same identity", () => {
    const queued = makeQueued({
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
    });
    const running = queued.run({ onDone: () => {} });

    expect(running.status).toBe("running");
    expect(running.id).toBe("q1");
    expect(running.config.name).toBe("n");
    expect(running.config.maxTurns).toBe(5);
    expect(running.session).toBe(mockSession);
  });
});
