import stripAnsi from "strip-ansi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeAgentConfig, makeDone, mockSession, mockTheme } from "../../test-helpers.js";
import { DoneAgentRow } from "./done-agent-row.js";

function render(row: DoneAgentRow): string {
  return stripAnsi(
    row
      .render(80)
      .map((l) => l.trimEnd())
      .join("\n"),
  );
}

describe("DoneAgentRow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 'completed' reason", () => {
    expect(render(new DoneAgentRow(makeDone({ id: "1" }), mockTheme))).toMatchInlineSnapshot(
      `"✓ #1 my-agent · doing a task · 5.0s"`,
    );
  });

  it("renders 'steered' reason", () => {
    expect(render(new DoneAgentRow(makeDone({ id: "1", reason: "steered" }), mockTheme))).toMatchInlineSnapshot(
      `"✓ #1 my-agent · doing a task · 5.0s"`,
    );
  });

  it("renders 'stopped' reason", () => {
    expect(render(new DoneAgentRow(makeDone({ id: "1", reason: "stopped" }), mockTheme))).toMatchInlineSnapshot(
      `"■ #1 my-agent · doing a task · 5.0s"`,
    );
  });

  it("renders 'aborted' reason", () => {
    expect(render(new DoneAgentRow(makeDone({ id: "1", reason: "aborted" }), mockTheme))).toMatchInlineSnapshot(
      `"✗ #1 my-agent · doing a task · 5.0s"`,
    );
  });

  it("renders 'error' reason", () => {
    expect(render(new DoneAgentRow(makeDone({ id: "1", reason: "error" }), mockTheme))).toMatchInlineSnapshot(
      `"✗ #1 my-agent · doing a task · 5.0s"`,
    );
  });

  it("includes token usage when reported", () => {
    const session = {
      ...mockSession,
      getContextUsage: () => ({ tokens: 1500, contextWindow: 10_000, percent: null }),
    };
    const row = new DoneAgentRow(makeDone({ id: "1", session }), mockTheme);
    expect(render(row)).toMatchInlineSnapshot(`"✓ #1 my-agent · doing a task · 1.5K · 5.0s"`);
  });

  it("truncates descriptions longer than 50 characters", () => {
    const config = makeAgentConfig({ description: "x".repeat(60) });
    const row = new DoneAgentRow(makeDone({ id: "1", config }), mockTheme);
    expect(render(row)).toMatchInlineSnapshot(`"✓ #1 my-agent · xxxxxxxxxxxxxxxxxxxxxx... · 5.0s"`);
  });

  it("re-renders correctly after invalidate()", () => {
    const row = new DoneAgentRow(makeDone({ id: "1" }), mockTheme);
    row.invalidate();
    expect(render(row)).toMatchInlineSnapshot(`"✓ #1 my-agent · doing a task · 5.0s"`);
  });
});
