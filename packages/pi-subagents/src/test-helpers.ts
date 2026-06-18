import { type AgentSession, Theme, type ThemeColor } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { type DoneResult, DoneSubagent } from "./domain/instance/done-subagent.js";
import { QueuedSubagent } from "./domain/instance/queued-subagent.js";
import { RunningSubagent } from "./domain/instance/running-subagent.js";
import type { SubagentConfig } from "./domain/subagent-config.js";
import type { SubagentTemplate } from "./domain/subagent-template.js";

const FG_COLORS: Record<ThemeColor, string> = {
  accent: "",
  border: "",
  borderAccent: "",
  borderMuted: "",
  success: "",
  error: "",
  warning: "",
  muted: "",
  dim: "",
  text: "",
  thinkingText: "",
  userMessageText: "",
  customMessageText: "",
  customMessageLabel: "",
  toolTitle: "",
  toolOutput: "",
  mdHeading: "",
  mdLink: "",
  mdLinkUrl: "",
  mdCode: "",
  mdCodeBlock: "",
  mdCodeBlockBorder: "",
  mdQuote: "",
  mdQuoteBorder: "",
  mdHr: "",
  mdListBullet: "",
  toolDiffAdded: "",
  toolDiffRemoved: "",
  toolDiffContext: "",
  syntaxComment: "",
  syntaxKeyword: "",
  syntaxFunction: "",
  syntaxVariable: "",
  syntaxString: "",
  syntaxNumber: "",
  syntaxType: "",
  syntaxOperator: "",
  syntaxPunctuation: "",
  thinkingOff: "",
  thinkingMinimal: "",
  thinkingLow: "",
  thinkingMedium: "",
  thinkingHigh: "",
  thinkingXhigh: "",
  bashMode: "",
};

const BG_COLORS = {
  selectedBg: "",
  userMessageBg: "",
  customMessageBg: "",
  toolPendingBg: "",
  toolSuccessBg: "",
  toolErrorBg: "",
};

export const mockTheme = new Theme(FG_COLORS, BG_COLORS, "truecolor");
export const mockTui = { requestRender: () => {} } as unknown as TUI;

export const mockSession: AgentSession = {
  sessionId: "mock",
  steer: async () => {},
  abort: async () => {},
  prompt: async () => {},
  subscribe: () => () => {},
  getLastAssistantText: () => undefined,
  getContextUsage: () => undefined,
} as unknown as AgentSession;

export function makeAgentTemplate(overrides: Partial<SubagentTemplate> = {}): SubagentTemplate {
  return {
    name: "my-agent",
    description: "",
    instructions: "",
    source: "global",
    includedTools: undefined,
    enabled: true,
    filePath: undefined,
    ...overrides,
  };
}

export function makeAgentConfig(overrides: Partial<SubagentConfig> = {}): SubagentConfig {
  return {
    name: "my-agent",
    model: "claude-haiku",
    thinkingLevel: "medium",
    graceTurns: 5,
    template: makeAgentTemplate(),
    enabledTools: [],
    ...overrides,
  };
}

export const mockTemplate: SubagentTemplate = makeAgentTemplate();
export const mockConfig: SubagentConfig = makeAgentConfig();

export interface MakeQueuedOptions {
  id?: string;
  prompt?: string;
  description?: string;
  config?: SubagentConfig;
  session?: AgentSession;
  maxTurns?: number;
  graceTurns?: number;
}

export function makeQueued({
  id = "test-id",
  prompt = "do something",
  description = "doing a task",
  config,
  session = mockSession,
  maxTurns,
  graceTurns,
}: MakeQueuedOptions = {}): QueuedSubagent {
  return new QueuedSubagent({
    id,
    prompt,
    description,
    config:
      config ??
      makeAgentConfig({
        template: makeAgentTemplate({ maxTurns, graceTurns }),
        ...(maxTurns !== undefined && { maxTurns }),
        ...(graceTurns !== undefined && { graceTurns }),
      }),
    session,
  });
}

export interface MakeRunningOptions {
  id?: string;
  prompt?: string;
  config?: SubagentConfig;
  session?: AgentSession;
  startedAt?: number;
}

export function makeRunning({
  id = "test-id",
  prompt = "do something",
  config,
  session = mockSession,
  startedAt = 0,
}: MakeRunningOptions = {}): RunningSubagent {
  return RunningSubagent.start({
    instance: makeQueued({ id, config, session }),
    prompt,
    description: "doing a task",
    startedAt,
    onUpdate: () => {},
    onDone: () => {},
  });
}

export interface MakeDoneOptions {
  id?: string;
  config?: SubagentConfig;
  session?: AgentSession;
  result?: DoneResult;
  startedAt?: number;
}

export function makeDone({
  id = "test-id",
  config,
  session = mockSession,
  result = { status: "completed", message: "", steered: false },
  startedAt = 0,
}: MakeDoneOptions = {}) {
  return new DoneSubagent({ instance: makeRunning({ id, config, session, startedAt }), result });
}
