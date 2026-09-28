import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import stripAnsi from "strip-ansi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubagentInstancesManager } from "../domain/subagent-instances-manager.js";
import { SubagentTemplatesManager } from "../domain/subagent-templates-manager.js";
import { ScriptedSessionBuilder } from "../test-helpers/scripted-session-builder.js";
import { makeAgentTemplate, makeRunning, mockTheme } from "../test-helpers.js";
import { createSubagentTool } from "./subagent-tool.js";

vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => {
  const original = await importOriginal<typeof import("@earendil-works/pi-coding-agent")>();
  return {
    ...original,
    createAgentSession: vi.fn(),
    SessionManager: { create: vi.fn().mockReturnValue({ appendCustomEntry: vi.fn() }) },
    SettingsManager: { create: vi.fn().mockReturnValue({}) },
  };
});

const providerError = "No API key found for google.";

function makeContext(): ExtensionContext {
  return {
    cwd: "/tmp",
    model: undefined,
    modelRegistry: { getAvailable: vi.fn().mockReturnValue([]) },
    ui: {
      theme: { fg: vi.fn((_color, text: string) => text) },
      setWorkingIndicator: vi.fn(),
      setWorkingMessage: vi.fn(),
    },
  } as unknown as ExtensionContext;
}

async function makeFailedManager(ctx: ExtensionContext): Promise<SubagentInstancesManager> {
  const manager = new SubagentInstancesManager(1);
  const session = new ScriptedSessionBuilder().providerError(providerError).build();
  vi.mocked(createAgentSession).mockResolvedValue({ session } as never);

  await manager.spawn({
    id: "1",
    ctx,
    template: makeAgentTemplate({ name: "developer" }),
    prompt: "first task",
    description: "First task",
    availableTools: [],
    signal: undefined,
    onUpdate: () => {},
  });

  return manager;
}

describe("subagent tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fails a follow-up tool call when provider returns an error", async () => {
    const ctx = makeContext();
    const instanceManager = await makeFailedManager(ctx);
    const pi = { getActiveTools: vi.fn().mockReturnValue([]) } as unknown as ExtensionAPI;
    const tool = createSubagentTool({
      pi,
      instanceManager,
      templatesManager: new SubagentTemplatesManager(ctx.cwd),
    });

    const execution = tool.execute(
      "tool-call-1",
      {
        id: "1",
        name: "developer",
        description: "Retry task",
        prompt: "try again",
      },
      undefined,
      undefined,
      ctx,
    );

    await expect(execution).rejects.toThrow(providerError);
  });

  it("restores the working indicator when subagent startup fails", async () => {
    const ctx = makeContext();
    const tool = createSubagentTool({
      pi: { getActiveTools: vi.fn().mockReturnValue([]) } as unknown as ExtensionAPI,
      instanceManager: new SubagentInstancesManager(1),
      templatesManager: new SubagentTemplatesManager(ctx.cwd),
    });

    const execution = tool.execute(
      "tool-call-1",
      {
        id: "unknown",
        name: "developer",
        description: "Retry task",
        prompt: "try again",
      },
      undefined,
      undefined,
      ctx,
    );

    await expect(execution).rejects.toThrow("Unknown subagent instance");
    expect(ctx.ui.setWorkingIndicator).toHaveBeenLastCalledWith();
  });

  it("stops running render updates after Pi reports a tool error", () => {
    vi.useFakeTimers();
    const ctx = makeContext();
    const tool = createSubagentTool({
      pi: { getActiveTools: vi.fn().mockReturnValue([]) } as unknown as ExtensionAPI,
      instanceManager: new SubagentInstancesManager(1),
      templatesManager: new SubagentTemplatesManager(ctx.cwd),
    });
    const onInvalidate = vi.fn();
    const running = tool.renderResult!(
      { content: [], details: makeRunning().toEntry() },
      { expanded: false, isPartial: true },
      mockTheme,
      {
        expanded: false,
        isError: false,
        lastComponent: undefined,
        invalidate: onInvalidate,
      } as never,
    );
    vi.advanceTimersByTime(80);
    onInvalidate.mockClear();

    tool.renderResult!(
      { content: [{ type: "text", text: providerError }], details: {} } as never,
      { expanded: false, isPartial: false },
      mockTheme,
      {
        expanded: false,
        isError: true,
        lastComponent: running,
        invalidate: onInvalidate,
      } as never,
    );
    vi.advanceTimersByTime(160);

    expect(onInvalidate).not.toHaveBeenCalled();
  });

  it("renders Pi tool errors when expanded", () => {
    const ctx = makeContext();
    const tool = createSubagentTool({
      pi: { getActiveTools: vi.fn().mockReturnValue([]) } as unknown as ExtensionAPI,
      instanceManager: new SubagentInstancesManager(1),
      templatesManager: new SubagentTemplatesManager(ctx.cwd),
    });
    const result = {
      content: [{ type: "text", text: providerError }],
      details: {},
    } as never;
    const collapsed = tool.renderResult!(result, { expanded: false, isPartial: false }, mockTheme, {
      expanded: false,
      isError: true,
      lastComponent: undefined,
    } as never);
    collapsed.render(120);

    const expanded = tool.renderResult!(result, { expanded: true, isPartial: false }, mockTheme, {
      expanded: true,
      isError: true,
      lastComponent: collapsed,
    } as never);

    expect(stripAnsi(expanded.render(120).join("\n"))).toContain(providerError);
  });
});
