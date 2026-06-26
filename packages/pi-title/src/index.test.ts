import { createTestSession, says, type TestSession, when } from "@marcfargas/pi-test-harness";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import piTitle, { MAX_TITLE_LENGTH, MIN_PROMPT_LENGTH } from "./index.js";

vi.mock("@earendil-works/pi-ai", () => ({
  complete: vi.fn(),
}));

import { complete } from "@earendil-works/pi-ai";

const mockComplete = vi.mocked(complete);

// 82 chars — above MAX_TITLE_LENGTH (40) and MIN_PROMPT_LENGTH (60)
const LONG_MESSAGE =
  "Add dark mode toggle to the user settings page with system preference detection";
// Exactly at MAX_TITLE_LENGTH — sets hasNamed after one turn
const THRESHOLD_MESSAGE = "A".repeat(MAX_TITLE_LENGTH);

function fakeTitle(text: string) {
  return {
    role: "assistant" as const,
    timestamp: Date.now(),
    content: [{ type: "text" as const, text }],
  } as any;
}

describe("pi-title", { timeout: 30_000 }, () => {
  let t: TestSession;

  beforeEach(() => {
    mockComplete.mockResolvedValue(fakeTitle("Generated title"));
  });

  afterEach(() => {
    t?.dispose();
    vi.clearAllMocks();
  });

  function sessionName() {
    return t.session.sessionManager.getSessionName() as string | undefined;
  }

  function registeredCommand(name: string) {
    return t.session.extensionRunner.getRegisteredCommands().find((cmd: any) => cmd.name === name);
  }

  async function runCommand(name: string, args = "") {
    const cmd = registeredCommand(name);
    if (!cmd) {
      throw new Error(`Command "${name}" not registered`);
    }
    const ctx = t.session.extensionRunner.createCommandContext();
    return cmd.handler(args, ctx);
  }

  describe("auto-generation", () => {
    it("sets session name on first turn", async () => {
      t = await createTestSession({ extensionFactories: [piTitle] });

      await t.run(when(LONG_MESSAGE, [says("Done.")]));

      await vi.waitFor(() => expect(sessionName()).toBe("Generated title"));
    });

    it("generates on every turn while prompt length stays below threshold", async () => {
      t = await createTestSession({ extensionFactories: [piTitle] });

      await t.run(when("hi", [says("Hello!")]), when("thanks", [says("Done.")]));

      await vi.waitFor(() => expect(mockComplete).toHaveBeenCalledTimes(2));
    });

    it("stops generating once prompt length reaches MAX_TITLE_LENGTH", async () => {
      t = await createTestSession({ extensionFactories: [piTitle] });

      await t.run(when(THRESHOLD_MESSAGE, [says("Done.")]), when(LONG_MESSAGE, [says("Done.")]));

      await vi.waitFor(() => expect(mockComplete).toHaveBeenCalledOnce());
      expect(mockComplete).toHaveBeenCalledOnce();
    });

    it("strips quotes from generated title", async () => {
      mockComplete.mockResolvedValue(fakeTitle('"Add dark mode"'));

      t = await createTestSession({ extensionFactories: [piTitle] });
      await t.run(when(LONG_MESSAGE, [says("Done.")]));

      await vi.waitFor(() => expect(sessionName()).toBe("Add dark mode"));
    });

    it(`truncates title to ${MAX_TITLE_LENGTH} characters`, async () => {
      mockComplete.mockResolvedValue(fakeTitle("A".repeat(80)));

      t = await createTestSession({ extensionFactories: [piTitle] });
      await t.run(when(LONG_MESSAGE, [says("Done.")]));

      await vi.waitFor(() => expect(sessionName()).toBeDefined());
      expect(sessionName()!.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    });

    it("does not set name when model returns empty text", async () => {
      mockComplete.mockResolvedValue(fakeTitle("   "));

      t = await createTestSession({ extensionFactories: [piTitle] });
      await t.run(when(LONG_MESSAGE, [says("Done.")]));

      await vi.waitFor(() => expect(mockComplete).toHaveBeenCalledOnce());
      expect(sessionName()).toBeUndefined();
    });

    it("does not crash and shows notification when model errors", async () => {
      mockComplete.mockRejectedValue(new Error("network failure"));

      t = await createTestSession({ extensionFactories: [piTitle] });
      await t.run(when(LONG_MESSAGE, [says("Done.")]));

      await vi.waitFor(() => expect(mockComplete).toHaveBeenCalledOnce());
      expect(sessionName()).toBeUndefined();
      expect(t.events.uiCallsFor("notify").length).toBeGreaterThan(0);
    });
  });

  describe("complete() call arguments", () => {
    it("sends system prompt with user message on first turn", async () => {
      t = await createTestSession({ extensionFactories: [piTitle] });
      await t.run(when(LONG_MESSAGE, [says("Done.")]));
      await vi.waitFor(() => expect(mockComplete).toHaveBeenCalledOnce());

      const content0 = mockComplete.mock.calls[0][1].messages[0].content[0] as { text: string };
      const { text } = content0;
      expect(text).toMatchInlineSnapshot(`
        "You are naming a conversation session. Based on the user message below, produce a single short title (max 40 characters, no quotes). Be specific — mention the main topic. Use sentence case.
        User messages:
        <message>Add dark mode toggle to the user settings page with system preference detection</message>"
      `);
    });

    it("includes accumulated prompts and previous title on subsequent turn", async () => {
      t = await createTestSession({ extensionFactories: [piTitle] });
      await t.run(when("short msg", [says("Done.")]));
      await vi.waitFor(() => expect(sessionName()).toBe("Generated title"));

      mockComplete.mockClear();
      await t.run(when("another msg", [says("Done.")]));
      await vi.waitFor(() => expect(mockComplete).toHaveBeenCalledOnce());

      const content1 = mockComplete.mock.calls[0][1].messages[0].content[0] as { text: string };
      const { text } = content1;
      expect(text).toMatchInlineSnapshot(`
        "You are naming a conversation session. Based on the user message below, produce a single short title (max 40 characters, no quotes). Be specific — mention the main topic. Use sentence case.
        User messages:
        <message>short msg</message>
        <message>another msg</message>

        The current title is "Generated title" — refine it if you now have better context, otherwise keep it."
      `);
    });
  });

  describe("/title command", () => {
    it("is registered on extension load", async () => {
      t = await createTestSession({ extensionFactories: [piTitle] });

      expect(registeredCommand("title")).toBeDefined();
    });

    it("throws when no prompts have been collected", async () => {
      t = await createTestSession({ extensionFactories: [piTitle] });

      await expect(runCommand("title")).rejects.toThrow(/no prompts/i);
      expect(mockComplete).not.toHaveBeenCalled();
    });

    it("sets session name from prompts collected before command invocation", async () => {
      t = await createTestSession({ extensionFactories: [piTitle] });
      await t.run(when(LONG_MESSAGE, [says("Done.")]));
      await vi.waitFor(() => expect(mockComplete).toHaveBeenCalledOnce());

      mockComplete.mockClear();
      mockComplete.mockResolvedValue(fakeTitle("Regenerated title"));

      await runCommand("title");

      expect(sessionName()).toBe("Regenerated title");
    });

    it("notifies with success message after setting name", async () => {
      t = await createTestSession({ extensionFactories: [piTitle] });
      await t.run(when(LONG_MESSAGE, [says("Done.")]));
      await vi.waitFor(() => expect(mockComplete).toHaveBeenCalledOnce());

      mockComplete.mockClear();
      mockComplete.mockResolvedValue(fakeTitle("My title"));

      await runCommand("title");

      const notifyCalls = t.events.uiCallsFor("notify");
      expect(notifyCalls.at(-1)?.args[0]).toMatch(/My title/);
    });

    it("throws when model returns empty title", async () => {
      t = await createTestSession({ extensionFactories: [piTitle] });
      await t.run(when(LONG_MESSAGE, [says("Done.")]));
      await vi.waitFor(() => expect(mockComplete).toHaveBeenCalledOnce());

      mockComplete.mockClear();
      mockComplete.mockResolvedValue(fakeTitle("   "));

      await expect(runCommand("title")).rejects.toThrow(/empty/i);
    });

    it("throws when model errors", async () => {
      t = await createTestSession({ extensionFactories: [piTitle] });
      await t.run(when(LONG_MESSAGE, [says("Done.")]));
      await vi.waitFor(() => expect(mockComplete).toHaveBeenCalledOnce());

      mockComplete.mockClear();
      mockComplete.mockRejectedValue(new Error("network failure"));

      await expect(runCommand("title")).rejects.toThrow("network failure");
    });

    it("prevents further auto-generation after command success", async () => {
      t = await createTestSession({ extensionFactories: [piTitle] });
      await t.run(when("hi", [says("Hello.")]));
      await vi.waitFor(() => expect(mockComplete).toHaveBeenCalledOnce());

      mockComplete.mockClear();
      mockComplete.mockResolvedValue(fakeTitle("Command title"));
      await runCommand("title");
      expect(sessionName()).toBe("Command title");

      mockComplete.mockClear();
      await t.run(when("another message", [says("Done.")]));
      await new Promise((r) => setTimeout(r, 50));
      expect(mockComplete).not.toHaveBeenCalled();
    });

    it("uses only recent prompts — enough to meet MIN_PROMPT_LENGTH", async () => {
      const longPrompt = "I want to refactor the UserService to use the repository pattern";
      expect(longPrompt.length).toBeGreaterThanOrEqual(MIN_PROMPT_LENGTH);

      t = await createTestSession({ extensionFactories: [piTitle] });
      await t.run(
        when("hi", [says("Hello!")]),
        when("thanks", [says("Sure!")]),
        when(longPrompt, [says("Done.")]),
      );
      await vi.waitFor(() => expect(mockComplete).toHaveBeenCalled());

      mockComplete.mockClear();
      mockComplete.mockResolvedValue(fakeTitle("Refactor UserService"));
      await runCommand("title");

      expect(sessionName()).toBe("Refactor UserService");
    });
  });
});
