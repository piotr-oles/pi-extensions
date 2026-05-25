import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { SemError, semEntities } from "../sem.js";

export function registerSemEntities(pi: ExtensionAPI) {
  pi.registerTool({
    name: "sem_entities",
    label: "Sem Entities",
    description:
      "List code entities (functions, classes, methods, variables) in file or directory. " +
      "Compact tree with type and line range. " +
      "Cheaper than reading files to discover what exists.",
    promptSnippet: "List code symbols in file or directory",
    promptGuidelines: [
      "Use sem_entities instead of find or rg to discover defined functions, classes, and types.",
      "Use sem_entities on a directory for an overview of all symbols across files.",
      "Pass entity_id values to sem_context or sem_impact for precise lookups.",
    ],
    parameters: Type.Object({
      path: Type.Optional(
        Type.String({
          description: "File or directory path (defaults to cwd)",
        }),
      ),
    }),

    async execute(_id, params, signal, _onUpdate, ctx) {
      const path = params.path ?? ctx.cwd;
      try {
        const text = await semEntities(pi.exec.bind(pi), path, signal);
        return {
          content: [{ type: "text", text: text || `No entities found in: ${path}` }],
          details: { path },
        };
      } catch (err) {
        const msg =
          err instanceof SemError
            ? `sem_entities failed: ${err.message}`
            : `sem_entities error: ${String(err)}`;
        return { content: [{ type: "text", text: msg }], details: { error: true } };
      }
    },
  });
}
