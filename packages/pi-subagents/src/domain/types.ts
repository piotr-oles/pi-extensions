import type { ThinkingLevel } from "@earendil-works/pi-agent-core";

export type { ThinkingLevel };

export type AgentName = string;
export type AgentId = string;

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
