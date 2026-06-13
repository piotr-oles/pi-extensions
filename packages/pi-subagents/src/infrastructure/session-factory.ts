import type { Api, Model } from "@earendil-works/pi-ai";
import {
  createAgentSession,
  type ExtensionContext,
  type ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentConfig } from "../domain/agent-config.js";
import type { Session } from "../domain/types.js";
import { SubagentsResourceLoader } from "./subagents-resource-loader.js";

export async function createAgentSessionFromConfig(
  config: AgentConfig,
  ctx: ExtensionContext,
): Promise<Session> {
  const model = findModel(ctx.modelRegistry, config.model) ?? ctx.model;
  const resourceLoader = new SubagentsResourceLoader(ctx.cwd, config);

  const { session } = await createAgentSession({
    cwd: ctx.cwd,
    sessionManager: SessionManager.create(ctx.cwd),
    settingsManager: SettingsManager.create(ctx.cwd),
    modelRegistry: ctx.modelRegistry,
    model,
    tools: config.enabledTools,
    resourceLoader,
    thinkingLevel: config.thinkingLevel,
  });

  return session;
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
  return models.find(
    (model) => model.id.toLowerCase().includes(lower) || model.name.toLowerCase().includes(lower),
  );
}
