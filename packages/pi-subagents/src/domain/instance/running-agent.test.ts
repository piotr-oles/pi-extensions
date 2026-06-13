import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DoneAgentInstance } from "./done-agent.js";
import { RunningAgentInstance } from "./running-agent.js";
import { makeQueued } from "./test-helpers.js";
import { ScriptedSessionBuilder } from "../../test-helpers/scripted-session-builder.js";
import { ScriptedSession } from "../../test-helpers/scripted-session.js";

interface RunOptions {
  maxTurns?: number;
  graceTurns?: number;
  signal?: AbortSignal;
}

interface RunResult {
  done: DoneAgentInstance;
  updates: RunningAgentInstance[];
}

function run(session: ScriptedSession | ScriptedSessionBuilder, options: RunOptions = {}): Promise<RunResult> {
  const scripted = session instanceof ScriptedSessionBuilder ? session.build() : session;
  const queued = makeQueued({ session: scripted, signal: options.signal, maxTurns: options.maxTurns, graceTurns: options.graceTurns });
  const updates: RunningAgentInstance[] = [];
  return new Promise<RunResult>((resolve) => {
    RunningAgentInstance.start({
      queued,
      startedAt: 0,
      onUpdate: (running) => updates.push(running),
      onDone: (done) => resolve({ done, updates }),
    });
  });
}

describe("RunningAgentInstance", () => {
  describe("completion reasons", () => {
    it("completes with reason 'completed' when session ends normally", async () => {
      const { done } = await run(new ScriptedSessionBuilder().complete("final answer"));
      expect(done.reason).toBe("completed");
      expect(done.result).toBe("final answer");
    });

    it("completes after multiple turns with reason 'completed'", async () => {
      const { done } = await run(new ScriptedSessionBuilder().turns(3).complete("done"));
      expect(done.reason).toBe("completed");
      expect(done.result).toBe("done");
    });

    it("completes with reason 'error' when session throws", async () => {
      const { done } = await run(new ScriptedSessionBuilder().fail("network timeout"));
      expect(done.reason).toBe("error");
      expect(done.error).toBe("network timeout");
    });

    it("completes with reason 'error' after turns when session throws", async () => {
      const { done } = await run(new ScriptedSessionBuilder().turns(2).fail("boom"));
      expect(done.reason).toBe("error");
      expect(done.error).toBe("boom");
    });

    it("completes with reason 'steered' when agent finishes after reaching soft turn limit", async () => {
      const { done } = await run(
        new ScriptedSessionBuilder().turns(5).complete("wrapped up"),
        { maxTurns: 5 },
      );
      expect(done.reason).toBe("steered");
    });

    it("completes with reason 'aborted' when agent exceeds maxTurns + graceTurns", async () => {
      const { done } = await run(
        new ScriptedSessionBuilder().turns(20).complete("won't reach"),
        { maxTurns: 5, graceTurns: 3 },
      );
      expect(done.reason).toBe("aborted");
    });

    it("completes with reason 'stopped' when external signal fires mid-session", async () => {
      const controller = new AbortController();
      const { done } = await run(
        new ScriptedSessionBuilder()
          .turn()
          .sideEffect(() => controller.abort())
          .turns(10)
          .complete("won't reach"),
        { signal: controller.signal },
      );
      expect(done.reason).toBe("stopped");
    });
  });

  describe("soft turn limit", () => {
    it("sends a steer message when maxTurns is reached", async () => {
      const session = new ScriptedSessionBuilder().turns(5).complete("done");
      await run(session, { maxTurns: 5 });
      expect(session.steeredMessages).toHaveLength(1);
      expect(session.steeredMessages[0]).toContain("turn limit");
    });

    it("sends the steer message exactly once even through grace turns", async () => {
      const session = new ScriptedSessionBuilder().turns(20).complete("done");
      await run(session, { maxTurns: 5, graceTurns: 3 });
      expect(session.steeredMessages).toHaveLength(1);
    });

    it("does not steer when maxTurns is not configured", async () => {
      const session = new ScriptedSessionBuilder().turns(10).complete("done");
      await run(session);
      expect(session.steeredMessages).toHaveLength(0);
    });
  });

  describe("onUpdate callbacks", () => {
    it("calls onUpdate for each completed turn", async () => {
      const { updates } = await run(new ScriptedSessionBuilder().turns(3).complete());
      expect(updates).toHaveLength(3);
    });

    it("does not call onUpdate for the turn that hits the hard limit", async () => {
      const { updates } = await run(
        new ScriptedSessionBuilder().turns(20).complete(),
        { maxTurns: 5, graceTurns: 3 },
      );
      expect(updates).toHaveLength(7);
    });

    it("calls onUpdate for non-turn-end events", async () => {
      const { updates } = await run(
        new ScriptedSessionBuilder()
          .event("tool_execution_start")
          .event("tool_execution_end")
          .complete(),
      );
      expect(updates).toHaveLength(2);
    });

    it("calls onUpdate for a mix of turns and other events", async () => {
      const { updates } = await run(
        new ScriptedSessionBuilder()
          .event("tool_execution_start")
          .turn()
          .event("tool_execution_end")
          .turn()
          .complete(),
      );
      expect(updates).toHaveLength(4);
    });
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
      const running = RunningAgentInstance.start({
        queued: makeQueued({ session: new ScriptedSessionBuilder().build() }),
        startedAt: 2000,
        onDone: () => {},
      });
      expect(running.duration).toBe(3000);
    });
  });
});
