import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScriptedSessionBuilder } from "../../test-helpers/scripted-session-builder.js";
import { makeQueued } from "../../test-helpers.js";
import type { DoneSubagent } from "./done-subagent.js";
import { RunningSubagent } from "./running-subagent.js";

interface RunOptions {
  maxTurns?: number;
  graceTurns?: number;
  onStart?: (running: RunningSubagent) => void;
  startedAt?: number;
}

interface RunResult {
  done: DoneSubagent;
  updateCount: number;
}

function run(session: ScriptedSessionBuilder, options: RunOptions = {}): Promise<RunResult> {
  const scripted = session.build();
  const queued = makeQueued({
    session: scripted,
    maxTurns: options.maxTurns,
    graceTurns: options.graceTurns,
  });
  let updateCount = 0;
  return new Promise<RunResult>((resolve) => {
    const running = RunningSubagent.start({
      instance: queued,
      prompt: queued.prompt,
      description: queued.description,
      startedAt: options.startedAt ?? 0,
      onUpdate: () => {
        updateCount++;
      },
      onDone: (done) => resolve({ done, updateCount }),
    });
    options.onStart?.(running);
  });
}

describe("RunningAgentInstance", () => {
  describe("completion reasons", () => {
    it("completes with reason 'completed' when session ends normally", async () => {
      const { done } = await run(new ScriptedSessionBuilder().complete("final answer"));
      expect(done.result).toEqual({ status: "completed", message: "final answer", steered: false });
    });

    it("completes after multiple turns with reason 'completed'", async () => {
      const { done } = await run(new ScriptedSessionBuilder().turns(3).complete("done"));
      expect(done.result).toEqual({ status: "completed", message: "done", steered: false });
    });

    it("completes with reason 'error' when session throws", async () => {
      const { done } = await run(new ScriptedSessionBuilder().fail("network timeout"));
      expect(done.result).toEqual({ status: "error", error: "network timeout" });
    });

    it("completes with reason 'error' after turns when session throws", async () => {
      const { done } = await run(new ScriptedSessionBuilder().turns(2).fail("boom"));
      expect(done.result).toEqual({ status: "error", error: "boom" });
    });

    it("completes with reason 'steered' when agent finishes after reaching soft turn limit", async () => {
      const { done } = await run(new ScriptedSessionBuilder().turns(5).complete("wrapped up"), {
        maxTurns: 5,
      });
      expect(done.result).toMatchObject({ status: "completed", steered: true });
    });

    it("completes with reason 'aborted' when agent exceeds maxTurns + graceTurns", async () => {
      const { done } = await run(new ScriptedSessionBuilder().turns(20).complete("won't reach"), {
        maxTurns: 5,
        graceTurns: 3,
      });
      expect(done.result.status).toBe("exceeded_limit");
    });

    it("completes with reason 'aborted' when abort() is called mid-session", async () => {
      let runningRef!: RunningSubagent;
      const { done } = await run(
        new ScriptedSessionBuilder()
          .turn()
          .sideEffect(() => {
            runningRef.abort();
          })
          .turns(10)
          .complete("won't reach"),
        {
          onStart: (r) => {
            runningRef = r;
          },
        },
      );
      expect(done.result.status).toBe("aborted");
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

  describe("progress updates", () => {
    it("fires an update for each completed turn", async () => {
      const { updateCount } = await run(new ScriptedSessionBuilder().turns(3).complete());
      expect(updateCount).toBe(3);
    });

    it("does not fire an update for the turn that hits the hard limit", async () => {
      const { updateCount } = await run(new ScriptedSessionBuilder().turns(20).complete(), {
        maxTurns: 5,
        graceTurns: 3,
      });
      expect(updateCount).toBe(7);
    });

    it("fires an update for non-turn-end events", async () => {
      const { updateCount } = await run(
        new ScriptedSessionBuilder()
          .event("tool_execution_start")
          .event("tool_execution_end")
          .complete(),
      );
      expect(updateCount).toBe(2);
    });

    it("fires an update for a mix of turns and other events", async () => {
      const { updateCount } = await run(
        new ScriptedSessionBuilder()
          .event("tool_execution_start")
          .turn()
          .event("tool_execution_end")
          .turn()
          .complete(),
      );
      expect(updateCount).toBe(4);
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

    it("records total elapsed time from start to completion", async () => {
      const { done } = await run(new ScriptedSessionBuilder().complete(), { startedAt: 2000 });
      expect(done.duration).toBe(3000);
    });
  });
});
