import type { CustomEntry, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { showSubagentTemplatesMenu as showSubagentTemplates } from "./commands/subagent-templates-menu.js";
import { SUBAGENT_INIT_ENTRY_TYPE } from "./constants.js";
import type { SubagentConfig, SubagentEntry } from "./domain/subagent-config.js";
import { SubagentInstancesManager } from "./domain/subagent-instances-manager.js";
import { buildModelKey } from "./domain/subagent-model.js";
import { SubagentTemplatesManager } from "./domain/subagent-templates-manager.js";
import { getMaxConcurrent, registerFlags } from "./flags.js";
import { updateAgentSystemPropmt, updateSubagentSystemPrompt } from "./system-prompt.js";
import { createSubagentTool } from "./tools/subagent-tool.js";

export default async function piSubagents(pi: ExtensionAPI): Promise<void> {
  registerFlags(pi);

  const templatesManager = new SubagentTemplatesManager(process.cwd());
  await templatesManager.reload();
  const instanceManager = new SubagentInstancesManager(getMaxConcurrent(pi));

  pi.registerTool(createSubagentTool({ pi, instanceManager, templatesManager }));

  pi.registerCommand("subagent:templates", {
    description: "List available subagent templates",
    handler: async (_args, ctx) => {
      await showSubagentTemplates(ctx, templatesManager);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    const config = readSubagentConfig(ctx);
    if (config) {
      await applySubagentConfig(pi, ctx, templatesManager, config);
    }
  });

  pi.on("before_agent_start", async (event, ctx) => {
    await templatesManager.reload();

    const config = readSubagentConfig(ctx);

    if (config) {
      await applySubagentConfig(pi, ctx, templatesManager, config);
      const enabledTemplates = templatesManager.listEnabledTemplates();
      return {
        systemPrompt: updateSubagentSystemPrompt(
          event.systemPrompt,
          enabledTemplates,
          config.template,
        ),
      };
    }

    const enabledTemplates = templatesManager.listEnabledTemplates();
    if (enabledTemplates.length === 0) {
      return undefined;
    }
    return {
      systemPrompt: updateAgentSystemPropmt(event.systemPrompt, enabledTemplates),
    };
  });
}

function readSubagentConfig(ctx: ExtensionContext): SubagentConfig | undefined {
  const entries = ctx.sessionManager.getEntries();
  const initEntry = entries.find(
    (e): e is CustomEntry<SubagentEntry> =>
      e.type === "custom" && e.customType === SUBAGENT_INIT_ENTRY_TYPE,
  );
  return initEntry?.data?.config;
}

async function applySubagentConfig(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  templatesManager: SubagentTemplatesManager,
  config: SubagentConfig,
): Promise<void> {
  const currentTools = pi.getActiveTools();
  const desiredTools = config.includedTools;
  if (!areSetsEqual(currentTools, desiredTools)) {
    pi.setActiveTools(desiredTools);
  }

  if (pi.getThinkingLevel() !== config.thinkingLevel) {
    pi.setThinkingLevel(config.thinkingLevel);
  }

  if (config.model) {
    const currentModelKey = ctx.model ? buildModelKey(ctx.model.provider, ctx.model.id) : undefined;
    if (currentModelKey !== config.model) {
      const models = ctx.modelRegistry.getAvailable();
      const model = models?.find(
        (m) => buildModelKey(m.provider, m.id) === config.model || m.id === config.model,
      );
      if (model) {
        await pi.setModel(model);
      }
    }
  }

  templatesManager.setEnabledTemplates(config.includedSubagents);
}

function areSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}
