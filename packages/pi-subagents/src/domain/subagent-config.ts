import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { SubagentTemplate } from "./subagent-template.js";

export interface SubagentConfig {
  readonly name: string;
  readonly template: SubagentTemplate;
  readonly model: string | undefined;
  readonly thinkingLevel: ThinkingLevel;
  readonly maxTurns?: number;
  readonly graceTurns: number;
  readonly includedTools: string[];
  readonly includedSubagents: string[];
}
