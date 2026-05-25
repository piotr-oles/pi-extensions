import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { semImpact, SemError } from "../sem.js";
import { formatImpact } from "../format.js";

export function registerSemImpact(pi: ExtensionAPI) {
  pi.registerTool({
    name: "sem_impact",
    label: "Sem Impact",
    description:
      "Show the impact of changing a code entity: its direct dependencies, direct dependents, " +
      "transitive blast radius, and affected tests. " +
      "Use before modifying an entity to understand what else might break.",
    promptSnippet: "Analyze dependencies and blast radius for a code entity",
    promptGuidelines: [
      "Use sem_impact before modifying a function or class to understand what callers depend on it.",
      "Use sem_impact with mode 'deps' to see what an entity depends on before refactoring it.",
      "Use sem_impact with mode 'tests' to find which tests cover an entity.",
      "Increase depth beyond the default 2 for large refactors where transitive impact matters.",
    ],
    parameters: Type.Object({
      entity: Type.String({
        description: "Name of the entity to analyze (e.g. 'AuthService', 'parseConfig')",
      }),
      file: Type.Optional(Type.String({
        description: "File path to disambiguate when multiple entities share the same name",
      })),
      entity_id: Type.Optional(Type.String({
        description: "Exact entity ID from sem_entities output — use to avoid ambiguity",
      })),
      mode: Type.Optional(StringEnum(["all", "deps", "dependents", "tests"] as const, {
        description: "What to show: 'all' (default), 'deps' (dependencies only), 'dependents' (callers only), 'tests' (affected tests only)",
      })),
      depth: Type.Optional(Type.Number({
        description: "Max traversal depth for transitive impact (default: 2, 0 = unlimited)",
      })),
    }),

    async execute(_id, params, signal) {
      const { entity, file, entity_id, mode = "all", depth } = params;
      const opts = {
        file,
        entityId: entity_id,
        deps: mode === "deps" || mode === "all",
        dependents: mode === "dependents" || mode === "all",
        tests: mode === "tests" || mode === "all",
        depth,
      };
      try {
        const result = await semImpact(pi.exec.bind(pi), entity, opts, signal);
        return {
          content: [{ type: "text", text: formatImpact(result) }],
          details: {
            entity: result.entity.name,
            entityId: result.entity.entityId,
            dependencyCount: result.dependencies.length,
            dependentCount: result.dependents.length,
            transitiveCount: result.impact.total,
            testCount: result.tests.length,
          },
        };
      } catch (err) {
        const msg = err instanceof SemError
          ? `sem_impact failed: ${err.message}`
          : `sem_impact error: ${String(err)}`;
        return { content: [{ type: "text", text: msg }], details: { error: true } as any };
      }
    },
  });
}
