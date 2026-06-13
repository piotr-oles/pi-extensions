import { DefaultResourceLoader, getAgentDir } from "@earendil-works/pi-coding-agent";
import type { AgentConfig } from "../domain/agent-config.js";

export class SubagentsResourceLoader extends DefaultResourceLoader {
  private readonly config: AgentConfig;

  constructor(cwd: string, config: AgentConfig) {
    super({ cwd, agentDir: getAgentDir() });
    this.config = config;
  }

  override getSystemPrompt(): string {
    const subagentBlock = [
      `<subagent name="${escapeXmlAttr(this.config.name)}" description="${escapeXmlAttr(this.config.description.replaceAll("\n", " "))}">`,
      this.config.instructions.trim(),
      "</subagent>",
    ].join("\n");

    const parent = super.getSystemPrompt();
    return parent ? `${parent}\n${subagentBlock}` : subagentBlock;
  }
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
