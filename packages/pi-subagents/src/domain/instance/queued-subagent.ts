import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { SubagentConfig } from "../subagent-config.js";
import { DoneSubagent } from "./done-subagent.js";
import { RunningSubagent } from "./running-subagent.js";

export interface QueuedSubagentParams {
  id: string;
  prompt: string;
  description: string;
  config: SubagentConfig;
  session: AgentSession;
}

export interface QueuedSubagentSessionEntry {
  readonly status: "queued";
  readonly id: string;
  readonly prompt: string;
  readonly description: string;
  readonly config: SubagentConfig;
  readonly sessionFile: string | undefined;
}

export interface RunSubagentParams {
  onUpdate: (running: RunningSubagent) => void;
  onDone: (done: DoneSubagent) => void;
}

export class QueuedSubagent {
  readonly status = "queued" as const;
  readonly id: string;
  readonly prompt: string;
  readonly description: string;
  readonly config: SubagentConfig;
  readonly session: AgentSession;

  get name() {
    return this.config.template.name;
  }

  constructor({ id, prompt, description, config, session }: QueuedSubagentParams) {
    this.id = id;
    this.prompt = prompt;
    this.description = description;
    this.config = config;
    this.session = session;
  }

  abort(): DoneSubagent {
    return new DoneSubagent({ instance: this, result: { status: "aborted" } });
  }

  error(error: unknown): DoneSubagent {
    return new DoneSubagent({
      instance: this,
      result: {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  run({ onUpdate, onDone }: RunSubagentParams): RunningSubagent {
    return RunningSubagent.start({
      instance: this,
      prompt: this.prompt,
      description: this.description,
      startedAt: Date.now(),
      onUpdate,
      onDone,
    });
  }

  toEntry(): QueuedSubagentSessionEntry {
    return {
      status: "queued",
      id: this.id,
      prompt: this.prompt,
      description: this.description,
      config: this.config,
      sessionFile: this.session.sessionFile,
    };
  }
}
