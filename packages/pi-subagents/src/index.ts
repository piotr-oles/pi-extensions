import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { showSubagents } from "./commands/agents-menu.js";
import { AgentInstancesManager } from "./domain/agent-instances-manager.js";
import { AgentTemplatesManager } from "./domain/agent-templates-manager.js";
import { registerFlags } from "./flags.js";
import { createSubagentTool } from "./tools/subagent-tool.js";

export default async function piSubagents(pi: ExtensionAPI): Promise<void> {
  registerFlags(pi);

  const templatesManager = new AgentTemplatesManager(process.cwd());
  await templatesManager.reload();
  const manager = new AgentInstancesManager(pi);

  pi.registerTool(createSubagentTool({ pi, manager, templatesManager }));

  pi.registerCommand("subagents", {
    description: "List available subagents",
    handler: async (_args, ctx) => {
      await showSubagents(ctx, templatesManager);
    },
  });

  pi.on("session_start", async (_event) => {
    await templatesManager.reload();
  });
}
