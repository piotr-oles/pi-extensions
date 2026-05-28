import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  calls,
  createTestSession,
  says,
  type TestSession,
  when,
} from "@marcfargas/pi-test-harness";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import piFence from "./index.js";

type FenceMode = "warn" | "block" | "remove";

function fenceExtension(mode: FenceMode) {
  return (pi: any) => {
    const orig = pi.getFlag.bind(pi);
    pi.getFlag = (name: string) => (name === "pi-fence-mode" ? mode : orig(name));
    piFence(pi);
  };
}

const FILE = "src/greet.ts";

const CONTENT_WITH_FENCE = [
  "function greet() {",
  "// ---- helpers ----",
  '  return "hello";',
  "}",
  "",
].join("\n");

const CONTENT_CLEAN = ["function greet() {", '  return "hello";', "}", ""].join("\n");

const CONTENT_WITH_FENCE_LINE3 = [
  "function greet() {",
  '  return "hello";',
  "// ---- helpers ----",
  "}",
  "",
].join("\n");

describe("pi-fence modes", { timeout: 30_000 }, () => {
  let t: TestSession;
  afterEach(() => t?.dispose());

  describe("warn mode", () => {
    it("appends warning to tool result when fence is detected in write", async () => {
      t = await createTestSession({
        extensionFactories: [fenceExtension("warn")],
        mockTools: { write: "Written." },
      });

      await t.run(
        when("Write a file", [
          calls("write", { path: FILE, content: CONTENT_WITH_FENCE }),
          says("Done."),
        ]),
      );

      const [result] = t.events.toolResultsFor("write");
      expect(result.text).toContain("⚠ pi-fence: fence/divider comments detected in added code:");
      expect(result.text).toContain("src/greet.ts:2:1: // ---- helpers ----");
      expect(t.events.blockedCalls()).toHaveLength(0);
    });

    it("appends warning to tool result when fence is added via edit", async () => {
      t = await createTestSession({
        extensionFactories: [fenceExtension("warn")],
        mockTools: { edit: "Edited." },
      });

      await t.run(
        when("Edit a file", [
          calls("edit", {
            path: FILE,
            edits: [{ oldText: CONTENT_CLEAN, newText: CONTENT_WITH_FENCE }],
          }),
          says("Done."),
        ]),
      );

      const [result] = t.events.toolResultsFor("edit");
      expect(result.text).toContain("⚠ pi-fence: fence/divider comments detected in added code:");
      expect(result.text).toContain("src/greet.ts:2:1: // ---- helpers ----");
      expect(t.events.blockedCalls()).toHaveLength(0);
    });

    it("passes through cleanly when no fences are present", async () => {
      t = await createTestSession({
        extensionFactories: [fenceExtension("warn")],
        mockTools: { write: "Written." },
      });

      await t.run(
        when("Write a file", [
          calls("write", { path: FILE, content: CONTENT_CLEAN }),
          says("Done."),
        ]),
      );

      const [result] = t.events.toolResultsFor("write");
      expect(result.text).not.toContain("pi-fence");
      expect(t.events.blockedCalls()).toHaveLength(0);
    });
  });

  describe("deduplication (write)", () => {
    const BASENAME = "greet.ts";
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), "pi-fence-dedup-"));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it("re-reports a fence moved to a different line", async () => {
      await writeFile(join(tmpDir, BASENAME), CONTENT_WITH_FENCE);

      t = await createTestSession({
        extensionFactories: [fenceExtension("warn")],
        mockTools: { write: "Written." },
        cwd: tmpDir,
      });

      // The fence text is the same but now lives on line 3 instead of line 2.
      await t.run(
        when("Rewrite a file moving the fence", [
          calls("write", { path: BASENAME, content: CONTENT_WITH_FENCE_LINE3 }),
          says("Done."),
        ]),
      );

      const [result] = t.events.toolResultsFor("write");
      expect(result.text).toContain("⚠ pi-fence: fence/divider comments detected in added code:");
    });

    it("does not re-report a fence that stayed on the same line", async () => {
      await writeFile(join(tmpDir, BASENAME), CONTENT_WITH_FENCE);

      t = await createTestSession({
        extensionFactories: [fenceExtension("warn")],
        mockTools: { write: "Written." },
        cwd: tmpDir,
      });

      await t.run(
        when("Rewrite the file without changing fences", [
          calls("write", { path: BASENAME, content: CONTENT_WITH_FENCE }),
          says("Done."),
        ]),
      );

      const [result] = t.events.toolResultsFor("write");
      expect(result.text).not.toContain("pi-fence");
    });
  });

  describe("block mode", () => {
    it("blocks write containing a fence comment", async () => {
      t = await createTestSession({
        extensionFactories: [fenceExtension("block")],
        mockTools: { write: "Written." },
        propagateErrors: false,
      });

      await t.run(
        when("Write a file", [
          calls("write", { path: FILE, content: CONTENT_WITH_FENCE }),
          says("I'll remove the fence comments."),
        ]),
      );

      const [blocked] = t.events.blockedCalls();
      expect(blocked.toolName).toBe("write");
      expect(blocked.blockReason).toContain(
        "Write blocked — fence/divider comments in added code:",
      );
      expect(blocked.blockReason).toContain("src/greet.ts:2:1: // ---- helpers ----");
    });

    it("allows clean write through without blocking", async () => {
      t = await createTestSession({
        extensionFactories: [fenceExtension("block")],
        mockTools: { write: "Written." },
      });

      await t.run(
        when("Write a file", [
          calls("write", { path: FILE, content: CONTENT_CLEAN }),
          says("Done."),
        ]),
      );

      expect(t.events.blockedCalls()).toHaveLength(0);
      expect(t.events.toolResultsFor("write")).toHaveLength(1);
    });
  });

  describe("remove mode", () => {
    it("strips fence comments from write content and appends removal notice", async () => {
      let capturedContent = "";

      t = await createTestSession({
        extensionFactories: [fenceExtension("remove")],
        mockTools: {
          write: (params) => {
            capturedContent = params.content as string;
            return "Written.";
          },
        },
      });

      await t.run(
        when("Write a file", [
          calls("write", { path: FILE, content: CONTENT_WITH_FENCE }),
          says("Done."),
        ]),
      );

      expect(capturedContent).not.toContain("// ---- helpers ----");
      const [result] = t.events.toolResultsFor("write");
      expect(result.text).toContain(
        "ℹ pi-fence: fence/divider comments were automatically removed:",
      );
      expect(result.text).toContain("src/greet.ts:2:1: // ---- helpers ----");
      expect(t.events.blockedCalls()).toHaveLength(0);
    });

    it("strips fence comments from edit newText and appends removal notice", async () => {
      let capturedNewText = "";

      t = await createTestSession({
        extensionFactories: [fenceExtension("remove")],
        mockTools: {
          edit: (params) => {
            const edits = params.edits as Array<{ oldText: string; newText: string }>;
            capturedNewText = edits[0].newText;
            return "Edited.";
          },
        },
      });

      await t.run(
        when("Edit a file", [
          calls("edit", {
            path: FILE,
            edits: [{ oldText: CONTENT_CLEAN, newText: CONTENT_WITH_FENCE }],
          }),
          says("Done."),
        ]),
      );

      expect(capturedNewText).not.toContain("// ---- helpers ----");
      const [result] = t.events.toolResultsFor("edit");
      expect(result.text).toContain(
        "ℹ pi-fence: fence/divider comments were automatically removed:",
      );
      expect(result.text).toContain("src/greet.ts:2:1: // ---- helpers ----");
      expect(t.events.blockedCalls()).toHaveLength(0);
    });
  });
});
