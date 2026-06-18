import type { AgentSession, ContextUsage } from "@earendil-works/pi-coding-agent";
import type { SubagentConfig } from "../subagent-config.js";
import { QueuedSubagent } from "./queued-subagent.js";
import type { RunningSubagent } from "./running-subagent.js";

export type ExceededLimit = { type: "turns"; maxTurns: number; graceTurns: number };

export type DoneResult =
  | { status: "completed"; message: string; steered: boolean }
  | { status: "aborted" }
  | { status: "exceeded_limit"; limit: ExceededLimit }
  | { status: "error"; error: string };

export interface DoneAgentParams {
  instance: QueuedSubagent | RunningSubagent;
  result: DoneResult;
}

export interface FollowUpSubagentParams {
  prompt: string;
  description: string;
}

export interface DoneSubagentSessionEntry {
  readonly status: "done";
  readonly result: DoneResult;
  readonly id: string;
  readonly prompt: string;
  readonly description: string;
  readonly config: SubagentConfig;
  readonly sessionFile: string | undefined;
  readonly startedAt: number | undefined;
  readonly doneAt: number;
  readonly duration: number;
  readonly turns: number;
  readonly usage: ContextUsage | undefined;
}

export class DoneSubagent {
  readonly status = "done" as const;
  readonly result: DoneResult;
  readonly id: string;
  readonly prompt: string;
  readonly description: string;
  readonly config: SubagentConfig;
  readonly startedAt: number | undefined;
  readonly doneAt: number;
  readonly session: AgentSession;
  readonly turns: number;

  get name() {
    return this.config.name;
  }

  get template() {
    return this.config.template;
  }

  get duration(): number {
    return this.startedAt !== undefined ? this.doneAt - this.startedAt : 0;
  }

  constructor({ instance, result }: DoneAgentParams) {
    this.result = result;
    this.id = instance.id;
    this.prompt = instance.prompt;
    this.description = instance.description;
    this.config = instance.config;
    this.startedAt = instance.status === "running" ? instance.startedAt : undefined;
    this.doneAt = Date.now();
    this.session = instance.session;
    this.turns = instance.status === "running" ? instance.turn : 0;
  }

  followUp({ prompt, description }: FollowUpSubagentParams): QueuedSubagent {
    return new QueuedSubagent({
      id: this.id,
      prompt,
      description,
      config: this.config,
      session: this.session,
    });
  }

  toEntry(): DoneSubagentSessionEntry {
    return {
      status: "done",
      result: this.result,
      id: this.id,
      prompt: this.prompt,
      description: this.description,
      config: this.config,
      sessionFile: this.session.sessionFile,
      startedAt: this.startedAt,
      doneAt: this.doneAt,
      duration: this.duration,
      turns: this.turns,
      usage: this.session.getContextUsage(),
    };
  }
}
