import { StringEnum } from "@earendil-works/pi-ai";
import type { AgentToolResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { formatImpact } from "../format.js";
import { SemError, semImpact } from "../sem.js";

export function registerSemImpact(pi: ExtensionAPI) {
  pi.registerTool({
    name: "sem_impact",
    label: "Sem Impact",
    description:
      "Impact of changing code entity: direct deps, dependents, transitive blast radius, affected tests. " +
      "Use before modifying to understand what breaks.",
    promptSnippet: "Analyze dependencies and blast radius for code entity",
    promptGuidelines: [
      "Use before modifying to see what callers depend on it.",
      "mode='deps' — see what entity depends on before refactoring.",
      "mode='tests' — find tests covering entity.",
      "Increase depth past 2 for large refactors with transitive impact.",
    ],
    parameters: Type.Object({
      entity: Type.String({
        description: "Entity name (e.g. 'AuthService', 'parseConfig')",
      }),
      file: Type.Optional(
        Type.String({
          description: "File path to disambiguate same-name entities",
        }),
      ),
      entity_id: Type.Optional(
        Type.String({
          description: "Exact entity ID from sem_entities — avoids ambiguity",
        }),
      ),
      mode: Type.Optional(
        StringEnum(["all", "deps", "dependents", "tests"] as const, {
          description: "'all' (default) | 'deps' | 'dependents' (callers) | 'tests'",
        }),
      ),
      depth: Type.Optional(
        Type.Number({
          description: "Max traversal depth (default: 2, 0 = unlimited)",
        }),
      ),
    }),

    async execute(_id, params, signal): Promise<AgentToolResult<Record<string, unknown>>> {
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
        const msg =
          err instanceof SemError
            ? `sem_impact failed: ${err.message}`
            : `sem_impact error: ${String(err)}`;
        return { content: [{ type: "text", text: msg }], details: { error: true } };
      }
    },
  });
}
