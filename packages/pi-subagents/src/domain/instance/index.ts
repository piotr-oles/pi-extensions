export type { DoneAgentParams, DoneReason } from "./done-agent.js";
export { DoneAgentInstance } from "./done-agent.js";
export type { QueuedAgentParams, RunAgentParams } from "./queued-agent.js";
export { QueuedAgentInstance } from "./queued-agent.js";
export type { RunningAgentParams } from "./running-agent.js";
export { RunningAgentInstance } from "./running-agent.js";

import type { DoneAgentInstance, DoneAgentSessionEntry } from "./done-agent.js";
import type { QueuedAgentInstance, QueuedAgentSessionEntry } from "./queued-agent.js";
import type { RunningAgentInstance, RunningAgentSessionEntry } from "./running-agent.js";

export type AgentInstance = QueuedAgentInstance | RunningAgentInstance | DoneAgentInstance;
export type AgentInstanceStatus = AgentInstance["status"];
export type AgentInstanceByStatus<TStatus extends AgentInstanceStatus> =
  TStatus extends QueuedAgentInstance["status"]
    ? QueuedAgentInstance
    : TStatus extends RunningAgentInstance["status"]
      ? RunningAgentInstance
      : TStatus extends DoneAgentInstance["status"]
        ? DoneAgentInstance
        : never;

export type AgentInstanceSessionEntry =
  | QueuedAgentSessionEntry
  | RunningAgentSessionEntry
  | DoneAgentSessionEntry;
