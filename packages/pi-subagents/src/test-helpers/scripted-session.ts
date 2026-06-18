import type { AgentSessionEvent, ContextUsage } from "@earendil-works/pi-coding-agent";

export interface TurnStep {
  readonly kind: "turn";
}

export interface EventStep {
  readonly kind: "event";
  readonly eventType: string;
}

export interface SideEffectStep {
  readonly kind: "side-effect";
  readonly run: () => void;
}

export type Step = TurnStep | EventStep | SideEffectStep;

export type Completion =
  | { readonly kind: "complete"; readonly text: string }
  | { readonly kind: "error"; readonly message: string };

/**
 * Controllable session for scenario-based testing of RunningAgentInstance.
 * Produced by ScriptedSessionBuilder — do not construct directly.
 *
 * Build a script of turns and events via ScriptedSessionBuilder, then call build().
 * When prompt() is called by the running instance the script replays in order:
 *   - each turn() fires a turn_end event and awaits the subscriber
 *   - each event(type) fires that event type and awaits the subscriber
 *   - after all steps the session resolves or throws based on complete()/fail()
 *
 */
export class ScriptedSession {
  private handler: ((event: AgentSessionEvent) => void | Promise<void>) | null = null;
  private aborted = false;

  constructor(
    private readonly steps: readonly Step[],
    private readonly completion: Completion,
    private readonly steeredMessages: string[],
  ) {}

  readonly sessionId = "scripted";

  subscribe(listener: (event: AgentSessionEvent) => void | Promise<void>): () => void {
    this.handler = listener;
    return () => {
      this.handler = null;
    };
  }

  async prompt(_text: string): Promise<void> {
    for (const step of this.steps) {
      if (this.aborted) {
        return;
      }

      if (step.kind === "turn") {
        await this.handler?.({
          type: "turn_end",
          message: { role: "assistant", content: [] },
        } as unknown as AgentSessionEvent);
      } else if (step.kind === "event") {
        await this.handler?.({ type: step.eventType } as AgentSessionEvent);
      } else {
        step.run();
      }
    }

    if (this.aborted) {
      return;
    }

    if (this.completion.kind === "error") {
      throw new Error(this.completion.message);
    }
  }

  async steer(message: string): Promise<void> {
    this.steeredMessages.push(message);
  }

  async abort(): Promise<void> {
    this.aborted = true;
  }

  getLastAssistantText(): string {
    return this.completion.kind === "complete" ? this.completion.text : "";
  }

  getContextUsage(): ContextUsage | undefined {
    return undefined;
  }
}
