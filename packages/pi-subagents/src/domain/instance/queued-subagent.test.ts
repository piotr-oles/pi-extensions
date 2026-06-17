import { describe, expect, it } from "vitest";
import { makeAgentConfig, makeAgentTemplate, makeQueued } from "../../test-helpers.js";

describe("QueuedAgentInstance", () => {
  it("transitions to running state when started", () => {
    const running = makeQueued({ id: "q1" }).run({ onUpdate: () => {}, onDone: () => {} });
    expect(running.status).toBe("running");
    expect(running.id).toBe("q1");
  });

  it("carries config into the running state", () => {
    const running = makeQueued({
      config: makeAgentConfig({
        name: "n",
        template: makeAgentTemplate({ name: "n" }),
        maxTurns: 5,
      }),
    }).run({ onUpdate: () => {}, onDone: () => {} });
    expect(running.config.name).toBe("n");
    expect(running.config.maxTurns).toBe(5);
  });

  it("transitions to done with reason 'aborted' when aborted before starting", () => {
    const done = makeQueued({ id: "q1" }).abort();
    expect(done.status).toBe("done");
    expect(done.result.status).toBe("aborted");
    expect(done.id).toBe("q1");
  });
});
