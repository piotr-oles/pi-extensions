import type { AgentConfig, AgentConfigSessionEntry } from "../agent-config.js";
import type { Session } from "../types.js";
import { DoneAgentInstance } from "./done-agent.js";
import { RunningAgentInstance } from "./running-agent.js";

export interface QueuedAgentParams {
  id: string;
  config: AgentConfig;
  session: Session;
  signal: AbortSignal | undefined;
}

export interface QueuedAgentSessionEntry {
  readonly status: "queued";
  readonly id: string;
  readonly config: AgentConfigSessionEntry;
}

export interface RunAgentParams {
  onUpdate?: (running: RunningAgentInstance) => void;
  onDone: (done: DoneAgentInstance) => void;
}

export class QueuedAgentInstance {
  readonly status = "queued" as const;
  readonly id: string;
  readonly config: AgentConfig;
  readonly session: Session;
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

  abort(): DoneAgentInstance {
    return new DoneAgentInstance({ instance: this, reason: "stopped" });
  }

  run({ onUpdate, onDone }: RunAgentParams): RunningAgentInstance {
    return RunningAgentInstance.start({
      queued: this,
      startedAt: Date.now(),
      onUpdate,
      onDone,
    });
  }

  toEntry(): QueuedAgentSessionEntry {
    return {
      status: "queued",
      id: this.id,
      config: this.config.toEntry(),
    };
  }
}
