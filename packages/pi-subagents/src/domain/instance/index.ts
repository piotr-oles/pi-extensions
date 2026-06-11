export type { DoneAgentParams, DoneReason } from "./done-agent.js";
export { DoneAgentInstance } from "./done-agent.js";
export type { QueuedAgentParams, RunAgentParams } from "./queued-agent.js";
export { QueuedAgentInstance } from "./queued-agent.js";
export type { RunningAgentParams } from "./running-agent.js";
export { RunningAgentInstance } from "./running-agent.js";

import type { DoneAgentInstance } from "./done-agent.js";
import type { QueuedAgentInstance } from "./queued-agent.js";
import type { RunningAgentInstance } from "./running-agent.js";

export type AgentInstance = QueuedAgentInstance | RunningAgentInstance | DoneAgentInstance;
