/**
 * Integration tests using the real pi runtime via @marcfargas/pi-test-harness.
 *
 * Unlike the unit tests (which mock both `pi` and `exec`), these tests:
 *  - Boot a real pi AgentSession
 *  - Load the extension through the real ExtensionAPI / tool registry
 *  - Run playbook scripts that drive what the "model" does
 *  - Only mock `exec` (the sem subprocess boundary) and the LLM
 *
 * This catches registration-contract drift, schema validation failures, hook
 * chain issues, and argument-construction bugs that the unit tests cannot see.
 */

import * as path from "node:path";
import {
  calls,
  createTestSession,
  says,
  type TestSession,
  verifySandboxInstall,
  when,
} from "@marcfargas/pi-test-harness";
import { afterEach, describe, expect, it, vi } from "vitest";
import semPi from "../index.js";

const MOCK_CONTEXT_TEXT = `context for function myFunc (budget: 4000, used: 50)

  target:
    function myFunc (src/utils.ts, ~50 tokens)
      function myFunc() {}`;

const MOCK_ENTITIES_TEXT = `entities: src/

  function myFunc (L1:5)
  class MyClass (L7:20)`;

const MOCK_IMPACT_TEXT = `⊕ function myFunc (src/utils.ts:1–5)

  ← depended on by:
    ← function run (src/app.ts)`;

const MOCK_DIFF_MD = "## Semantic diff\n\n### myFunc — modified\n\n```\n- old\n+ new\n```";

/**
 * Creates a test session with the real pi runtime.
 *
 * `exec` is replaced before the extension loads so that all four tools use
 * the mock instead of the real `sem` binary. The mock dispatches on the first
 * arg (the sem subcommand) so each tool gets the right fixture.
 */
async function makeSession() {
  const execMock = vi.fn(
    (
      _cmd: string,
      args: string[],
    ): Promise<{ stdout: string; stderr: string; code: number; killed: boolean }> => {
      const sub = args[0];
      if (sub === "context") {
        return Promise.resolve({ stdout: MOCK_CONTEXT_TEXT, stderr: "", code: 0, killed: false });
      }
      if (sub === "entities") {
        return Promise.resolve({ stdout: MOCK_ENTITIES_TEXT, stderr: "", code: 0, killed: false });
      }
      if (sub === "impact") {
        return Promise.resolve({ stdout: MOCK_IMPACT_TEXT, stderr: "", code: 0, killed: false });
      }
      if (sub === "diff") {
        return Promise.resolve({ stdout: MOCK_DIFF_MD, stderr: "", code: 0, killed: false });
      }
      return Promise.resolve({
        stdout: "",
        stderr: `unknown subcommand: ${sub}`,
        code: 1,
        killed: false,
      });
    },
  );

  const session = await createTestSession({
    extensionFactories: [
      (pi) => {
        // Replace exec on the real ExtensionAPI object before the extension
        // registers tools — tools close over pi.exec so all four tools get
        // the mock automatically.
        pi.exec = execMock;
        semPi(pi);
      },
    ],
  });

  // Extension tools are not in the default active set; activate all sem_* tools.
  const current: string[] = (session.session as any).getActiveToolNames?.() ?? [];
  (session.session as any).setActiveToolsByName?.([
    ...current,
    "sem_context",
    "sem_entities",
    "sem_impact",
    "sem_diff",
  ]);

  return { session, execMock };
}

describe("pi-sem extension (integration)", () => {
  let t: TestSession;

  afterEach(() => t?.dispose());

  it("loads without errors and registers tools via the real ExtensionAPI", async () => {
    const { session } = await makeSession();
    t = session;
    // If the extension loaded successfully and the harness didn't throw,
    // the real ToolDefinition contract was satisfied (required fields, valid schema).
    expect(t).toBeDefined();
  });

  it("sem_context: model call reaches exec and returns formatted content", async () => {
    const { session, execMock } = await makeSession();
    t = session;

    await t.run(
      when("Get context for myFunc", [
        calls("sem_context", { entity: "myFunc" }),
        says("Here is the context."),
      ]),
    );

    // exec was called once with the right subcommand
    expect(execMock).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["context", "myFunc"]),
      expect.anything(),
    );

    // Tool result contains the formatted output
    const results = t.events.toolResultsFor("sem_context");
    expect(results).toHaveLength(1);
    expect(results[0].text).toContain("context for function myFunc");
    expect(results[0].isError).toBe(false);
  });

  it("sem_context: passes budget arg when model provides it", async () => {
    const { session, execMock } = await makeSession();
    t = session;

    await t.run(
      when("Get context for myFunc with small budget", [
        calls("sem_context", { entity: "myFunc", budget: 1000 }),
        says("Done."),
      ]),
    );

    expect(execMock).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--budget", "1000"]),
      expect.anything(),
    );
  });

  it("sem_entities: model call reaches exec and returns entity tree", async () => {
    const { session, execMock } = await makeSession();
    t = session;

    await t.run(
      when("List entities in src/", [
        calls("sem_entities", { path: "src/" }),
        says("Found the entities."),
      ]),
    );

    expect(execMock).toHaveBeenCalledWith("sem", ["entities", "src/"], expect.anything());

    const results = t.events.toolResultsFor("sem_entities");
    expect(results).toHaveLength(1);
    expect(results[0].text).toContain("function myFunc");
    expect(results[0].text).toContain("class MyClass");
    expect(results[0].isError).toBe(false);
  });

  it("sem_impact: model call reaches exec and returns impact report", async () => {
    const { session, execMock } = await makeSession();
    t = session;

    await t.run(
      when("Show impact of myFunc", [
        calls("sem_impact", { entity: "myFunc" }),
        says("Impact analysis complete."),
      ]),
    );

    expect(execMock).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["impact", "myFunc"]),
      expect.anything(),
    );

    const results = t.events.toolResultsFor("sem_impact");
    expect(results).toHaveLength(1);
    expect(results[0].text).toContain("function myFunc");
    expect(results[0].isError).toBe(false);
  });

  it("sem_diff: model call reaches exec and returns markdown diff", async () => {
    const { session, execMock } = await makeSession();
    t = session;

    await t.run(when("Show semantic diff", [calls("sem_diff", {}), says("Here are the changes.")]));

    expect(execMock).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["diff", "--format", "markdown"]),
      expect.anything(),
    );

    const results = t.events.toolResultsFor("sem_diff");
    expect(results).toHaveLength(1);
    expect(results[0].text).toContain("## Semantic diff");
    expect(results[0].isError).toBe(false);
  });

  it("sem_diff: passes --staged flag when model requests it", async () => {
    const { session, execMock } = await makeSession();
    t = session;

    await t.run(
      when("Show staged semantic diff", [
        calls("sem_diff", { staged: true }),
        says("Here are the staged changes."),
      ]),
    );

    expect(execMock).toHaveBeenCalledWith(
      "sem",
      expect.arrayContaining(["--staged"]),
      expect.anything(),
    );
  });
});

// Smoke test — verifySandboxInstall
//
// Packs the extension via `npm pack`, installs it in a temp sandbox, loads it
// through the real pi runtime, and asserts all 4 tools are present.  This
// catches packaging bugs (missing files, wrong `pi.extensions` path) before
// publish.
//
// Runs in a separate suite so it can be skipped in watch mode without
// affecting the integration tests above.

describe("pi-sem smoke (sandbox install)", { timeout: 120_000 }, () => {
  it("packs and installs cleanly; all 4 tools are registered", async () => {
    const packageDir = path.resolve(import.meta.dirname, "../..");
    const result = await verifySandboxInstall({
      packageDir,
      expect: {
        extensions: 1,
        tools: ["sem_context", "sem_entities", "sem_impact", "sem_diff"],
      },
    });

    expect(result.loaded.extensionErrors).toEqual([]);
    expect(result.loaded.tools).toEqual(
      expect.arrayContaining(["sem_context", "sem_entities", "sem_impact", "sem_diff"]),
    );
  });
});
