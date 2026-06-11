import type { Api, Model } from "@earendil-works/pi-ai";
import {
  type AgentSession,
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionContext,
  getAgentDir,
  type ResourceLoader,
  type ModelRegistry,
  type ResourceExtensionPaths,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentTemplate, ThinkingLevel } from "./types.js";

const DEFAULT_THINKING_LEVEL: ThinkingLevel = "medium";
const SUBAGENT_EXCLUDED_TOOLS = new Set<string>(["subagent", "subagent_check", "subagent_steer"]);

export interface AgentConfigOverrides {
  model?: string;
  thinkingLevel?: ThinkingLevel;
  maxTurns?: number;
  graceTurns?: number;
}

export interface AgentConfigParams {
  template: AgentTemplate;
  overrides?: AgentConfigOverrides;
  description: string;
  prompt: string;
  activeTools: string[];
}

export class AgentConfig {
  readonly name: string;
  readonly template: AgentTemplate;
  readonly instructions: string;
  readonly model?: string;
  readonly thinkingLevel: ThinkingLevel;
  readonly maxTurns?: number;
  readonly graceTurns?: number;
  readonly description: string;
  readonly prompt: string;
  readonly enabledTools: string[];

  constructor({ template, overrides = {}, description, prompt, activeTools }: AgentConfigParams) {
    this.template = template;
    this.name = template.name;
    this.instructions = template.instructions;
    this.model = overrides.model ?? template.model;
    this.thinkingLevel =
      overrides.thinkingLevel ?? template.thinkingLevel ?? DEFAULT_THINKING_LEVEL;
    this.maxTurns = overrides.maxTurns ?? template.maxTurns;
    this.graceTurns = overrides.graceTurns ?? template.graceTurns ?? 5;
    this.description = description;
    this.prompt = prompt;

    // resolve enabled tools
    const enabledTools = new Set(activeTools);
    for (const excludedTool of [...SUBAGENT_EXCLUDED_TOOLS, ...template.excludedTools]) {
      enabledTools.delete(excludedTool);
    }
    this.enabledTools = Array.from(enabledTools);
  }

  async createSession(ctx: ExtensionContext): Promise<AgentSession> {
    // const subagentSystemPrompt = [
    //   `<subagent name="${escapeXmlAttr(this.name)}" description="${escapeXmlAttr(this.description.replaceAll("\n", " "))}">`,
    //   this.instructions.trim(),
    //   "</subagent>",
    // ].join("\n");

    const model = findModel(ctx.modelRegistry, this.model) ?? ctx.model;

    const resourceLoader = new SubagentsResourceLoader({
      cwd: ctx.cwd,
      config: this
    });
    const { session } = await createAgentSession({
      cwd: ctx.cwd,
      sessionManager: SessionManager.create(ctx.cwd),
      settingsManager: SettingsManager.create(ctx.cwd),
      modelRegistry: ctx.modelRegistry,
      model: model,
      tools: this.enabledTools,
      resourceLoader,
      thinkingLevel: this.thinkingLevel,
    });
    // await session.bindExtensions({});

    return session;
  }
}

function findModel(registry: ModelRegistry, name: string | undefined): Model<Api> | undefined {
  if (!name) {
    return undefined;
  }
  const models = registry.getAvailable();
  if (!models || models.length === 0) {
    return undefined;
  }

  const exact = models.find(
    (model) => `${model.provider} / ${model.id}` === name || model.id === name,
  );
  if (exact) {
    return exact;
  }

  const lower = name.toLowerCase();
  const fuzzy = models.find(
    (model) => model.id.toLowerCase().includes(lower) || model.name.toLowerCase().includes(lower),
  );
  if (fuzzy) {
    return fuzzy;
  }

  return undefined;
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface SubagentResourceLoaderOptions {
  cwd: string;
  config: AgentConfig;
}

class SubagentsResourceLoader implements ResourceLoader {
  private readonly config: AgentConfig;
  private readonly loader: DefaultResourceLoader;

  constructor({ cwd, config }: SubagentResourceLoaderOptions) {
    this.config = config;
    this.loader = new DefaultResourceLoader({
      cwd,
      agentDir: getAgentDir(),
    });
  }

  getExtensions() {
    return this.loader.getExtensions();
  }
  getSkills() {
    return this.loader.getSkills();
  }
  getPrompts() {
    return this.loader.getPrompts();
  }
  getThemes() {
    return this.loader.getThemes();
  }
  getAgentsFiles() {
    return this.loader.getAgentsFiles();
  }
  getSystemPrompt() {
    const subagentSystemPrompt = [
      `<subagent name="${escapeXmlAttr(this.config.name)}" description="${escapeXmlAttr(this.config.description.replaceAll("\n", " "))}">`,
      this.config.instructions.trim(),
      "</subagent>",
    ].join("\n");

    return `${this.loader.getSystemPrompt()}\n${subagentSystemPrompt}`;
  }
  getAppendSystemPrompt() {
    return this.loader.getAppendSystemPrompt();
  }
  extendResources(paths: ResourceExtensionPaths) {
    return this.loader.extendResources(paths);
  }
  reload(): Promise<void> {
    return this.loader.reload();
  }
}
