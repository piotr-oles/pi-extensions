import type { TUI } from "@earendil-works/pi-tui";
import stripAnsi from "strip-ansi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDone, makeQueued, makeRunning, mockTheme, mockTui } from "../../test-helpers.js";
import { AgentListComponent } from "./agent-list-component.js";

function render(component: AgentListComponent): string {
  return stripAnsi(
    component
      .render(80)
      .map((l) => l.trimEnd())
      .join("\n"),
  );
}

describe("AgentListComponent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("renders nothing when there are no instances", () => {
    const component = new AgentListComponent(() => [], mockTui, mockTheme);
    expect(render(component)).toMatchInlineSnapshot(`""`);
  });

  it("renders header and done rows", () => {
    const component = new AgentListComponent(
      () => [makeDone({ id: "1" }), makeDone({ id: "2" })],
      mockTui,
      mockTheme,
    );
    expect(render(component)).toMatchInlineSnapshot(`
      "● Subagents
      ✓ #1 my-agent · doing a task · 5.0s
      ✓ #2 my-agent · doing a task · 5.0s"
    `);
    component.dispose();
  });

  it("renders queued count for queued instances", () => {
    const component = new AgentListComponent(
      () => [makeQueued({ id: "1" }), makeQueued({ id: "2" })],
      mockTui,
      mockTheme,
    );
    expect(render(component)).toMatchInlineSnapshot(`
      "● Subagents
         2 queued"
    `);
    component.dispose();
  });

  it("renders running rows alongside done rows and queued count", () => {
    const component = new AgentListComponent(
      () => [makeRunning({ id: "1" }), makeDone({ id: "2" }), makeQueued({ id: "3" })],
      mockTui,
      mockTheme,
    );
    expect(render(component)).toMatchInlineSnapshot(`
      "● Subagents
      ⠋ #1 my-agent · doing a task
      ✓ #2 my-agent · doing a task · 5.0s
         1 queued"
    `);
    component.dispose();
  });

  it("updates header text after invalidate()", () => {
    const component = new AgentListComponent(() => [makeDone({ id: "1" })], mockTui, mockTheme);
    component.invalidate();
    expect(render(component)).toMatchInlineSnapshot(`
      "● Subagents
      ✓ #1 my-agent · doing a task · 5.0s"
    `);
    component.dispose();
  });
});
