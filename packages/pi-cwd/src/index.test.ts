import {
  calls,
  createTestSession,
  says,
  type TestSession,
  when,
} from "@marcfargas/pi-test-harness";
import { afterEach, describe, expect, it } from "vitest";
import piCwd from "./index.js";
import type { CwdMode } from "./mode.js";

function cwdExtension(mode: CwdMode) {
  return (pi: any) => {
    const orig = pi.getFlag.bind(pi);
    pi.getFlag = (name: string) => (name === "pi-cwd-mode" ? mode : orig(name));
    piCwd(pi);
  };
}

describe("pi-cwd", { timeout: 30_000 }, () => {
  let t: TestSession;
  afterEach(() => t?.dispose());

  describe("warn mode (default)", () => {
    describe("read tool", () => {
      it("appends tip when path is absolute", async () => {
        t = await createTestSession({
          extensionFactories: [piCwd],
          mockTools: { read: "file content" },
        });

        await t.run(
          when("Read a file", [calls("read", { path: `${t.cwd}/file.ts` }), says("Done.")]),
        );

        const [record] = t.events.toolResultsFor("read");
        expect(record.text).toContain("file content");
        expect(record.text).toContain("Absolute cwd path in tool call");
        expect(record.text).toContain(t.cwd);
      });

      it("no tip when path is relative", async () => {
        t = await createTestSession({
          extensionFactories: [piCwd],
          mockTools: { read: "file content" },
        });

        await t.run(when("Read a file", [calls("read", { path: "src/file.ts" }), says("Done.")]));

        const [result] = t.events.toolResultsFor("read");
        expect(result.text).not.toContain("Absolute cwd path");
      });
    });

    describe("write tool", () => {
      it("appends tip when path is absolute", async () => {
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

        const [result] = t.events.toolResultsFor("write");
        expect(result.text).toContain("Absolute cwd path in tool call");
      });

      it("no tip when path is relative", async () => {
        t = await createTestSession({
          extensionFactories: [piCwd],
          mockTools: { write: "Written." },
        });

        await t.run(
          when("Write a file", [
            calls("write", { path: "src/file.ts", content: "code" }),
            says("Done."),
          ]),
        );

        const [result] = t.events.toolResultsFor("write");
        expect(result.text).not.toContain("Absolute cwd path");
      });
    });

    describe("edit tool", () => {
      it("appends tip when path is absolute", async () => {
        t = await createTestSession({
          extensionFactories: [piCwd],
          mockTools: { edit: "Edited." },
        });

        await t.run(
          when("Edit a file", [
            calls("edit", { path: `${t.cwd}/file.ts`, edits: [] }),
            says("Done."),
          ]),
        );

        const [result] = t.events.toolResultsFor("edit");
        expect(result.text).toContain("Absolute cwd path in tool call");
      });
    });

    describe("bash tool", () => {
      it("appends tip when command contains absolute path", async () => {
        t = await createTestSession({
          extensionFactories: [piCwd],
          mockTools: { bash: "output" },
        });

        await t.run(
          when("Run bash", [calls("bash", { command: `cat ${t.cwd}/file.ts` }), says("Done.")]),
        );

        const [result] = t.events.toolResultsFor("bash");
        expect(result.text).toContain("Absolute cwd path in tool call");
      });

      it("no tip when command uses only relative paths", async () => {
        t = await createTestSession({
          extensionFactories: [piCwd],
          mockTools: { bash: "output" },
        });

        await t.run(
          when("Run bash", [calls("bash", { command: "cat src/file.ts" }), says("Done.")]),
        );

        const [result] = t.events.toolResultsFor("bash");
        expect(result.text).not.toContain("Absolute cwd path");
      });
    });
  });

  describe("block mode", () => {
    it("blocks read with absolute path", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension("block")],
        mockTools: { read: "file content" },
      });

      await t.run(
        when("Read a file", [calls("read", { path: `${t.cwd}/file.ts` }), says("Done.")]),
      );

      const [blocked] = t.events.blockedCalls();
      expect(blocked.toolName).toBe("read");
      expect(blocked.blockReason).toContain("absolute cwd path detected");
    });

    it("blocks write with absolute path", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension("block")],
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

    it("blocks bash with absolute path in command", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension("block")],
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
        extensionFactories: [cwdExtension("block")],
        mockTools: { read: "file content" },
      });

      await t.run(when("Read a file", [calls("read", { path: "src/file.ts" }), says("Done.")]));

      expect(t.events.blockedCalls()).toHaveLength(0);
      const [result] = t.events.toolResultsFor("read");
      expect(result.text).toContain("file content");
    });

    it("allows bash with relative path through", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension("block")],
        mockTools: { bash: "output" },
      });

      await t.run(when("Run bash", [calls("bash", { command: "cat src/file.ts" }), says("Done.")]));

      expect(t.events.blockedCalls()).toHaveLength(0);
    });
  });
});
