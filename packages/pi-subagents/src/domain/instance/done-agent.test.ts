import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDone, makeQueued, makeRunning } from "../../test-helpers.js";

describe("DoneAgentInstance", () => {
  it("exposes completion result", () => {
    const done = makeRunning().done({ reason: "completed", result: "the answer" });
    expect(done.status).toBe("done");
    expect(done.reason).toBe("completed");
    expect(done.result).toBe("the answer");
  });

  it("exposes error message when session fails", () => {
    const done = makeRunning().done({ reason: "error", error: "timeout" });
    expect(done.status).toBe("done");
    expect(done.reason).toBe("error");
    expect(done.error).toBe("timeout");
  });

  it("preserves agent id through lifecycle transitions", () => {
    const done = makeRunning({ id: "agent-7" }).done({ reason: "completed" });
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
      const done = makeRunning({ startedAt: 1000 }).done({ reason: "completed" });
      expect(done.duration).toBe(5000);
    });

    it("is fixed regardless of current time after creation", () => {
      vi.setSystemTime(6000);
      const done = makeRunning({ startedAt: 1000 }).done({ reason: "completed" });
      vi.setSystemTime(999_999);
      expect(done.duration).toBe(5000);
    });

    it.each([
      "completed",
      "stopped",
      "error",
    ] as const)("uses completedAt - startedAt for reason '%s'", (reason) => {
      vi.setSystemTime(1234);
      expect(makeDone({ reason }).duration).toBe(1234);
    });
  });
});
