import type { ThinkingLevel } from "@earendil-works/pi-agent-core";

export type AgentSource = "project" | "global";

export interface AgentTemplateParams {
  readonly name: string;
  readonly description?: string;
  readonly instructions: string;
  readonly excludedTools?: string[];
  readonly model?: string;
  readonly thinkingLevel?: ThinkingLevel;
  readonly maxTurns?: number;
  readonly graceTurns?: number;
  readonly enabled?: boolean;
  readonly source: AgentSource;
}

export class AgentTemplate {
  readonly name: string;
  readonly description: string;
  readonly excludedTools: string[];
  readonly model?: string;
  readonly thinkingLevel?: ThinkingLevel;
  readonly maxTurns?: number;
  readonly graceTurns?: number;
  readonly instructions: string;
  readonly enabled: boolean;
  readonly source: AgentSource;

  constructor(params: AgentTemplateParams) {
    this.name = params.name;
    this.description = params.description ?? "";
    this.excludedTools = params.excludedTools ?? [];
    this.model = params.model;
    this.thinkingLevel = params.thinkingLevel;
    this.maxTurns = params.maxTurns;
    this.graceTurns = params.graceTurns;
    this.instructions = params.instructions;
    this.enabled = params.enabled ?? true;
    this.source = params.source;
  }

  private static readonly RELEVANCE: Record<AgentSource, [disabled: number, enabled: number]> = {
    global: [0, 2],
    project: [1, 3],
  };

  getRelevanceScore(): number {
    return AgentTemplate.RELEVANCE[this.source][this.enabled ? 1 : 0];
  }
}
