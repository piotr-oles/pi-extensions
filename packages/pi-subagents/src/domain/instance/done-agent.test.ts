import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeQueued, makeDone, makeRunning, mockConfig } from "./test-helpers.js";

describe("DoneAgentInstance", () => {
  it("preserves session", () => {
    expect(makeRunning().done({ reason: "completed" }).session).toBeDefined();
  });

  it("preserves id and config", () => {
    const queued = makeQueued();
    const done = makeRunning(queued).done({ reason: "completed" });
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
      const done = makeRunning(makeQueued(), 1000).done({ reason: "completed" });
      expect(done.duration).toBe(5000);
    });

    it("is fixed regardless of current time after creation", () => {
      vi.setSystemTime(6000);
      const done = makeRunning(makeQueued(), 1000).done({ reason: "completed" });
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
      vi.setSystemTime(1234);
      expect(makeDone(reason).duration).toBe(1234);
    });
  });
});
