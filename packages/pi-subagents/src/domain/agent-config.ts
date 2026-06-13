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

    const enabledTools = new Set(activeTools);
    for (const excludedTool of [...SUBAGENT_EXCLUDED_TOOLS, ...template.excludedTools]) {
      enabledTools.delete(excludedTool);
    }
    this.enabledTools = Array.from(enabledTools);
  }
}
