import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { showSubagents } from "./commands/agents-menu.js";
import { AgentInstancesManager } from "./domain/agent-instances-manager.js";
import { AgentTemplatesManager } from "./domain/agent-templates-manager.js";
import type { AgentTemplate } from "./domain/types.js";
import { getMaxConcurrent, registerFlags } from "./flags.js";
import { createSubagentTool } from "./tools/subagent-tool.js";
import { escapeXmlAttr } from "./xml.js";

export default async function piSubagents(pi: ExtensionAPI): Promise<void> {
  registerFlags(pi);

  const templatesManager = new AgentTemplatesManager(process.cwd());
  await templatesManager.reload();
  const instanceManager = new AgentInstancesManager(getMaxConcurrent(pi));

  pi.registerTool(createSubagentTool({ pi, instanceManager, templatesManager }));

  pi.registerCommand("subagents", {
    description: "List available subagents",
    handler: async (_args, ctx) => {
      await showSubagents(ctx, templatesManager);
    },
  });

  pi.on("before_agent_start", async (event) => {
    await templatesManager.reload();
    return {
      systemPrompt: `${event.systemPrompt}\n\n${subagentsSystemPrompt(templatesManager.listTemplates())}`,
    };
  });
}

function subagentsSystemPrompt(templates: AgentTemplate[]): string {
  return [
    "Subagents:",
    "Your context window is limited, when possible delegate tasks to subagents using `subagent` tool.",
    subagentsXmlList(templates),
  ].join("\n");
}

function subagentsXmlList(templates: AgentTemplate[]): string {
  return [
    "<subagents>",
    templates
      .filter((template) => template.enabled)
      .map(
        (template) =>
          `  <subagent name="${escapeXmlAttr(template.name)}" description="${escapeXmlAttr(template.description)}" />`,
      )
      .join("\n"),
    "</subagents>",
  ].join("\n");
}
