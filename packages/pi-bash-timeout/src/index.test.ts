import {
  calls,
  createTestSession,
  says,
  type TestSession,
  when,
} from "@marcfargas/pi-test-harness";
import { afterEach, describe, expect, it } from "vitest";
import piBashTimeout from "./index.js";

function withFlags(flags: Record<string, string>) {
  return (pi: any) => {
    const orig = pi.getFlag.bind(pi);
    pi.getFlag = (name: string) => (name in flags ? flags[name] : orig(name));
    piBashTimeout(pi);
  };
}

describe("pi-bash-timeout", { timeout: 30_000 }, () => {
  let t: TestSession;
  afterEach(() => t?.dispose());

  // The harness records the pre-mutation input, so assert on the params the
  // tool actually executed with (captured by the mock handler) instead.
  function captureExec() {
    const executed: Record<string, unknown>[] = [];
    const handler = (params: Record<string, unknown>) => {
      executed.push(params);
      return "ok";
    };
    return { executed, handler };
  }

  it("injects the default timeout when the model omits it", async () => {
    const bash = captureExec();
    t = await createTestSession({
      extensionFactories: [(pi: any) => piBashTimeout(pi)],
      mockTools: { bash: bash.handler },
    });

    await t.run(when("run", [calls("bash", { command: "echo hi" }), says("done")]));

    expect(bash.executed[0]?.timeout).toBe(120);
  });

  it("preserves an explicit in-range timeout", async () => {
    const bash = captureExec();
    t = await createTestSession({
      extensionFactories: [(pi: any) => piBashTimeout(pi)],
      mockTools: { bash: bash.handler },
    });

    await t.run(when("run", [calls("bash", { command: "sleep 5", timeout: 30 }), says("done")]));

    expect(bash.executed[0]?.timeout).toBe(30);
  });

  it("caps an explicit timeout above the maximum", async () => {
    const bash = captureExec();
    t = await createTestSession({
      extensionFactories: [(pi: any) => piBashTimeout(pi)],
      mockTools: { bash: bash.handler },
    });

    await t.run(
      when("run", [calls("bash", { command: "sleep 9999", timeout: 9999 }), says("done")]),
    );

    expect(bash.executed[0]?.timeout).toBe(600);
  });

  it("treats a non-positive timeout as missing and injects the default", async () => {
    const bash = captureExec();
    t = await createTestSession({
      extensionFactories: [(pi: any) => piBashTimeout(pi)],
      mockTools: { bash: bash.handler },
    });

    await t.run(when("run", [calls("bash", { command: "echo hi", timeout: 0 }), says("done")]));

    expect(bash.executed[0]?.timeout).toBe(120);
  });

  it("uses the flag value over the built-in default", async () => {
    const bash = captureExec();
    t = await createTestSession({
      extensionFactories: [withFlags({ "pi-bash-timeout-default": "45" })],
      mockTools: { bash: bash.handler },
    });

    await t.run(when("run", [calls("bash", { command: "echo hi" }), says("done")]));

    expect(bash.executed[0]?.timeout).toBe(45);
  });

  it("does not touch non-bash tool calls", async () => {
    const read = captureExec();
    t = await createTestSession({
      extensionFactories: [(pi: any) => piBashTimeout(pi)],
      mockTools: { read: read.handler },
    });

    await t.run(when("run", [calls("read", { path: "foo.txt" }), says("done")]));

    expect(read.executed[0]?.timeout).toBeUndefined();
  });
});

describe("pi-bash-timeout before_agent_start", () => {
  it("appends the timeout policy section to the system prompt", () => {
    let handler: ((event: { systemPrompt: string }) => { systemPrompt: string }) | undefined;
    const pi = {
      registerFlag() {},
      getFlag: () => undefined,
      on(event: string, fn: unknown) {
        if (event === "before_agent_start") {
          handler = fn as typeof handler;
        }
      },
    };

    piBashTimeout(pi as never);
    expect(handler).toBeTypeOf("function");

    const result = handler?.({ systemPrompt: "base prompt" });
    expect(result?.systemPrompt).toContain("base prompt");
    expect(result?.systemPrompt).toContain("Bash Tool Timeout Policy");
    expect(result?.systemPrompt).toContain("Default timeout: 120s");
    expect(result?.systemPrompt).toContain("Maximum timeout: 600s");
  });
});
