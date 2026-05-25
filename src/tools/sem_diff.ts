import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { semDiff, SemError } from "../sem.js";

export function registerSemDiff(pi: ExtensionAPI) {
  pi.registerTool({
    name: "sem_diff",
    label: "Sem Diff",
    description:
      "Show a semantic diff of code changes — grouped by entity (function, class, method) rather than raw line diffs. " +
      "Supports the same ref syntax as git diff: omit args for working tree, use 'staged' for index, " +
      "or pass from/to for commit ranges.",
    promptSnippet: "Show semantic diff of code changes grouped by entity",
    promptGuidelines: [
      "Use sem_diff instead of bash+git-diff when you want to understand what changed semantically, not just line-by-line.",
      "Use sem_diff with staged:true to review what's about to be committed.",
      "Use sem_diff with from/to to compare branches or commit ranges (e.g. from:'main', to:'HEAD').",
    ],
    parameters: Type.Object({
      from: Type.Optional(Type.String({
        description: "Start git ref (commit, branch, tag). Omit for working tree diff.",
      })),
      to: Type.Optional(Type.String({
        description: "End git ref. Omit to use HEAD.",
      })),
      staged: Type.Optional(Type.Boolean({
        description: "Show only staged changes (equivalent to git diff --staged)",
      })),
    }),

    async execute(_id, params, signal) {
      const { from, to, staged } = params;
      try {
        const markdown = await semDiff(
          pi.exec.bind(pi),
          { from, to, staged, format: "markdown" },
          signal,
        );
        const text = markdown.trim() || "No semantic changes found.";
        return {
          content: [{ type: "text", text }],
          details: { from, to, staged: staged ?? false },
        };
      } catch (err) {
        const msg = err instanceof SemError
          ? `sem_diff failed: ${err.message}`
          : `sem_diff error: ${String(err)}`;
        return { content: [{ type: "text", text: msg }], details: { error: true } as any };
      }
    },
  });
}
