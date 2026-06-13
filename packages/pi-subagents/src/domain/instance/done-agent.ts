import type { Session } from "../types.js";
import type { AgentConfig } from "../agent-config.js";
import type { QueuedAgentInstance, RunningAgentInstance } from "../types.js";

export type DoneReason = "completed" | "steered" | "aborted" | "stopped" | "error";

export interface DoneAgentParams {
  instance: QueuedAgentInstance | RunningAgentInstance;
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
  readonly startedAt: number | undefined;
  readonly doneAt: number;
  readonly session: Session;

  get name() {
    return this.config.name;
  }

  get duration(): number {
    return this.startedAt !== undefined ? this.doneAt - this.startedAt : 0;
  }

  constructor({ instance, reason, result, error }: DoneAgentParams) {
    this.reason = reason;
    this.id = instance.id;
    this.config = instance.config;
    this.result = result;
    this.error = error;
    this.startedAt = instance.status === 'running' ? instance.startedAt : undefined;
    this.doneAt = Date.now();
    this.session = instance.session;
  }
}
