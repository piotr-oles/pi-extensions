import { AgentConfig } from "../agent-config.js";
import { AgentTemplate } from "../types.js";
import type { DoneReason } from "./done-agent.js";
import { QueuedAgentInstance } from "./queued-agent.js";
import { RunningAgentInstance } from "./running-agent.js";
import type { Session } from "../types.js";

export const mockSession: Session = {
  sessionId: "mock",
  steer: async () => {},
  abort: () => {},
  prompt: async () => {},
  subscribe: () => () => {},
  getLastAssistantText: () => undefined,
  getContextUsage: () => undefined,
};

export const mockTemplate = new AgentTemplate({
  name: "test",
  description: "test agent",
  instructions: "",
  source: "global",
});

export const mockConfig = new AgentConfig({
  template: mockTemplate,
  description: "test task",
  prompt: "do something",
  activeTools: [],
});

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
  signal = undefined,
  maxTurns,
  graceTurns,
}: MakeQueuedOptions = {}): QueuedAgentInstance {
  const resolvedConfig =
    config ??
    (maxTurns !== undefined || graceTurns !== undefined
      ? new AgentConfig({
          template: new AgentTemplate({ ...mockTemplate, maxTurns, graceTurns }),
          description: mockConfig.description,
          prompt: mockConfig.prompt,
          activeTools: [],
        })
      : mockConfig);
  return new QueuedAgentInstance({ id, config: resolvedConfig, session, signal });
}

export function makeRunning(queued = makeQueued(), startedAt = 0): RunningAgentInstance {
  return RunningAgentInstance.start({ queued, startedAt, onDone: () => {} });
}

export function makeDone(reason: DoneReason = "completed", queued = makeQueued(), startedAt = 0) {
  return makeRunning(queued, startedAt).done({ reason });
}
