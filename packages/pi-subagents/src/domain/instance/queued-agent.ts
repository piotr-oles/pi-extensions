import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { AgentConfig } from "../agent-config.js";
import type { DoneAgentInstance } from "./done-agent.js";
import { RunningAgentInstance } from "./running-agent.js";

export interface QueuedAgentParams {
  id: string;
  config: AgentConfig;
  session: AgentSession;
  signal: AbortSignal | undefined;
}

export interface RunAgentParams {
  onUpdate?: (running: RunningAgentInstance) => void;
  onDone: (done: DoneAgentInstance) => void;
}

export class QueuedAgentInstance {
  readonly status = "queued" as const;
  readonly id: string;
  readonly config: AgentConfig;
  readonly session: AgentSession;
  readonly signal: AbortSignal | undefined;

  get name() {
    return this.config.name;
  }

  constructor({ id, config, session, signal }: QueuedAgentParams) {
    this.id = id;
    this.config = config;
    this.session = session;
    this.signal = signal;
  }

  run({ onUpdate, onDone }: RunAgentParams): RunningAgentInstance {
    return new RunningAgentInstance({
      queued: this,
      startedAt: Date.now(),
      onUpdate,
      onDone,
    });
  }
}
