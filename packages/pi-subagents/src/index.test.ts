import type {
  BeforeAgentStartEvent,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SUBAGENT_INIT_ENTRY_TYPE } from "./constants.js";
import type { SubagentConfig, SubagentEntry } from "./domain/subagent-config.js";
import type { SubagentTemplate } from "./domain/subagent-template.js";
import piSubagents from "./index.js";
import { makeAgentConfig, makeAgentTemplate } from "./test-helpers.js";

interface MockTemplatesManager {
  reload: ReturnType<typeof vi.fn>;
  listTemplates: ReturnType<typeof vi.fn>;
  setEnabledTemplates: ReturnType<typeof vi.fn>;
  listEnabledTemplates: ReturnType<typeof vi.fn>;
}

let capturedTemplatesManager: MockTemplatesManager | undefined;

vi.mock("./domain/subagent-templates-manager.js", () => ({
  SubagentTemplatesManager: vi.fn().mockImplementation(() => {
    let enabledSubagents: string[] | null = null;
    capturedTemplatesManager = {
      reload: vi.fn().mockResolvedValue(undefined),
      listTemplates: vi.fn().mockReturnValue([]),
      setEnabledTemplates: vi.fn().mockImplementation((names: string[] | null) => {
        enabledSubagents = names;
      }),
      listEnabledTemplates: vi.fn().mockImplementation(() => {
        const templates = capturedTemplatesManager!.listTemplates() as SubagentTemplate[];
        return templates.filter(
          (t) => t.enabled && (enabledSubagents === null || enabledSubagents.includes(t.name)),
        );
      }),
    };
    return capturedTemplatesManager;
  }),
}));

vi.mock("./domain/subagent-instances-manager.js", () => ({
  SubagentInstancesManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("./tools/subagent-tool.js", () => ({
  createSubagentTool: vi.fn().mockReturnValue({ name: "subagent" }),
}));

vi.mock("./commands/subagent-templates-menu.js", () => ({
  showSubagentTemplatesMenu: vi.fn(),
}));

type BeforeAgentStartHandler = (
  event: BeforeAgentStartEvent,
  ctx: ExtensionContext,
) => Promise<{ systemPrompt: string } | undefined>;

function makeEvent(overrides: Partial<BeforeAgentStartEvent> = {}): BeforeAgentStartEvent {
  return {
    type: "before_agent_start",
    systemPrompt: "base system prompt",
    prompt: "user prompt",
    systemPromptOptions: {} as never,
    ...overrides,
  };
}

function makeMockCtx(entries: unknown[] = [], availableModels: unknown[] = []): ExtensionContext {
  return {
    cwd: "/tmp",
    model: undefined,
    modelRegistry: {
      getAvailable: vi.fn().mockReturnValue(availableModels),
    },
    sessionManager: {
      getEntries: vi.fn().mockReturnValue(entries),
    },
  } as unknown as ExtensionContext;
}

function makeCustomEntry(customType: string, data: unknown) {
  return { type: "custom", customType, data };
}

function makeConfigEntry(config: SubagentConfig) {
  return makeCustomEntry(SUBAGENT_INIT_ENTRY_TYPE, { config } satisfies SubagentEntry);
}

function makeLegacyEntry(includedSubagents: string[]) {
  return makeCustomEntry(SUBAGENT_INIT_ENTRY_TYPE, { includedSubagents });
}

async function setupExtension(): Promise<{
  pi: ExtensionAPI;
  templatesManager: MockTemplatesManager;
  getHandler: () => BeforeAgentStartHandler;
}> {
  const handlers: Map<string, BeforeAgentStartHandler> = new Map();

  const pi = {
    registerFlag: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    getFlag: vi.fn().mockReturnValue("4"),
    on: vi.fn().mockImplementation((event: string, handler: BeforeAgentStartHandler) => {
      handlers.set(event, handler);
    }),
    getActiveTools: vi.fn().mockReturnValue([]),
    getThinkingLevel: vi.fn().mockReturnValue("off"),
    setActiveTools: vi.fn(),
    setThinkingLevel: vi.fn(),
    setModel: vi.fn().mockResolvedValue(true),
  } as unknown as ExtensionAPI;

  await piSubagents(pi);

  const templatesManager = capturedTemplatesManager!;

  return {
    pi,
    templatesManager,
    getHandler: () => {
      const h = handlers.get("before_agent_start");
      if (!h) {
        throw new Error("before_agent_start handler not registered");
      }
      return h;
    },
  };
}

describe("piSubagents before_agent_start", () => {
  let pi: ExtensionAPI;
  let templatesManager: MockTemplatesManager;
  let handler: BeforeAgentStartHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    const setup = await setupExtension();
    pi = setup.pi;
    templatesManager = setup.templatesManager;
    handler = setup.getHandler();
  });

  describe("new config path (SubagentEntry with config)", () => {
    it("calls setActiveTools with config.includedTools", async () => {
      const config = makeAgentConfig({ includedTools: ["bash", "read"] });
      const ctx = makeMockCtx([makeConfigEntry(config)]);
      await handler(makeEvent(), ctx);
      expect(pi.setActiveTools).toHaveBeenCalledWith(["bash", "read"]);
    });

    it("calls setThinkingLevel with config.thinkingLevel", async () => {
      const config = makeAgentConfig({ thinkingLevel: "high" });
      const ctx = makeMockCtx([makeConfigEntry(config)]);
      await handler(makeEvent(), ctx);
      expect(pi.setThinkingLevel).toHaveBeenCalledWith("high");
    });

    it("calls setModel when config.model matches available model", async () => {
      const mockModel = { id: "gpt-4o", name: "GPT-4o", provider: "openai" };
      const config = makeAgentConfig({ model: "openai / gpt-4o" });
      const ctx = makeMockCtx([makeConfigEntry(config)], [mockModel]);
      await handler(makeEvent(), ctx);
      expect(pi.setModel).toHaveBeenCalledWith(mockModel);
    });

    it("does not call setModel when model not found in registry", async () => {
      const config = makeAgentConfig({ model: "openai / gpt-4o" });
      const ctx = makeMockCtx([makeConfigEntry(config)], []);
      await handler(makeEvent(), ctx);
      expect(pi.setModel).not.toHaveBeenCalled();
    });

    it("calls setModel when config.model matches by id only (legacy key format)", async () => {
      const mockModel = { id: "gpt-4o", name: "GPT-4o", provider: "openai" };
      const config = makeAgentConfig({ model: "gpt-4o" }); // id-only, not "openai / gpt-4o"
      const ctx = makeMockCtx([makeConfigEntry(config)], [mockModel]);
      await handler(makeEvent(), ctx);
      expect(pi.setModel).toHaveBeenCalledWith(mockModel);
    });

    it("does not call setModel when config.model is undefined", async () => {
      const config = makeAgentConfig({ model: undefined });
      const ctx = makeMockCtx([makeConfigEntry(config)]);
      await handler(makeEvent(), ctx);
      expect(pi.setModel).not.toHaveBeenCalled();
    });

    it("injects instructions into systemPrompt", async () => {
      const template = makeAgentTemplate({ name: "reviewer", instructions: "review carefully" });
      const config = makeAgentConfig({ template, includedSubagents: [] });
      const ctx = makeMockCtx([makeConfigEntry(config)]);
      const result = await handler(makeEvent({ systemPrompt: "base" }), ctx);
      expect(result?.systemPrompt).toContain('You\'re subagent "reviewer":');
      expect(result?.systemPrompt).toContain("review carefully");
      expect(result?.systemPrompt).toContain("base");
    });

    it("appends subagent xml when includedSubagents is non-empty and templates exist", async () => {
      const explorerTemplate = makeAgentTemplate({
        name: "explorer",
        description: "explores",
        enabled: true,
      });
      vi.mocked(templatesManager.listTemplates).mockReturnValue([explorerTemplate]);
      const config = makeAgentConfig({ includedSubagents: ["explorer"] });
      const ctx = makeMockCtx([makeConfigEntry(config)]);
      const result = await handler(makeEvent(), ctx);
      expect(result?.systemPrompt).toContain("<available_subagents>");
      expect(result?.systemPrompt).toContain("explorer");
    });

    it("no subagent xml when includedSubagents is empty", async () => {
      const explorerTemplate = makeAgentTemplate({
        name: "explorer",
        description: "explores",
        enabled: true,
      });
      vi.mocked(templatesManager.listTemplates).mockReturnValue([explorerTemplate]);
      const config = makeAgentConfig({ includedSubagents: [] });
      const ctx = makeMockCtx([makeConfigEntry(config)]);
      const result = await handler(makeEvent(), ctx);
      expect(result?.systemPrompt).not.toContain("<available_subagents>");
    });

    it("excludes disabled templates from subagent xml", async () => {
      const disabledTemplate = makeAgentTemplate({ name: "explorer", enabled: false });
      vi.mocked(templatesManager.listTemplates).mockReturnValue([disabledTemplate]);
      const config = makeAgentConfig({ includedSubagents: ["explorer"] });
      const ctx = makeMockCtx([makeConfigEntry(config)]);
      const result = await handler(makeEvent(), ctx);
      expect(result?.systemPrompt).not.toContain("<available_subagents>");
    });
  });

  describe("legacy config path (old { includedSubagents } shape)", () => {
    it("ignores legacy entry and shows all enabled templates", async () => {
      const explorerTemplate = makeAgentTemplate({
        name: "explorer",
        description: "explores",
        enabled: true,
      });
      const otherTemplate = makeAgentTemplate({
        name: "other",
        description: "other",
        enabled: true,
      });
      vi.mocked(templatesManager.listTemplates).mockReturnValue([explorerTemplate, otherTemplate]);
      const ctx = makeMockCtx([makeLegacyEntry(["explorer"])]);
      const result = await handler(makeEvent({ systemPrompt: "base" }), ctx);
      expect(result?.systemPrompt).toContain("explorer");
      expect(result?.systemPrompt).toContain("other");
      expect(result?.systemPrompt).toContain("base");
    });
  });

  describe("no config entry", () => {
    it("shows all enabled templates in xml", async () => {
      const t1 = makeAgentTemplate({ name: "agent-a", description: "a", enabled: true });
      const t2 = makeAgentTemplate({ name: "agent-b", description: "b", enabled: true });
      vi.mocked(templatesManager.listTemplates).mockReturnValue([t1, t2]);
      const ctx = makeMockCtx([]);
      const result = await handler(makeEvent(), ctx);
      expect(result?.systemPrompt).toContain("agent-a");
      expect(result?.systemPrompt).toContain("agent-b");
    });

    it("excludes disabled templates", async () => {
      const enabled = makeAgentTemplate({ name: "agent-a", enabled: true });
      const disabled = makeAgentTemplate({ name: "agent-b", enabled: false });
      vi.mocked(templatesManager.listTemplates).mockReturnValue([enabled, disabled]);
      const ctx = makeMockCtx([]);
      const result = await handler(makeEvent(), ctx);
      expect(result?.systemPrompt).toContain("agent-a");
      expect(result?.systemPrompt).not.toContain("agent-b");
    });

    it("returns undefined when no enabled templates", async () => {
      vi.mocked(templatesManager.listTemplates).mockReturnValue([]);
      const ctx = makeMockCtx([]);
      const result = await handler(makeEvent(), ctx);
      expect(result).toBeUndefined();
    });
  });
});
