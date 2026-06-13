import type { Theme } from "@earendil-works/pi-coding-agent";
import { AgentConfig } from "../domain/agent-config.js";
import { AgentTemplate } from "../domain/agent-template.js";
import type { DoneReason } from "../domain/instance/done-agent.js";
import { QueuedAgentInstance } from "../domain/instance/queued-agent.js";
import { RunningAgentInstance } from "../domain/instance/running-agent.js";
import type { Session } from "../domain/types.js";

export const mockSession: Session = {
  sessionId: "mock",
  getContextUsage: () => undefined,
  getLastAssistantText: () => undefined,
  steer: async () => {},
  abort: () => {},
  prompt: async () => {},
  subscribe: () => () => {},
};

export const mockTemplate = new AgentTemplate({
  name: "my-agent",
  description: "",
  instructions: "",
  source: "global",
});

export const mockConfig = new AgentConfig({
  template: mockTemplate,
  description: "doing a task",
  prompt: "do something",
  activeTools: [],
});

export const mockTheme: Theme = {
  fg: (_: string, text: string) => text,
  bg: (_: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as Theme;

interface InstanceOptions {
  session?: Session;
  config?: AgentConfig;
}

export function makeQueued(id: string, { session = mockSession, config = mockConfig }: InstanceOptions = {}): QueuedAgentInstance {
  return new QueuedAgentInstance({ id, config, session, signal: undefined });
}

export function makeRunning(id: string, { session = mockSession, config = mockConfig }: InstanceOptions = {}): RunningAgentInstance {
  return RunningAgentInstance.start({ queued: makeQueued(id, { session, config }), startedAt: 0, onDone: () => {} });
}

export function makeDone(id: string, { reason = "completed" as DoneReason, session = mockSession, config = mockConfig }: InstanceOptions & { reason?: DoneReason } = {}) {
  return makeRunning(id, { session, config }).done({ reason });
}
