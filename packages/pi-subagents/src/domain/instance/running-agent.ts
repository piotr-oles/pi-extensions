import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
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
  readonly session: AgentSession;
  readonly startedAt: number;
  readonly signal: AbortSignal;

  private turnCount = 0;
  private aborted: false | "signal" | "limit" = false;
  private softLimitReached: boolean = false;
  private readonly activeToolsMap = new Map<string, string>();
  private readonly controller: AbortController;

  get name() {
    return this.config.name;
  }

  constructor({
    queued: { id, config, session, signal },
    startedAt,
    onUpdate,
    onDone,
  }: RunningAgentParams) {
    this.id = id;
    this.config = config;
    this.startedAt = startedAt;
    this.session = session;
    this.controller = new AbortController();
    this.signal = signal
      ? AbortSignal.any([signal, this.controller.signal])
      : this.controller.signal;

    this.aborted = false;
    this.softLimitReached = false;
    this.signal.addEventListener("abort", this.handleAbortSignal);

    (async () => {
      const unsubscribe = session.subscribe(async (event: AgentSessionEvent) => {
        if (event.type === "turn_end") {
          const next = await this.nextTurn();
          if (next.status === "done") {
            onDone(next);
          } else {
            onUpdate?.(next);
          }
        }
        if (event.type === "tool_execution_start") {
          this.activeToolsMap.set(event.toolCallId, event.toolName);
          onUpdate?.(this);
        }
        if (event.type === "tool_execution_end") {
          this.activeToolsMap.delete(event.toolCallId);
          onUpdate?.(this);
        }
        if (event.type === "compaction_end" && !event.aborted && event.result) {
          onUpdate?.(this);
        }
      });

      try {
        await session.prompt(config.prompt);

        if (this.aborted === "signal") {
          onDone(this.done({ reason: "stopped" }));
        } else if (this.aborted === "limit") {
          onDone(this.done({ reason: "aborted" }));
        } else {
          onDone(
            this.done({
              reason: this.softLimitReached ? "steered" : "completed",
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
    })();
  }

  get duration(): number {
    return Date.now() - this.startedAt;
  }

  get activeTools(): string[] {
    return Array.from(this.activeToolsMap.values());
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

  done({ reason, result, error }: Omit<DoneAgentParams, "running">): DoneAgentInstance {
    this.signal.removeEventListener("abort", this.handleAbortSignal);
    return new DoneAgentInstance({ running: this, reason, result, error });
  }

  private handleAbortSignal = () => {
    if (!this.aborted) {
      this.aborted = "signal";
    }
    this.session.abort();
    this.signal.removeEventListener("abort", this.handleAbortSignal);
  };
}
