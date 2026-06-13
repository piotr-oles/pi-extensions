import type { AgentSessionEvent, ContextUsage } from "@earendil-works/pi-coding-agent";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";

export type { ThinkingLevel };

export type AgentName = string;
export type AgentId = string;

export interface Session {
  readonly sessionId: string;
  subscribe(listener: (event: AgentSessionEvent) => void | Promise<void>): () => void;
  prompt(text: string): Promise<void>;
  steer(text: string): Promise<void>;
  abort(): void;
  getLastAssistantText(): string | undefined;
  getContextUsage(): ContextUsage | undefined;
}

export type { AgentConfig, AgentConfigOverrides, AgentConfigParams } from "./agent-config.js";
export type { AgentSource, AgentTemplateParams } from "./agent-template.js";
export { AgentTemplate } from "./agent-template.js";
export type {
  DoneAgentInstance,
  DoneAgentInstance as DoneAgent,
  DoneReason,
  QueuedAgentInstance,
  QueuedAgentInstance as QueuedAgent,
  RunningAgentInstance,
  RunningAgentInstance as RunningAgent,
} from "./instance/index.js";
