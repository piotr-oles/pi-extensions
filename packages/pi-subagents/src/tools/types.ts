
import { type Static, Type } from "typebox";

export const SubagentToolParams = Type.Object({
  name: Type.String({
    description: `Name of subagent to spawn.`,
  }),
  description: Type.String({
    description: "Short description of the task (shown in UI).",
  }),
  prompt: Type.String({
    description: "Task prompt for subagent.",
  }),
});
export type SubagentToolParamsType = Static<typeof SubagentToolParams>;
