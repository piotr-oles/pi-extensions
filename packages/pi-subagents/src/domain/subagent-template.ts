import type { ThinkingLevel } from "@earendil-works/pi-agent-core";

export type SubagentSource = "project" | "global";

export interface SubagentTemplate {
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly includedTools: string[] | undefined;
  readonly includedSkills: string[] | undefined;
  readonly allowedSubagents?: string[];
  readonly model?: string;
  readonly thinkingLevel?: ThinkingLevel;
  readonly maxTurns?: number;
  readonly graceTurns?: number;
  readonly enabled: boolean;
  readonly source: SubagentSource;
  readonly filePath: string | undefined;
}

export const GENERAL_PURPOSE_TEMPLATE: SubagentTemplate = {
  name: "general-purpose",
  description: "General-purpose agent",
  instructions: "",
  enabled: true,
  source: "global",
  includedTools: undefined,
  includedSkills: undefined,
  filePath: undefined,
};
