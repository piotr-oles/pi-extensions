import type { AgentTemplate, ThinkingLevel } from "./types.js";

const DEFAULT_THINKING_LEVEL: ThinkingLevel = "medium";
const SUBAGENT_EXCLUDED_TOOLS = new Set<string>(["subagent", "subagent_check", "subagent_steer"]);

export interface AgentConfigOverrides {
  thinkingLevel?: ThinkingLevel;
  maxTurns?: number;
  graceTurns?: number;
}

export interface AgentConfigParams {
  template: AgentTemplate;
  overrides?: AgentConfigOverrides;
  model: string | undefined;
  description: string;
  prompt: string;
  availableTools: string[];
}

export interface AgentConfigSessionEntry {
  readonly name: string;
  readonly model: string | undefined;
  readonly thinkingLevel: ThinkingLevel;
  readonly maxTurns?: number;
  readonly graceTurns?: number;
  readonly description: string;
  readonly prompt: string;
  readonly enabledTools: string[];
}

export class AgentConfig {
  readonly name: string;
  readonly template: AgentTemplate;
  readonly model: string | undefined;
  readonly thinkingLevel: ThinkingLevel;
  readonly maxTurns?: number;
  readonly graceTurns: number;
  readonly description: string;
  readonly prompt: string;
  readonly enabledTools: string[];

  constructor({
    template,
    overrides = {},
    model,
    description,
    prompt,
    availableTools: activeTools,
  }: AgentConfigParams) {
    this.template = template;
    this.name = template.name;
    this.model = model;
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

  toEntry(): AgentConfigSessionEntry {
    return {
      name: this.name,
      model: this.model,
      thinkingLevel: this.thinkingLevel,
      maxTurns: this.maxTurns,
      graceTurns: this.graceTurns,
      description: this.description,
      prompt: this.prompt,
      enabledTools: this.enabledTools,
    };
  }
}
