import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
  AgentSession,
  AgentSessionEvent,
  ContextUsage,
} from "@earendil-works/pi-coding-agent";
import type { SubagentConfig } from "../subagent-config.js";
import type { DoneResult, ExceededLimit } from "./done-subagent.js";
import { DoneSubagent } from "./done-subagent.js";
import type { QueuedSubagent } from "./queued-subagent.js";

export interface StartSubagentParams {
  instance: QueuedSubagent | DoneSubagent;
  prompt: string;
  description: string;
  startedAt: number;
  onUpdate: (running: RunningSubagent) => void;
  onDone: (done: DoneSubagent) => void;
}

export interface RunningAgentSessionEntry {
  readonly status: "running";
  readonly id: string;
  readonly prompt: string;
  readonly description: string;
  readonly config: SubagentConfig;
  readonly sessionFile: string | undefined;
  readonly startedAt: number;
  readonly usage: ContextUsage | undefined;
  readonly turns: number;
  readonly steered: boolean;
  readonly aborted: boolean;
  readonly lastMessage: AssistantMessage | undefined;
}

interface RunningAgentState {
  turn: number;
  steered: boolean;
  aborted: boolean;
  exceededLimit: ExceededLimit | undefined;
  lastMessage: AssistantMessage | undefined;
}

export class RunningSubagent {
  readonly status = "running" as const;
  readonly id: string;
  readonly prompt: string;
  readonly description: string;
  readonly config: SubagentConfig;
  readonly session: AgentSession;
  readonly startedAt: number;

  private readonly state: RunningAgentState;

  get name() {
    return this.config.template.name;
  }

  get turn() {
    return this.state.turn;
  }

  get steered() {
    return this.state.steered;
  }

  get aborted() {
    return this.state.aborted;
  }

  private constructor({
    instance,
    prompt,
    description,
    startedAt,
  }: Pick<StartSubagentParams, "instance" | "prompt" | "description" | "startedAt">) {
    this.id = instance.id;
    this.prompt = prompt;
    this.description = description;
    this.config = instance.config;
    this.session = instance.session;
    this.startedAt = startedAt;
    this.state = {
      turn: 0,
      steered: false,
      aborted: false,
      exceededLimit: undefined,
      lastMessage: undefined,
    };
  }

  static start({
    instance,
    prompt,
    description,
    startedAt,
    onUpdate,
    onDone,
  }: StartSubagentParams): RunningSubagent {
    const running = new RunningSubagent({
      instance,
      prompt,
      description,
      startedAt,
    });
    void running.runSession(onUpdate, onDone);
    return running;
  }

  get duration(): number {
    return Date.now() - this.startedAt;
  }

  async steer(message: string): Promise<RunningSubagent> {
    await this.session.steer(message);
    return this;
  }

  async abort(): Promise<DoneSubagent> {
    this.state.aborted = true;
    await this.session.abort();
    return this.done({ status: "aborted" });
  }

  toEntry(): RunningAgentSessionEntry {
    return {
      status: "running",
      id: this.id,
      prompt: this.prompt,
      description: this.description,
      config: this.config,
      sessionFile: this.session.sessionFile,
      startedAt: this.startedAt,
      turns: this.turn,
      steered: this.steered,
      aborted: this.aborted,
      lastMessage: this.state.lastMessage,
      usage: this.session.getContextUsage(),
    };
  }

  private done(result: DoneResult): DoneSubagent {
    return new DoneSubagent({ instance: this, result });
  }

  private async runSession(
    onUpdate: (running: RunningSubagent) => void,
    onDone: (done: DoneSubagent) => void,
  ): Promise<void> {
    const session = this.session;
    const unsubscribe = session.subscribe(async (event: AgentSessionEvent) => {
      switch (event.type) {
        case "turn_end":
          this.state.turn++;

          if (event.message.role === "assistant") {
            this.state.lastMessage = event.message;
          }
          if (this.config.maxTurns) {
            if (
              !this.state.steered &&
              this.config.graceTurns > 0 &&
              this.turn >= this.config.maxTurns
            ) {
              this.state.steered = true;
              await this.steer(
                "You've reached your turn limit. Wrap up immediately — provide your final / partial answer and next steps NOW. Note that the job was interrupted by usage limit and might require follow-up.",
              );
            } else if (this.turn >= this.config.maxTurns + this.config.graceTurns) {
              this.state.exceededLimit = {
                type: "turns",
                maxTurns: this.config.maxTurns,
                graceTurns: this.config.graceTurns,
              };
              this.state.aborted = true;
              this.session.abort();
              return;
            }
          }
          break;
        case "message_start":
        case "message_update":
        case "message_end":
          if (event.message.role === "assistant") {
            this.state.lastMessage = event.message;
          }
          break;
      }

      onUpdate(this);
    });

    try {
      await session.prompt(this.prompt);

      if (this.state.exceededLimit) {
        onDone(this.done({ status: "exceeded_limit", limit: this.state.exceededLimit }));
      } else if (this.state.aborted) {
        onDone(this.done({ status: "aborted" }));
      } else {
        onDone(
          this.done({
            status: "completed",
            message: session.getLastAssistantText() ?? "",
            steered: this.state.steered,
          }),
        );
      }
    } catch (error: unknown) {
      onDone(
        this.done({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      unsubscribe();
    }
  }
}
