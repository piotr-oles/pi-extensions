import type { AgentSession, Theme } from "@earendil-works/pi-coding-agent";
import stripAnsi from "strip-ansi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentConfig } from "../../domain/agent-config.js";
import { AgentTemplate } from "../../domain/agent-template.js";
import type { DoneReason } from "../../domain/instance/done-agent.js";
import { QueuedAgentInstance } from "../../domain/instance/queued-agent.js";
import { RunningAgentInstance } from "../../domain/instance/running-agent.js";
import { DoneAgentRow } from "./done-agent-row.js";

const mockTheme = {
  fg: (_: string, text: string) => text,
  bg: (_: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as Theme;

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

function makeDone(
  reason: DoneReason,
  {
    session = mockSession,
    config = mockConfig,
  }: { session?: AgentSession; config?: AgentConfig } = {},
) {
  const queued = new QueuedAgentInstance({ id: "1", config, session, signal: undefined });
  const running = new RunningAgentInstance({ queued, startedAt: 0, onDone: () => {} });
  return running.done({ reason });
}

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
    expect(render(new DoneAgentRow(makeDone("completed"), mockTheme))).toMatchInlineSnapshot(
      `"✓ #1 my-agent · doing a task · 5.0s"`,
    );
  });

  it("renders 'steered' reason", () => {
    expect(render(new DoneAgentRow(makeDone("steered"), mockTheme))).toMatchInlineSnapshot(
      `"✓ #1 my-agent · doing a task · 5.0s"`,
    );
  });

  it("renders 'stopped' reason", () => {
    expect(render(new DoneAgentRow(makeDone("stopped"), mockTheme))).toMatchInlineSnapshot(
      `"■ #1 my-agent · doing a task · 5.0s"`,
    );
  });

  it("renders 'aborted' reason", () => {
    expect(render(new DoneAgentRow(makeDone("aborted"), mockTheme))).toMatchInlineSnapshot(
      `"✗ #1 my-agent · doing a task · 5.0s"`,
    );
  });

  it("renders 'error' reason", () => {
    expect(render(new DoneAgentRow(makeDone("error"), mockTheme))).toMatchInlineSnapshot(
      `"✗ #1 my-agent · doing a task · 5.0s"`,
    );
  });

  it("includes token usage when reported", () => {
    const session = {
      ...mockSession,
      getContextUsage: () => ({ tokens: 1500, contextWindow: 10_000 }),
    } as unknown as AgentSession;
    const row = new DoneAgentRow(makeDone("completed", { session }), mockTheme);
    expect(render(row)).toMatchInlineSnapshot(`"✓ #1 my-agent · doing a task · 1.5K · 5.0s"`);
  });

  it("truncates descriptions longer than 50 characters", () => {
    const config = new AgentConfig({
      template: mockTemplate,
      description: "x".repeat(60),
      prompt: "do something",
      activeTools: [],
    });
    const row = new DoneAgentRow(makeDone("completed", { config }), mockTheme);
    expect(render(row)).toMatchInlineSnapshot(`"✓ #1 my-agent · xxxxxxxxxxxxxxxxxxxxxx... · 5.0s"`);
  });

  it("re-renders correctly after invalidate()", () => {
    const row = new DoneAgentRow(makeDone("completed"), mockTheme);
    row.invalidate();
    expect(render(row)).toMatchInlineSnapshot(`"✓ #1 my-agent · doing a task · 5.0s"`);
  });
});
