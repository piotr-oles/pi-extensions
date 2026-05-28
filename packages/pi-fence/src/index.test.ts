import * as fs from "node:fs";
import * as path from "node:path";
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

function defaultFenceExtension() {
  return (pi: any) => piFence(pi);
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
      expect(result.text).toContain("Fence comments detected in added code:");
      expect(result.text).toContain("src/greet.ts:2: // ---- helpers ----");
      expect(t.events.blockedCalls()).toHaveLength(0);

      const [notification] = t.events.uiCallsFor("notify");
      expect(notification.args[0]).toBe("Detected 1 fence comment, agent asked to remove.");
      expect(notification.args[1]).toBe("info");
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
      expect(result.text).toContain("Fence comments detected in added code:");
      expect(result.text).toContain("src/greet.ts:2: // ---- helpers ----");
      expect(t.events.blockedCalls()).toHaveLength(0);

      const [notification] = t.events.uiCallsFor("notify");
      expect(notification.args[0]).toBe("Detected 1 fence comment, agent asked to remove.");
      expect(notification.args[1]).toBe("info");
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
      expect(t.events.uiCallsFor("notify")).toHaveLength(0);
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
      expect(blocked.blockReason).toContain("Write blocked — fence comments in added code:");
      expect(blocked.blockReason).toContain("src/greet.ts:2: // ---- helpers ----");
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
      expect(result.text).toContain("Fence comments were automatically removed:");
      expect(result.text).toContain("src/greet.ts:2: // ---- helpers ----");
      expect(t.events.blockedCalls()).toHaveLength(0);

      const [notification] = t.events.uiCallsFor("notify");
      expect(notification.args[0]).toBe("Removed 1 fence comment, agent notified.");
      expect(notification.args[1]).toBe("info");
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
      expect(result.text).toContain("Fence comments were automatically removed:");
      expect(result.text).toContain("src/greet.ts:2: // ---- helpers ----");
      expect(t.events.blockedCalls()).toHaveLength(0);

      const [notification] = t.events.uiCallsFor("notify");
      expect(notification.args[0]).toBe("Removed 1 fence comment, agent notified.");
      expect(notification.args[1]).toBe("info");
    });
  });

  describe("PI_FENCE_MODE env variable", () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.PI_FENCE_MODE;
    });

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.PI_FENCE_MODE;
      } else {
        process.env.PI_FENCE_MODE = originalEnv;
      }
    });

    it("uses env variable when no flag is set", async () => {
      process.env.PI_FENCE_MODE = "block";

      t = await createTestSession({
        extensionFactories: [defaultFenceExtension()],
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
      expect(blocked.blockReason).toContain("Write blocked");
    });

    it("flag takes precedence over env variable", async () => {
      process.env.PI_FENCE_MODE = "block";

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

      expect(t.events.blockedCalls()).toHaveLength(0);
      const [result] = t.events.toolResultsFor("write");
      expect(result.text).toContain("Fence comments detected in added code:");
    });
  });
});

// Bug: edit handler parses each newText fragment in isolation rather than in
// the context of the full file. When the replacement text belongs to a template
// literal in the actual file, tree-sitter mis-classifies fence-pattern text as
// a comment (false positive). These tests assert correct behaviour (no false
// positive) and currently FAIL, proving the bug is present.
describe("edit tool - false positive for fence-pattern text inside string context (bug)", {
  timeout: 30_000,
}, () => {
  let t: TestSession;
  afterEach(() => t?.dispose());

  /**
   * The edited region (`newText`) belongs to the body of a template literal in
   * the existing file.  Inside a template literal `//` has no special meaning,
   * so the fence-looking text is NOT a comment and must not be flagged.
   */
  it("does not report a fence for fence-pattern text inside a template literal", async () => {
    t = await createTestSession({
      extensionFactories: [fenceExtension("warn")],
      mockTools: { edit: "Edited." },
    });

    // Write the existing file into the session's working directory so the
    // extension can read the full-file context via readExisting().
    const fileDir = path.join(t.cwd, "src");
    fs.mkdirSync(fileDir, { recursive: true });
    fs.writeFileSync(
      path.join(fileDir, "example.ts"),
      ["export const readme = `", "Some initial content.", "`;", ""].join("\n"),
    );

    await t.run(
      when("Edit a file", [
        calls("edit", {
          path: "src/example.ts",
          edits: [
            {
              oldText: "Some initial content.",
              // Parsed in isolation this looks like a fence comment, but inside
              // the surrounding template literal it is plain text, not code.
              newText: "Some initial content.\n// ---- section ----\nMore content.",
            },
          ],
        }),
        says("Done."),
      ]),
    );

    // No fence should be reported: the pattern is inside a template literal.
    const [result] = t.events.toolResultsFor("edit");
    expect(result.text).not.toContain("Fence comments detected in added code:");
    expect(t.events.uiCallsFor("notify")).toHaveLength(0);
  });

  it("block mode: does not block an edit whose fence-pattern text is inside a template literal", async () => {
    t = await createTestSession({
      extensionFactories: [fenceExtension("block")],
      mockTools: { edit: "Edited." },
      propagateErrors: false,
    });

    const fileDir = path.join(t.cwd, "src");
    fs.mkdirSync(fileDir, { recursive: true });
    fs.writeFileSync(
      path.join(fileDir, "example.ts"),
      ["export const readme = `", "Some initial content.", "`;", ""].join("\n"),
    );

    await t.run(
      when("Edit a file", [
        calls("edit", {
          path: "src/example.ts",
          edits: [
            {
              oldText: "Some initial content.",
              newText: "Some initial content.\n// ---- section ----\nMore content.",
            },
          ],
        }),
        says("Done."),
      ]),
    );

    // Must not be blocked: the pattern is inside a template literal.
    expect(t.events.blockedCalls()).toHaveLength(0);
    expect(t.events.toolResultsFor("edit")).toHaveLength(1);
  });

  it("remove mode: does not strip fence-pattern text that is inside a template literal", async () => {
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

    const fileDir = path.join(t.cwd, "src");
    fs.mkdirSync(fileDir, { recursive: true });
    fs.writeFileSync(
      path.join(fileDir, "example.ts"),
      ["export const readme = `", "Some initial content.", "`;", ""].join("\n"),
    );

    await t.run(
      when("Edit a file", [
        calls("edit", {
          path: "src/example.ts",
          edits: [
            {
              oldText: "Some initial content.",
              newText: "Some initial content.\n// ---- section ----\nMore content.",
            },
          ],
        }),
        says("Done."),
      ]),
    );

    // Template-literal content must not be mutated.
    expect(capturedNewText).toContain("// ---- section ----");
    expect(t.events.uiCallsFor("notify")).toHaveLength(0);
  });
});
