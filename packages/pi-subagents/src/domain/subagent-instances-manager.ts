import { join, resolve } from "node:path";
import type { AgentContext, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import {
  type AgentSession,
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionContext,
  getAgentDir,
  type ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { escapeXmlContent } from "../xml.js";
import type { DoneSubagent } from "./instance/done-subagent.js";
import { QueuedSubagent } from "./instance/queued-subagent.js";
import type { SubagentConfig } from "./subagent-config.js";
import { SubagentStore } from "./subagent-store.js";
import type { SubagentTemplate } from "./subagent-template.js";
import type { Subagent, SubagentByStatus, SubagentId, SubagentStatus } from "./types.js";

const DEFAULT_THINKING_LEVEL: ThinkingLevel = "medium";
const DEFAULT_GRACE_TURNS = 5;

interface SpawnParams {
  id: SubagentId;
  ctx: ExtensionContext;
  template: SubagentTemplate;
  prompt: string;
  description: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  maxTurns?: number;
  graceTurns?: number;
  availableTools: string[];
  signal: AbortSignal | undefined;
  onUpdate: (instance: Subagent) => void;
}
interface FollowUpParams {
  id: SubagentId;
  prompt: string;
  description: string;
  signal: AbortSignal | undefined;
  onUpdate: (instance: Subagent) => void;
}

type ToolCallId = string;

export class SubagentInstancesManager {
  private readonly ids = new Map<ToolCallId, SubagentId>();
  private readonly store: SubagentStore;

  constructor(maxConcurrent: number) {
    this.store = new SubagentStore({ maxConcurrent });
  }

  id(toolCallId: ToolCallId): SubagentId {
    const existing = this.ids.get(toolCallId);
    if (existing) {
      return existing;
    }
    const id = String(this.ids.size + 1);
    this.ids.set(toolCallId, id);
    return id;
  }

  async spawn({
    id,
    ctx,
    template,
    prompt,
    description,
    model,
    thinkingLevel,
    maxTurns,
    graceTurns,
    availableTools,
    signal,
    onUpdate,
  }: SpawnParams): Promise<DoneSubagent> {
    if (this.store.has(id)) {
      throw new Error(`Subagent with id "${id}" already exists.`);
    }

    const resolvedModel =
      this.resolveModel(ctx.modelRegistry, model ?? template.model) ?? ctx.model;
    const enabledTools = this.resolveEnabledTools(template, availableTools);
    const config: SubagentConfig = {
      template: template,
      name: template.name,
      model: resolvedModel?.name,
      thinkingLevel: thinkingLevel ?? template.thinkingLevel ?? DEFAULT_THINKING_LEVEL,
      maxTurns: maxTurns ?? template.maxTurns,
      graceTurns: graceTurns ?? template.graceTurns ?? DEFAULT_GRACE_TURNS,
      enabledTools,
      allowedSubagents: template.allowedSubagents,
    };
    const session = await this.createSession(ctx.cwd, config, resolvedModel);
    const queued = new QueuedSubagent({
      id,
      prompt,
      description,
      config,
      session,
    });
    onUpdate(queued);

    return new Promise((resolve) => {
      this.store.enqueue({
        signal,
        queued,
        onUpdate,
        onDone: resolve,
      });
    });
  }

  async followUp({
    id,
    prompt,
    description,
    signal,
    onUpdate,
  }: FollowUpParams): Promise<DoneSubagent> {
    const instance = this.store.get(id);
    if (!instance) {
      throw new Error(`Unkown subagent instance with id ${id}.`);
    } else if (instance.status !== "done") {
      throw new Error(`Subagent with id ${id} is not done, can't follow-up yet.`);
    }
    const queued = instance.followUp({
      prompt,
      description,
    });
    onUpdate(queued);

    return new Promise((resolve) => {
      this.store.enqueue({
        signal,
        queued,
        onUpdate,
        onDone: resolve,
      });
    });
  }

  async steer(id: string, message: string): Promise<void> {
    this.store.steer(id, message);
  }

  getInstance<TStatus extends SubagentStatus>(
    id: string,
    status: TStatus,
  ): SubagentByStatus<TStatus> | undefined;
  getInstance(id: string): Subagent | undefined;
  getInstance(id: string, status?: SubagentStatus): Subagent | undefined {
    const instance = this.store.get(id);
    if (status && instance?.status !== status) {
      return undefined;
    }
    return instance;
  }

  listInstances<TStatus extends SubagentStatus>(status: TStatus): SubagentByStatus<TStatus>[];
  listInstances(): Subagent[];
  listInstances(status?: SubagentStatus): Subagent[] {
    const allInstances = this.store.list();
    const selectedInstances = status
      ? allInstances.filter((instance) => instance.status === status)
      : allInstances;

    // TODO: find better sorting mechanism
    return selectedInstances.sort(
      (instanceA, instanceB) => Number(instanceA.id) - Number(instanceB.id),
    );
  }

  isRunning(): boolean {
    const running = this.listInstances("running");
    return running.length > 0;
  }

  private resolveModel(registry: ModelRegistry, name: string | undefined): Model<Api> | undefined {
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
    return models.find(
      (model) => model.id.toLowerCase().includes(lower) || model.name.toLowerCase().includes(lower),
    );
  }

  private resolveEnabledTools(template: SubagentTemplate, availableTools: string[]): string[] {
    const canSpawn = (template.allowedSubagents?.length ?? 0) > 0;
    const allowed = new Set(template.includedTools ?? availableTools);
    if (!canSpawn) {
      allowed.delete("subagent");
    }
    return availableTools.filter((t) => allowed.has(t));
  }

  private resolveSessionsDir(cwd: string): string {
    // ~copy-paste from pi-subagent package, no API exposed to encode cwd
    const resolvedCwd = resolve(cwd);
    const encodedCwd = `--${resolvedCwd.replace(/^\//, "").replace(/[/\\:]/g, "-")}--`;
    return join(getAgentDir(), "sessions", "subagents", encodedCwd);
  }

  private async createSession(
    cwd: string,
    config: SubagentConfig,
    model: Model<Api> | undefined,
  ): Promise<AgentSession> {
    const sessionManager = SessionManager.create(cwd, this.resolveSessionsDir(cwd));
    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir: getAgentDir(),
      appendSystemPrompt: [this.buildSubagentSystemPrompt(config)],
    });
    await resourceLoader.reload();
    const { session } = await createAgentSession({
      cwd,
      sessionManager,
      settingsManager: SettingsManager.create(cwd),
      model,
      tools: config.enabledTools,
      resourceLoader,
      thinkingLevel: config.thinkingLevel,
    });
    sessionManager.appendCustomEntry("pi-subagents:allowed", {
      names: config.allowedSubagents ?? [],
    });
    return session;
  }

  private buildSubagentSystemPrompt(config: SubagentConfig): string {
    return [
      `You're subagent "${config.name}":`,
      `<subagent-instructions>`,
      escapeXmlContent(config.template.instructions.trim()),
      "</subagent-instructions>",
    ].join("\n");
  }
}
