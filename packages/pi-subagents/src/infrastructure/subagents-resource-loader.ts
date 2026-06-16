import { DefaultResourceLoader, getAgentDir } from "@earendil-works/pi-coding-agent";
import type { AgentConfig } from "../domain/agent-config.js";
import { escapeXmlAttr, escapeXmlContent } from "../xml.js";

export class SubagentsResourceLoader extends DefaultResourceLoader {
  private readonly config: AgentConfig;

  constructor(cwd: string, config: AgentConfig) {
    super({ cwd, agentDir: getAgentDir() });
    this.config = config;
  }

  override getSystemPrompt(): string {
    const subagentBlock = [
      "You're a following subagent:",
      `<current-subagent name="${escapeXmlAttr(this.config.name)}" description="${escapeXmlAttr(this.config.description.replaceAll("\n", " "))}">`,
      escapeXmlContent(this.config.template.instructions.trim()),
      "</current-subagent>",
    ].join("\n");

    const parent = super.getSystemPrompt();
    return parent ? `${parent}\n\n${subagentBlock}` : subagentBlock;
  }
}
