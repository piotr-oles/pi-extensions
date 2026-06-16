import type { AgentEvent } from "@earendil-works/pi-agent-core";
import type {
  AgentSessionEvent,
  ContextUsage,
} from "@earendil-works/pi-coding-agent";
import type { AgentConfig, AgentConfigSessionEntry } from "../agent-config.js";
import type { Session } from "../types.js";
import type { DoneAgentParams } from "./done-agent.js";
import { DoneAgentInstance } from "./done-agent.js";
import type { QueuedAgentInstance } from "./queued-agent.js";

export interface RunningAgentParams {
  queued: QueuedAgentInstance;
  startedAt: number;
  onUpdate?: (running: RunningAgentInstance) => void;
  onDone: (done: DoneAgentInstance) => void;
}

type SimpleTextContent = { type: 'text', text: string };
type SimpleThinkingContent = { type: 'thinking', thinking: string };
export type SimpleMessage = Array<SimpleTextContent | SimpleThinkingContent>;

export interface RunningAgentSessionEntry {
  readonly status: "running";
  readonly id: string;
  readonly config: AgentConfigSessionEntry;
  readonly startedAt: number;
  readonly usage: ContextUsage | undefined;
  readonly turns: number;
  readonly steered: boolean;
  readonly aborted: boolean;
  readonly runningTools: string[];
  readonly lastMessage: SimpleMessage | undefined;
}

export interface RunningAgentState {
  turn: number;
  steered: boolean;
  aborted: boolean;
  runningTools: Map<string, string>;
  lastMessage: SimpleMessage | undefined
}

export class RunningAgentInstance {
  readonly status = "running" as const;
  readonly id: string;
  readonly config: AgentConfig;
  readonly session: Session;
  readonly startedAt: number;
  readonly signal: AbortSignal;

  private readonly controller: AbortController;
  private readonly state: RunningAgentState;

  get name() {
    return this.config.name;
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

  get runningTools() {
    return Array.from(this.state.runningTools.values());
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
    this.state = {
      turn: 0,
      steered: false,
      aborted: false,
      runningTools: new Map(),
      lastMessage: undefined
    };
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

  async nextTurn(message?: SimpleMessage): Promise<RunningAgentInstance | DoneAgentInstance> {
    this.state.turn++;
    if (message) {
      this.state.lastMessage = message;
    }
    if (this.config.maxTurns) {
      if (!this.state.steered && this.config.graceTurns > 0 && this.turn >= this.config.maxTurns) {
        this.state.steered = true;
        await this.steer(
          "You've reached your turn limit. Wrap up immediately — provide your final / partial answer with next steps NOW.",
        );
      } else if (this.turn >= this.config.maxTurns + this.config.graceTurns) {
        this.state.aborted = true;
        return this.abort();
      }
    }
    return this;
  }

  async steer(message: string): Promise<void> {
    await this.session.steer(message);
  }

  abort(): DoneAgentInstance {
    this.controller.abort();
    return this.done({ reason: "stopped" });
  }

  done({ reason, result, error }: Omit<DoneAgentParams, "instance">): DoneAgentInstance {
    this.signal.removeEventListener("abort", this.handleAbort);
    return new DoneAgentInstance({ instance: this, reason, result, error });
  }

  toEntry(): RunningAgentSessionEntry {
    const usage = this.session.getContextUsage();

    return {
      status: "running",
      id: this.id,
      config: this.config.toEntry(),
      startedAt: this.startedAt,
      turns: this.turn,
      steered: this.steered,
      aborted: this.aborted,
      runningTools: this.runningTools,
      lastMessage: this.state.lastMessage,
      usage: usage
        ? {
          contextWindow: usage.contextWindow,
          percent: usage.percent,
          tokens: usage.tokens,
        }
        : undefined,
    };
  }

  private async runSession(
    onUpdate: RunningAgentParams["onUpdate"],
    onDone: RunningAgentParams["onDone"],
  ): Promise<void> {
    const { session, config } = this;
    // typescript narrows type to RunningAgentInstance even with explicit type annotation :/
    let next: RunningAgentInstance | DoneAgentInstance = this as
      | RunningAgentInstance
      | DoneAgentInstance;
    const unsubscribe = session.subscribe(async (event: AgentSessionEvent) => {
      switch (event.type) {
        case 'turn_end': {
          let message = event.message.role === 'assistant'
            ? event.message.content
              .filter(content => content.type === 'text' || content.type === 'thinking')
            : undefined;
          next = await this.nextTurn(message);
          if (next.status !== "done") {
            onUpdate?.(next);
          }
          return;
        }
        case 'tool_execution_start': {
          const toolName = getToolName(event);
          this.state.runningTools.set(event.toolCallId, toolName);
          break;
        }
        case 'tool_execution_end': {
          this.state.runningTools.delete(event.toolCallId);
          break;
        }
      }
      onUpdate?.(this);
    });

    try {
      await session.prompt(config.prompt);

      if (next.status === "done") {
        onDone(next);
      } else if (next.aborted) {
        onDone(next.done({ reason: "stopped" }));
      } else {
        onDone(
          next.done({
            reason: "completed",
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
    if (!this.state.aborted) {
      this.state.aborted = true;
    }
    this.session.abort();
    this.signal.removeEventListener("abort", this.handleAbort);
  };
}

type ToolExecutionEvent = Extract<AgentEvent, { type: "tool_execution_start" }>;

function getToolName(event: ToolExecutionEvent): string {
  if (isBashLikeToolExecutionEvent(event)) {
    const command = event.args.command.trim().split(" ")[0];
    return command || event.toolName;
  }
  return event.toolName;
}

interface BashLikeToolExecutionEvent extends ToolExecutionEvent {
  args: {
    command: string;
  };
}
function isBashLikeToolExecutionEvent(
  event: ToolExecutionEvent,
): event is BashLikeToolExecutionEvent {
  return (
    event.toolName === "bash" &&
    typeof event.args === "object" &&
    event.args !== null &&
    "command" in event.args &&
    typeof event.args.command === "string"
  );
}
