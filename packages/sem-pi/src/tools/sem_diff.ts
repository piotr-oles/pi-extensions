import type { AgentToolResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { SemError, semDiff } from "../sem.js";

export function registerSemDiff(pi: ExtensionAPI) {
  pi.registerTool({
    name: "sem_diff",
    label: "Sem Diff",
    description:
      "Semantic diff grouped by entity (function, class, method), not raw lines. " +
      "Same ref syntax as git diff: omit for working tree, staged=true for index, from/to for commit ranges.",
    promptSnippet: "Semantic diff grouped by entity",
    promptGuidelines: [
      "Use instead of bash+git-diff to understand semantic changes, not just line diffs.",
      "staged:true to review staged changes.",
      "from/to for branch or commit range comparison.",
    ],
    parameters: Type.Object({
      from: Type.Optional(
        Type.String({
          description: "Start git ref. Omit for working tree.",
        }),
      ),
      to: Type.Optional(
        Type.String({
          description: "End git ref. Omit to use HEAD.",
        }),
      ),
      staged: Type.Optional(
        Type.Boolean({
          description: "Only staged changes (git diff --staged)",
        }),
      ),
    }),

    async execute(_id, params, signal): Promise<AgentToolResult<Record<string, unknown>>> {
      const { from, to, staged } = params;
      try {
        const markdown = await semDiff(
          pi.exec.bind(pi),
          { from, to, staged },
          signal,
        );
        const text = markdown.trim() || "No semantic changes found.";
        return {
          content: [{ type: "text", text }],
          details: { from, to, staged: staged ?? false },
        };
      } catch (err) {
        const msg =
          err instanceof SemError
            ? `sem_diff failed: ${err.message}`
            : `sem_diff error: ${String(err)}`;
        return { content: [{ type: "text", text: msg }], details: { error: true } };
      }
    },
  });
}
