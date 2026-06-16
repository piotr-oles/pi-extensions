import type { TUI } from "@earendil-works/pi-tui";
import stripAnsi from "strip-ansi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeRunning, mockSession, mockTheme, mockTui } from "../../test-helpers.js";
import { RunningAgentRow } from "./running-agent-row.js";

function render(row: RunningAgentRow): string {
  return stripAnsi(
    row
      .render(80)
      .map((l) => l.trimEnd())
      .join("\n"),
  );
}

describe("RunningAgentRow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("renders spinner and agent description", () => {
    const row = new RunningAgentRow(makeRunning({ id: "1" }), mockTui, mockTheme);
    expect(render(row)).toMatchInlineSnapshot(`"⠋ #1 my-agent · doing a task"`);
    row.stop();
  });

  it("includes token usage when reported", () => {
    const session = {
      ...mockSession,
      getContextUsage: () => ({ tokens: 1500, contextWindow: 10_000, percent: null }),
    };
    const row = new RunningAgentRow(makeRunning({ id: "1", session }), mockTui, mockTheme);
    expect(render(row)).toMatchInlineSnapshot(`"⠋ #1 my-agent · doing a task · 1.5K"`);
    row.stop();
  });

  it("advances the spinner frame as time passes", () => {
    const row = new RunningAgentRow(makeRunning({ id: "1" }), mockTui, mockTheme);
    vi.advanceTimersByTime(80);
    expect(render(row)).toMatchInlineSnapshot(`"⠙ #1 my-agent · doing a task"`);
    row.stop();
  });

  it("re-renders correctly after update()", () => {
    const instance = makeRunning({ id: "1" });
    const row = new RunningAgentRow(instance, mockTui, mockTheme);
    row.update(instance);
    expect(render(row)).toMatchInlineSnapshot(`"⠋ #1 my-agent · doing a task"`);
    row.stop();
  });
});
