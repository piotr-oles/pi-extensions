import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { AgentConfig } from "../agent-config.js";
import type { RunningAgentInstance } from "./running-agent.js";

export type DoneReason = "completed" | "steered" | "aborted" | "stopped" | "error";

export interface DoneAgentParams {
  running: RunningAgentInstance;
  reason: DoneReason;
  result?: string;
  error?: string;
}

export class DoneAgentInstance {
  readonly status = "done" as const;
  readonly reason: DoneReason;
  readonly id: string;
  readonly config: AgentConfig;
  readonly result?: string;
  readonly error?: string;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly session: AgentSession;

  get name() {
    return this.config.name;
  }

  get duration(): number {
    return this.completedAt - this.startedAt;
  }

  constructor({ running, reason, result, error }: DoneAgentParams) {
    this.reason = reason;
    this.id = running.id;
    this.config = running.config;
    this.result = result;
    this.error = error;
    this.startedAt = running.startedAt;
    this.completedAt = Date.now();
    this.session = running.session;
  }
}
