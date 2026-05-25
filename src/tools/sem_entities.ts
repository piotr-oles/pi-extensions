import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { formatEntities } from "../format.js";
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
      "Use instead of read to discover defined functions, classes, types.",
      "Use on directory for overview of all symbols across files.",
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
        const entities = await semEntities(pi.exec.bind(pi), path, signal);
        const text =
          entities.length === 0
            ? `No entities found in: ${path}`
            : `Entities in: ${path}\n\n${formatEntities(entities)}`;
        return {
          content: [{ type: "text", text }],
          details: { path, count: entities.length },
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
