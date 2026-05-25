import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { semContext, SemError } from "../sem.js";
import { formatContext } from "../format.js";

export function registerSemContext(pi: ExtensionAPI) {
  pi.registerTool({
    name: "sem_context",
    label: "Sem Context",
    description:
      "Get token-budgeted context for a named code entity (function, class, method, variable). " +
      "Returns the entity's full source plus its key dependencies, all within a token budget. " +
      "Much cheaper than reading the whole file when you only need to understand one entity.",
    promptSnippet: "Get semantic context for a code entity with token budget",
    promptGuidelines: [
      "Use sem_context instead of read when you need to understand what a function, class, or method does — not modify it.",
      "Use sem_context to inspect a dependency without reading its entire file.",
      "Pass a smaller budget (e.g. 2000) when you only need the signature, larger (8000+) for deep understanding.",
    ],
    parameters: Type.Object({
      entity: Type.String({
        description: "Name of the entity to look up (e.g. 'AuthService', 'parseConfig', 'UserController.login')",
      }),
      file: Type.Optional(Type.String({
        description: "File path to disambiguate when multiple entities share the same name",
      })),
      budget: Type.Optional(Type.Number({
        description: "Token budget for the returned context (default: 4000)",
      })),
      entity_id: Type.Optional(Type.String({
        description: "Exact entity ID from sem_entities output (e.g. 'src/auth.ts::function::login') — use to avoid ambiguity",
      })),
    }),

    async execute(_id, params, signal) {
      const { entity, file, budget = 4000, entity_id } = params;
      try {
        const result = await semContext(
          pi.exec.bind(pi),
          entity,
          { file, budget, entityId: entity_id },
          signal,
        );
        return {
          content: [{ type: "text", text: formatContext(result) }],
          details: { entity: result.entity, entityId: result.entityId, tokens: result.total_tokens, budget: result.budget },
        };
      } catch (err) {
        const msg = err instanceof SemError
          ? `sem_context failed: ${err.message}`
          : `sem_context error: ${String(err)}`;
        return { content: [{ type: "text", text: msg }], details: { error: true } as any };
      }
    },
  });
}
