import {
  calls,
  createTestSession,
  says,
  type TestSession,
  when,
} from "@marcfargas/pi-test-harness";
import { afterEach, describe, expect, it } from "vitest";
import piCwd from "./index.js";

describe("pi-cwd", { timeout: 30_000 }, () => {
  let t: TestSession;
  afterEach(() => t?.dispose());

  it("blocks read with absolute path", async () => {
    t = await createTestSession({
      extensionFactories: [piCwd],
      mockTools: { read: "file content" },
    });

    await t.run(when("Read a file", [calls("read", { path: `${t.cwd}/file.ts` }), says("Done.")]));

    const [blocked] = t.events.blockedCalls();
    expect(blocked.toolName).toBe("read");
    expect(blocked.blockReason).toContain("absolute cwd path detected");
  });

  it("blocks write with absolute path", async () => {
    t = await createTestSession({
      extensionFactories: [piCwd],
      mockTools: { write: "Written." },
    });

    await t.run(
      when("Write a file", [
        calls("write", { path: `${t.cwd}/file.ts`, content: "code" }),
        says("Done."),
      ]),
    );

    const [blocked] = t.events.blockedCalls();
    expect(blocked.toolName).toBe("write");
    expect(blocked.blockReason).toContain("absolute cwd path detected");
  });

  it("blocks edit with absolute path", async () => {
    t = await createTestSession({
      extensionFactories: [piCwd],
      mockTools: { edit: "Edited." },
    });

    await t.run(
      when("Edit a file", [calls("edit", { path: `${t.cwd}/file.ts`, edits: [] }), says("Done.")]),
    );

    const [blocked] = t.events.blockedCalls();
    expect(blocked.toolName).toBe("edit");
    expect(blocked.blockReason).toContain("absolute cwd path detected");
  });

  it("blocks bash with absolute path in command", async () => {
    t = await createTestSession({
      extensionFactories: [piCwd],
      mockTools: { bash: "output" },
    });

    await t.run(
      when("Run bash", [calls("bash", { command: `cat ${t.cwd}/file.ts` }), says("Done.")]),
    );

    const [blocked] = t.events.blockedCalls();
    expect(blocked.toolName).toBe("bash");
    expect(blocked.blockReason).toContain("absolute cwd path detected");
  });

  it("allows read with relative path through", async () => {
    t = await createTestSession({
      extensionFactories: [piCwd],
      mockTools: { read: "file content" },
    });

    await t.run(when("Read a file", [calls("read", { path: "src/file.ts" }), says("Done.")]));

    expect(t.events.blockedCalls()).toHaveLength(0);
    const [result] = t.events.toolResultsFor("read");
    expect(result.text).toContain("file content");
  });

  it("allows bash with relative path through", async () => {
    t = await createTestSession({
      extensionFactories: [piCwd],
      mockTools: { bash: "output" },
    });

    await t.run(when("Run bash", [calls("bash", { command: "cat src/file.ts" }), says("Done.")]));

    expect(t.events.blockedCalls()).toHaveLength(0);
  });
});
