import type { Theme } from "@earendil-works/pi-coding-agent";
import { AgentConfig, type AgentConfigParams } from "./domain/agent-config.js";
import { AgentTemplate, type AgentTemplateParams } from "./domain/agent-template.js";
import type { DoneReason } from "./domain/instance/done-agent.js";
import { QueuedAgentInstance } from "./domain/instance/queued-agent.js";
import { RunningAgentInstance } from "./domain/instance/running-agent.js";
import type { Session } from "./domain/types.js";

export const mockTheme: Theme = {
  fg: (_: string, text: string) => text,
  bg: (_: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as Theme;

export const mockSession: Session = {
  sessionId: "mock",
  steer: async () => {},
  abort: () => {},
  prompt: async () => {},
  subscribe: () => () => {},
  getLastAssistantText: () => undefined,
  getContextUsage: () => undefined,
};

export function makeAgentTemplate(overrides: Partial<AgentTemplateParams> = {}): AgentTemplate {
  return new AgentTemplate({
    name: "my-agent",
    description: "",
    instructions: "",
    source: "global",
    ...overrides,
  });
}

export function makeAgentConfig(overrides: Partial<AgentConfigParams> = {}): AgentConfig {
  return new AgentConfig({
    template: makeAgentTemplate(),
    description: "doing a task",
    prompt: "do something",
    activeTools: [],
    ...overrides,
  });
}

export const mockTemplate: AgentTemplate = makeAgentTemplate();
export const mockConfig: AgentConfig = makeAgentConfig();

export interface MakeQueuedOptions {
  id?: string;
  config?: AgentConfig;
  session?: Session;
  signal?: AbortSignal;
  maxTurns?: number;
  graceTurns?: number;
}

export function makeQueued({
  id = "test-id",
  config,
  session = mockSession,
  signal,
  maxTurns,
  graceTurns,
}: MakeQueuedOptions = {}): QueuedAgentInstance {
  return new QueuedAgentInstance({
    id,
    config: config ?? makeAgentConfig({ template: makeAgentTemplate({ maxTurns, graceTurns }) }),
    session,
    signal,
  });
}

export interface MakeRunningOptions {
  id?: string;
  config?: AgentConfig;
  session?: Session;
  startedAt?: number;
}

export function makeRunning({
  id = "test-id",
  config,
  session = mockSession,
  startedAt = 0,
}: MakeRunningOptions = {}): RunningAgentInstance {
  return RunningAgentInstance.start({
    queued: makeQueued({ id, config, session }),
    startedAt,
    onDone: () => {},
  });
}

export interface MakeDoneOptions {
  id?: string;
  config?: AgentConfig;
  session?: Session;
  reason?: DoneReason;
  startedAt?: number;
}

export function makeDone({
  id = "test-id",
  config,
  session = mockSession,
  reason = "completed",
  startedAt = 0,
}: MakeDoneOptions = {}) {
  return makeRunning({ id, config, session, startedAt }).done({ reason });
}
