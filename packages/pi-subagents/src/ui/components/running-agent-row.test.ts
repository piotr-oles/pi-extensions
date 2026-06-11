import type { AgentSession, Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import stripAnsi from "strip-ansi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentConfig } from "../../domain/agent-config.js";
import { AgentTemplate } from "../../domain/agent-template.js";
import { QueuedAgentInstance } from "../../domain/instance/queued-agent.js";
import { RunningAgentInstance } from "../../domain/instance/running-agent.js";
import { RunningAgentRow } from "./running-agent-row.js";

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

function makeRunning(session = mockSession) {
  const queued = new QueuedAgentInstance({
    id: "1",
    config: mockConfig,
    session,
    signal: undefined,
  });
  return new RunningAgentInstance({ queued, startedAt: 0, onDone: () => {} });
}

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
    const row = new RunningAgentRow(makeRunning(), mockTui, mockTheme);
    expect(render(row)).toMatchInlineSnapshot(`"⠋ #1 my-agent · doing a task"`);
    row.stop();
  });

  it("includes token usage when reported", () => {
    const session = {
      ...mockSession,
      getContextUsage: () => ({ tokens: 1500, contextWindow: 10_000 }),
    } as unknown as AgentSession;
    const row = new RunningAgentRow(makeRunning(session), mockTui, mockTheme);
    expect(render(row)).toMatchInlineSnapshot(`"⠋ #1 my-agent · doing a task · 1.5K"`);
    row.stop();
  });

  it("advances the spinner frame as time passes", () => {
    const row = new RunningAgentRow(makeRunning(), mockTui, mockTheme);
    vi.advanceTimersByTime(80);
    expect(render(row)).toMatchInlineSnapshot(`"⠙ #1 my-agent · doing a task"`);
    row.stop();
  });

  it("re-renders correctly after update()", () => {
    const instance = makeRunning();
    const row = new RunningAgentRow(instance, mockTui, mockTheme);
    row.update(instance);
    expect(render(row)).toMatchInlineSnapshot(`"⠋ #1 my-agent · doing a task"`);
    row.stop();
  });
});
