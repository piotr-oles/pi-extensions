import { type Static, Type } from "typebox";

export const SubagentToolParams = Type.Object({
  name: Type.String({
    description: "Name of subagent template to spawn. Required for both spawn and follow-up.",
  }),
  id: Type.Optional(
    Type.String({
      description: "ID of a done subagent to follow-up.",
    }),
  ),
  description: Type.String({
    description: "Short description of the task (shown in UI).",
  }),
  prompt: Type.String({
    description: "Task prompt for subagent.",
  }),
});
export type SubagentToolParamsType = Static<typeof SubagentToolParams>;
