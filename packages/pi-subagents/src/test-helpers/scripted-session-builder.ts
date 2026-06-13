import { ScriptedSession } from "./scripted-session.js";

interface TurnStep {
  readonly kind: "turn";
}

interface EventStep {
  readonly kind: "event";
  readonly eventType: string;
}

interface SideEffectStep {
  readonly kind: "side-effect";
  readonly run: () => void;
}

type Step = TurnStep | EventStep | SideEffectStep;

type Completion =
  | { readonly kind: "complete"; readonly text: string }
  | { readonly kind: "error"; readonly message: string };

/**
 * Fluent builder for ScriptedSession.
 *
 * The builder owns the steeringLog array so assertions can be made against
 * the builder after the session has run:
 *
 *   const builder = new ScriptedSessionBuilder().turns(5).complete("done");
 *   await run(builder.build(), { maxTurns: 5 });
 *   expect(builder.steeredMessages[0]).toContain("turn limit");
 */
export class ScriptedSessionBuilder {
  private readonly steps: Step[] = [];
  private completion: Completion = { kind: "complete", text: "" };
  private readonly steeringLog: string[] = [];

  turns(n: number): this {
    for (let i = 0; i < n; i++) {
      this.steps.push({ kind: "turn" });
    }
    return this;
  }

  turn(): this {
    this.steps.push({ kind: "turn" });
    return this;
  }

  sideEffect(run: () => void): this {
    this.steps.push({ kind: "side-effect", run });
    return this;
  }

  event(eventType: string): this {
    this.steps.push({ kind: "event", eventType });
    return this;
  }

  complete(text = ""): this {
    this.completion = { kind: "complete", text };
    return this;
  }

  fail(message: string): this {
    this.completion = { kind: "error", message };
    return this;
  }

  build(): ScriptedSession {
    return new ScriptedSession(
      [...this.steps],
      this.completion,
      this.steeringLog,
    );
  }

  get steeredMessages(): readonly string[] {
    return [...this.steeringLog];
  }
}
