import type { ThinkingLevel } from "@earendil-works/pi-agent-core";

export type SubagentSource = "project" | "global";

export interface SubagentTemplate {
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly includedTools: string[] | undefined;
  readonly includedSkills: string[] | undefined;
  readonly includedSubagents: string[] | undefined;
  readonly model: string | undefined;
  readonly thinkingLevel: ThinkingLevel | undefined;
  readonly maxTurns: number | undefined;
  readonly graceTurns: number | undefined;
  readonly enabled: boolean;
  readonly source: SubagentSource;
  readonly filePath: string | undefined;
}
