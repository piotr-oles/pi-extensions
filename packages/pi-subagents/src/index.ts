import type { CustomEntry, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { showSubagentTemplatesMenu as showSubagentTemplates } from "./commands/subagent-templates-menu.js";
import { SubagentInstancesManager } from "./domain/subagent-instances-manager.js";
import type { SubagentTemplate } from "./domain/subagent-template.js";
import { SubagentTemplatesManager } from "./domain/subagent-templates-manager.js";
import type { SubagentConfigEntry } from "./domain/types.js";
import { getMaxConcurrent, registerFlags } from "./flags.js";
import { createSubagentTool } from "./tools/subagent-tool.js";
import { escapeXmlAttr } from "./xml.js";

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

  pi.on("before_agent_start", async (event, ctx) => {
    await templatesManager.reload();

    const entries = ctx.sessionManager.getEntries();
    const configEntry = entries.find(
      (e): e is CustomEntry<SubagentConfigEntry> =>
        e.type === "custom" && e.customType === "pi-subagents:config",
    );

    let allowedTemplates = templatesManager.listTemplates();
    if (configEntry) {
      const allowedSubagents = new Set(configEntry.data?.allowedSubagents ?? []);
      allowedTemplates = allowedTemplates.filter((template) => allowedSubagents.has(template.name));
    }
    const enabledTemplates = allowedTemplates.filter((template) => template.enabled);

    if (enabledTemplates.length > 0) {
      return {
        systemPrompt: `${event.systemPrompt}\n\n${subagentsSystemPrompt(enabledTemplates)}`,
      };
    }
  });
}

function subagentsSystemPrompt(templates: SubagentTemplate[]): string {
  return [
    "Subagents:",
    "Your context window is limited, when possible delegate tasks to subagents using `subagent` tool.",
    buildSubagentsXml(templates),
  ].join("\n");
}

function buildSubagentsXml(templates: SubagentTemplate[]): string {
  return [
    "<subagents>",
    templates
      .map(
        (template) =>
          `  <subagent name="${escapeXmlAttr(template.name)}" description="${escapeXmlAttr(template.description)}" />`,
      )
      .join("\n"),
    "</subagents>",
  ].join("\n");
}
