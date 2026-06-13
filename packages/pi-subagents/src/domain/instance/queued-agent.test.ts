import { describe, expect, it } from "vitest";
import { AgentConfig } from "../agent-config.js";
import { AgentTemplate } from "../types.js";
import { makeQueued } from "./test-helpers.js";

describe("QueuedAgentInstance", () => {
  it("transitions to running state when started", () => {
    const running = makeQueued({ id: "q1" }).run({ onDone: () => {} });
    expect(running.status).toBe("running");
    expect(running.id).toBe("q1");
  });

  it("carries config into the running state", () => {
    const config = new AgentConfig({
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
    });
    const running = makeQueued({ config }).run({ onDone: () => {} });
    expect(running.config.name).toBe("n");
    expect(running.config.maxTurns).toBe(5);
  });

  it("transitions to done with reason 'aborted' when aborted before starting", () => {
    const done = makeQueued({ id: "q1" }).abort();
    expect(done.status).toBe("done");
    expect(done.reason).toBe("aborted");
    expect(done.id).toBe("q1");
  });
});
