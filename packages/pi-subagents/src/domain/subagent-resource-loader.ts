import {
  DefaultResourceLoader,
  getAgentDir,
  type PromptTemplate,
  type ResourceDiagnostic,
} from "@earendil-works/pi-coding-agent";
import { escapeXmlContent } from "../xml.js";
import type { SubagentConfig } from "./subagent-config.js";

export class SubagentResourceLoader extends DefaultResourceLoader {
  constructor(
    cwd: string,
    private readonly config: SubagentConfig,
  ) {
    super({
      cwd,
      agentDir: getAgentDir(),
    });
  }

  override getSkills() {
    const { skills, diagnostics } = super.getSkills();
    if (this.config.template.includedSkills) {
      const includedSkill = new Set(
        this.config.template.includedSkills.map((s) => s.toLowerCase()),
      );
      const filteredSkills = skills.filter((skill) => includedSkill.has(skill.name.toLowerCase()));
      return { skills: filteredSkills, diagnostics };
    }
    return { skills, diagnostics };
  }

  override getPrompts(): {
    prompts: PromptTemplate[];
    diagnostics: ResourceDiagnostic[];
  } {
    return {
      prompts: [],
      diagnostics: [],
    };
  }

  override getAppendSystemPrompt(): string[] {
    const subagentSystemPropmt = [
      `You're subagent "${this.config.name}":`,
      `<subagent_instructions>`,
      escapeXmlContent(this.config.template.instructions.trim()),
      "</subagent_instructions>",
    ].join("\n");

    return [...super.getAppendSystemPrompt(), subagentSystemPropmt];
  }
}
