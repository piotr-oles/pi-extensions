import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { Session } from "../types.js";
import type { AgentConfig } from "../agent-config.js";
import type { DoneAgentParams } from "./done-agent.js";
import { DoneAgentInstance } from "./done-agent.js";
import type { QueuedAgentInstance } from "./queued-agent.js";

export interface RunningAgentParams {
  queued: QueuedAgentInstance;
  startedAt: number;
  onUpdate?: (running: RunningAgentInstance) => void;
  onDone: (done: DoneAgentInstance) => void;
}

export class RunningAgentInstance {
  readonly status = "running" as const;
  readonly id: string;
  readonly config: AgentConfig;
  readonly session: Session;
  readonly startedAt: number;
  readonly signal: AbortSignal;

  private turnCount = 0;
  private aborted: false | "signal" | "limit" = false;
  private softLimitReached = false;
  private readonly controller: AbortController;

  get name() {
    return this.config.name;
  }

  private constructor({ queued: { id, config, session, signal }, startedAt }: RunningAgentParams) {
    this.id = id;
    this.config = config;
    this.startedAt = startedAt;
    this.session = session;
    this.controller = new AbortController();
    this.signal = signal
      ? AbortSignal.any([signal, this.controller.signal])
      : this.controller.signal;
  }

  static start(params: RunningAgentParams): RunningAgentInstance {
    const instance = new RunningAgentInstance(params);
    instance.signal.addEventListener("abort", instance.handleAbort);
    instance.runSession(params.onUpdate, params.onDone);
    return instance;
  }

  get duration(): number {
    return Date.now() - this.startedAt;
  }

  async nextTurn(): Promise<RunningAgentInstance | DoneAgentInstance> {
    this.turnCount++;
    if (this.config.maxTurns) {
      if (!this.softLimitReached && this.turnCount >= this.config.maxTurns) {
        this.softLimitReached = true;
        await this.steer(
          "You've reached your turn limit. Wrap up immediately — provide your final / partial answer with next steps NOW.",
        );
      } else if (
        this.softLimitReached &&
        this.turnCount >= this.config.maxTurns + (this.config.graceTurns ?? 5)
      ) {
        this.aborted = "limit";
        return this.abort();
      }
    }
    return this;
  }

  async steer(message: string): Promise<boolean> {
    await this.session.steer(message);
    return true;
  }

  abort(): DoneAgentInstance {
    this.controller.abort();
    return this.done({ reason: "aborted" });
  }

  done({ reason, result, error }: Omit<DoneAgentParams, "instance">): DoneAgentInstance {
    this.signal.removeEventListener("abort", this.handleAbort);
    return new DoneAgentInstance({ instance: this, reason, result, error });
  }

  private async runSession(
    onUpdate: RunningAgentParams["onUpdate"],
    onDone: RunningAgentParams["onDone"],
  ): Promise<void> {
    const { session, config } = this;
    // typescript narrows type to RunningAgentInstance even with explicit type annotation :/
    let next: RunningAgentInstance | DoneAgentInstance = this as RunningAgentInstance | DoneAgentInstance;
    const unsubscribe = session.subscribe(async (event: AgentSessionEvent) => {
      if (event.type === "turn_end") {
        next = await this.nextTurn();
        if (next.status !== "done") {
          onUpdate?.(next);
        }
      } else {
        onUpdate?.(this);
      }
    });

    try {
      await session.prompt(config.prompt);

      if (next.status === 'done') {
        onDone(next);
      } else if (next.aborted === "signal") {
        onDone(next.done({ reason: "stopped" }));
      } else if (next.aborted === "limit") {
        onDone(next.done({ reason: "aborted" }));
      } else {
        onDone(
          next.done({
            reason: next.softLimitReached ? "steered" : "completed",
            result: session.getLastAssistantText(),
          }),
        );
      }
    } catch (error: unknown) {
      onDone(
        this.done({
          reason: "error",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      unsubscribe();
    }
  }

  private handleAbort = () => {
    if (!this.aborted) {
      this.aborted = "signal";
    }
    this.session.abort();
    this.signal.removeEventListener("abort", this.handleAbort);
  };
}
