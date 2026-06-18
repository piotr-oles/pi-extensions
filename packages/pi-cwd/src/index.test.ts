import {
  calls,
  createTestSession,
  says,
  type TestSession,
  when,
} from "@marcfargas/pi-test-harness";
import { afterEach, describe, expect, it } from "vitest";
import piCwd from "./index.js";

function cwdExtension(enabled: boolean) {
  return (pi: any) => {
    const orig = pi.getFlag.bind(pi);
    pi.getFlag = (name: string) => (name === "pi-cwd" ? enabled : orig(name));
    piCwd(pi);
  };
}

describe("pi-cwd", { timeout: 30_000 }, () => {
  let t: TestSession;
  afterEach(() => t?.dispose());

  describe("read tool", () => {
    it("appends tip when path is absolute", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension(true)],
        mockTools: { read: "file content" },
      });

      await t.run(
        when("Read a file", [calls("read", { path: `${t.cwd}/file.ts` }), says("Done.")]),
      );

      const [record] = t.events.toolResultsFor("read");
      expect(record.text).toContain("file content");
      expect(record.text).toContain("Tip: Use relative paths");
      expect(record.text).toContain(t.cwd);
    });

    it("no tip when path is relative", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension(true)],
        mockTools: { read: "file content" },
      });

      await t.run(when("Read a file", [calls("read", { path: "src/file.ts" }), says("Done.")]));

      const [result] = t.events.toolResultsFor("read");
      expect(result.text).not.toContain("Tip");
    });
  });

  describe("write tool", () => {
    it("appends tip when path is absolute", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension(true)],
        mockTools: { write: "Written." },
      });

      await t.run(
        when("Write a file", [
          calls("write", { path: `${t.cwd}/file.ts`, content: "code" }),
          says("Done."),
        ]),
      );

      const [result] = t.events.toolResultsFor("write");
      expect(result.text).toContain("Tip: Use relative paths");
    });

    it("no tip when path is relative", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension(true)],
        mockTools: { write: "Written." },
      });

      await t.run(
        when("Write a file", [
          calls("write", { path: "src/file.ts", content: "code" }),
          says("Done."),
        ]),
      );

      const [result] = t.events.toolResultsFor("write");
      expect(result.text).not.toContain("Tip");
    });
  });

  describe("edit tool", () => {
    it("appends tip when path is absolute", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension(true)],
        mockTools: { edit: "Edited." },
      });

      await t.run(
        when("Edit a file", [
          calls("edit", { path: `${t.cwd}/file.ts`, edits: [] }),
          says("Done."),
        ]),
      );

      const [result] = t.events.toolResultsFor("edit");
      expect(result.text).toContain("Tip: Use relative paths");
    });
  });

  describe("bash tool", () => {
    it("appends tip when command contains absolute path", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension(true)],
        mockTools: { bash: "output" },
      });

      await t.run(
        when("Run bash", [calls("bash", { command: `cat ${t.cwd}/file.ts` }), says("Done.")]),
      );

      const [result] = t.events.toolResultsFor("bash");
      expect(result.text).toContain("Tip: Use relative paths");
    });

    it("no tip when command uses only relative paths", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension(true)],
        mockTools: { bash: "output" },
      });

      await t.run(when("Run bash", [calls("bash", { command: "cat src/file.ts" }), says("Done.")]));

      const [result] = t.events.toolResultsFor("bash");
      expect(result.text).not.toContain("Tip");
    });

    it("no tip for URL path segments in curl command", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension(true)],
        mockTools: { bash: "response" },
      });

      await t.run(
        when("Run curl", [
          calls("bash", { command: "curl https://api.example.com/v1/users" }),
          says("Done."),
        ]),
      );

      const [result] = t.events.toolResultsFor("bash");
      expect(result.text).not.toContain("Tip");
    });
  });

  describe("flag disabled", () => {
    it("no tip when pi-cwd flag is false", async () => {
      t = await createTestSession({
        extensionFactories: [cwdExtension(false)],
        mockTools: { read: "file content" },
      });

      await t.run(
        when("Read a file", [calls("read", { path: "/absolute/path/file.ts" }), says("Done.")]),
      );

      const [result] = t.events.toolResultsFor("read");
      expect(result.text).not.toContain("Tip");
    });
  });
});
