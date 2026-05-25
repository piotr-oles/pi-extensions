import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { semEntities, SemError } from "../sem.js";
import { formatEntities } from "../format.js";

export function registerSemEntities(pi: ExtensionAPI) {
  pi.registerTool({
    name: "sem_entities",
    label: "Sem Entities",
    description:
      "List all code entities (functions, classes, methods, variables) in a file or directory. " +
      "Returns a compact tree of symbols with type and line range. " +
      "Much cheaper than reading files when you need to discover what exists.",
    promptSnippet: "List code symbols in a file or directory",
    promptGuidelines: [
      "Use sem_entities instead of read when you want to know what functions, classes, or types are defined in a file.",
      "Use sem_entities on a directory to get an overview of all symbols across multiple files.",
      "Use the entity_id values from sem_entities output as input to sem_context or sem_impact for precise lookups.",
    ],
    parameters: Type.Object({
      path: Type.Optional(Type.String({
        description: "File or directory path to list entities from (defaults to current directory)",
      })),
    }),

    async execute(_id, params, signal, _onUpdate, ctx) {
      const path = params.path ?? ctx.cwd;
      try {
        const entities = await semEntities(pi.exec.bind(pi), path, signal);
        const text = entities.length === 0
          ? `No entities found in: ${path}`
          : `Entities in: ${path}\n\n${formatEntities(entities)}`;
        return {
          content: [{ type: "text", text }],
          details: { path, count: entities.length },
        };
      } catch (err) {
        const msg = err instanceof SemError
          ? `sem_entities failed: ${err.message}`
          : `sem_entities error: ${String(err)}`;
        return { content: [{ type: "text", text: msg }], details: { error: true } };
      }
    },
  });
}
