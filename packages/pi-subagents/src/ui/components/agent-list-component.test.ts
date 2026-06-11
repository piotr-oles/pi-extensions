import type { AgentSession, Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import stripAnsi from "strip-ansi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentConfig } from "../../domain/agent-config.js";
import { AgentTemplate } from "../../domain/agent-template.js";
import { QueuedAgentInstance } from "../../domain/instance/queued-agent.js";
import { RunningAgentInstance } from "../../domain/instance/running-agent.js";
import { AgentListComponent } from "./agent-list-component.js";

const mockTheme = {
  fg: (_: string, text: string) => text,
  bg: (_: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as Theme;

const mockTui = { requestRender: vi.fn() } as unknown as TUI;

const mockSession = {
  getContextUsage: () => undefined,
  getLastAssistantText: () => "",
  messages: [],
  steer: async () => {},
  abort: () => {},
  bindExtensions: async () => {},
  prompt: async () => {},
  subscribe: () => () => {},
} as unknown as AgentSession;

const mockTemplate = new AgentTemplate({
  name: "my-agent",
  description: "",
  instructions: "",
  source: "global",
});

const mockConfig = new AgentConfig({
  template: mockTemplate,
  description: "doing a task",
  prompt: "do something",
  activeTools: [],
});

function makeQueued(id: string) {
  return new QueuedAgentInstance({
    id,
    config: mockConfig,
    session: mockSession,
    signal: undefined,
  });
}

function makeRunning(id: string) {
  const queued = makeQueued(id);
  return new RunningAgentInstance({ queued, startedAt: 0, onDone: () => {} });
}

function makeDone(id: string) {
  return makeRunning(id).done({ reason: "completed" });
}

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
      () => [makeDone("1"), makeDone("2")],
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
      () => [makeQueued("1"), makeQueued("2")],
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
      () => [makeRunning("1"), makeDone("2"), makeQueued("3")],
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
    const component = new AgentListComponent(() => [makeDone("1")], mockTui, mockTheme);
    component.invalidate();
    expect(render(component)).toMatchInlineSnapshot(`
      "● Agents
      ✓ #1 my-agent · doing a task · 5.0s"
    `);
    component.dispose();
  });
});
