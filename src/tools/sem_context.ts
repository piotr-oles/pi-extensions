import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { SemError, semContext } from "../sem.js";

export function registerSemContext(pi: ExtensionAPI) {
  pi.registerTool({
    name: "sem_context",
    label: "Sem Context",
    description:
      "Token-budgeted context for named code entity (function, class, method, variable). " +
      "Returns full source + key deps within budget. " +
      "Cheaper than reading whole file when you only need one entity.",
    promptSnippet: "Semantic context for code entity with token budget",
    promptGuidelines: [
      "Use sem_context instead of read or cat to understand a code entity — use read only when editing the file.",
      "Use sem_context to inspect a dependency without reading or cat-ing the whole file.",
      "Small budget (2000) for signature only. Large (8000+) for deep understanding.",
    ],
    parameters: Type.Object({
      entity: Type.String({
        description: "Entity name (e.g. 'AuthService', 'parseConfig', 'UserController.login')",
      }),
      file: Type.Optional(
        Type.String({
          description: "File path to disambiguate same-name entities",
        }),
      ),
      budget: Type.Optional(
        Type.Number({
          description: "Token budget (default: 4000)",
        }),
      ),
      entity_id: Type.Optional(
        Type.String({
          description:
            "Exact entity ID from sem_entities (e.g. 'src/auth.ts::function::login') — avoids ambiguity",
        }),
      ),
    }),

    async execute(_id, params, signal) {
      const { entity, file, budget = 4000, entity_id } = params;
      try {
        const text = await semContext(
          pi.exec.bind(pi),
          entity,
          { file, budget, entityId: entity_id },
          signal,
        );
        return {
          content: [{ type: "text", text }],
          details: { entity, file },
        };
      } catch (err) {
        const msg =
          err instanceof SemError
            ? `sem_context failed: ${err.message}`
            : `sem_context error: ${String(err)}`;
        return { content: [{ type: "text", text: msg }], details: { error: true } };
      }
    },
  });
}
