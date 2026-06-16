import type { ContextUsage } from "@earendil-works/pi-coding-agent";
import type { AgentConfig, AgentConfigSessionEntry } from "../agent-config.js";
import type { QueuedAgentInstance, RunningAgentInstance, Session } from "../types.js";

export type DoneReason = "completed" | "stopped" | "error";

export interface DoneAgentParams {
  instance: QueuedAgentInstance | RunningAgentInstance;
  reason: DoneReason;
  result?: string;
  error?: string;
}

export interface DoneAgentSessionEntry {
  readonly status: "done";
  readonly reason: DoneReason;
  readonly id: string;
  readonly config: AgentConfigSessionEntry;
  readonly result?: string;
  readonly error?: string;
  readonly startedAt: number | undefined;
  readonly doneAt: number;
  readonly duration: number;
  readonly turns: number;
  readonly steered: boolean;
  readonly usage: ContextUsage | undefined;
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
  readonly turns: number;
  readonly steered: boolean;

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
    this.startedAt = instance.status === "running" ? instance.startedAt : undefined;
    this.doneAt = Date.now();
    this.session = instance.session;
    this.turns = instance.status === "running" ? instance.turn : 0;
    this.steered = instance.status === "running" ? instance.steered : false;
  }

  toEntry(): DoneAgentSessionEntry {
    const usage = this.session.getContextUsage();

    return {
      status: "done",
      reason: this.reason,
      id: this.id,
      config: this.config.toEntry(),
      result: this.result,
      error: this.error,
      startedAt: this.startedAt,
      doneAt: this.doneAt,
      duration: this.duration,
      turns: this.turns,
      steered: this.steered,
      usage: usage
        ? {
          contextWindow: usage.contextWindow,
          percent: usage.percent,
          tokens: usage.tokens,
        }
        : undefined,
    };
  }
}
