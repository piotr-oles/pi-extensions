import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDone, makeQueued, makeRunning } from "../../test-helpers.js";
import type { DoneResult } from "./done-subagent.js";
import { DoneSubagent } from "./done-subagent.js";

describe("DoneAgentInstance", () => {
  it("exposes completion result", () => {
    const done = makeDone({
      result: { status: "completed", message: "the answer", steered: false },
    });
    expect(done.status).toBe("done");
    expect(done.result).toEqual({ status: "completed", message: "the answer", steered: false });
  });

  it("exposes error message when session fails", () => {
    const done = makeDone({ result: { status: "error", error: "timeout" } });
    expect(done.status).toBe("done");
    expect(done.result).toEqual({ status: "error", error: "timeout" });
  });

  it("preserves agent id through lifecycle transitions", () => {
    const done = makeDone({
      id: "agent-7",
      result: { status: "completed", message: "", steered: false },
    });
    expect(done.id).toBe("agent-7");
  });

  it("has zero duration when agent was aborted before ever starting", () => {
    const done = makeQueued().abort();
    expect(done.duration).toBe(0);
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
      const done = new DoneSubagent({
        instance: makeRunning({ startedAt: 1000 }),
        result: { status: "completed", message: "", steered: false },
      });
      expect(done.duration).toBe(5000);
    });

    it("is fixed regardless of current time after creation", () => {
      vi.setSystemTime(6000);
      const done = new DoneSubagent({
        instance: makeRunning({ startedAt: 1000 }),
        result: { status: "completed", message: "", steered: false },
      });
      vi.setSystemTime(999_999);
      expect(done.duration).toBe(5000);
    });

    it.each([
      { status: "completed", message: "", steered: false },
      { status: "completed", message: "", steered: true },
      { status: "aborted" },
      { status: "exceeded_limit", limit: { type: "turns", maxTurns: 5, graceTurns: 0 } },
      { status: "error", error: "fail" },
    ] as const satisfies DoneResult[])("uses completedAt - startedAt for result status '%s'", (result) => {
      vi.setSystemTime(1234);
      expect(makeDone({ result }).duration).toBe(1234);
    });
  });
});
