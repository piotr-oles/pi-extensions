import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { AgentInstancesManager } from "../domain/agent-instances-manager.js";
import type { AgentTemplatesManager } from "../domain/agent-templates-manager.js";
import type { DoneAgent } from "../domain/types.js";
import { AgentWidget } from "../ui/widget.js";

export interface AgentToolDeps {
  pi: ExtensionAPI;
  manager: AgentInstancesManager;
  templatesManager: AgentTemplatesManager;
}

export function createSubagentTool(deps: AgentToolDeps) {
  const { pi, manager, templatesManager } = deps;
  const enabledNames = templatesManager.getEnabledNames();
  const widget = new AgentWidget(manager);

  return defineTool({
    name: "subagent",
    label: "Subagent",
    description: `Spawn a specialized subagent to handle a task autonomously.`,
    promptSnippet:
      "Spawn a specialized subagent to handle a task autonomously in an isolated session",
    promptGuidelines: [
      "Use agent to delegate self-contained tasks that don't require back-and-forth.",
      // "Use subagent_check to check on agents.",
    ],
    parameters: Type.Object({
      name: Type.String({
        description:
          `Name of subagent to spawn` +
          (enabledNames.length > 0 ? `, available: ${enabledNames.join(", ")}.` : "."),
      }),
      description: Type.String({
        description: "Short description of the task (shown in UI).",
      }),
      prompt: Type.String({
        description: "Task prompt for subagent.",
      }),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
      const template = templatesManager.getTemplateOrDefault(params.name);
      widget.mount(ctx.ui);

      const id = await manager.spawn(ctx, template, {
        prompt: params.prompt,
        description: params.description,
        onUpdate: () => {
          widget.requestRender();
        },
        onComplete: (instance: DoneAgent) => {
          widget.requestRender();
          const result = instance.result ?? "";
          const text = [
            `Subagent "${instance.config.name}" with id "${instance.id}" finished with ${instance.reason} reason.`,
            instance.reason === "completed" || instance.reason === "steered"
              ? instance.result
                ? `Result:\n${instance.result}`
                : "No results."
              : instance.error
                ? `Error: ${instance.error}`
                : "No output",
          ].join("\n");
          pi.sendMessage(
            {
              customType: "subagent-message",
              content: [{ type: "text", text }],
              display: true,
              details: {
                id: instance.id,
                status: instance.reason,
                durationMs: instance.duration,
                result,
              },
            },
            { triggerTurn: true, deliverAs: "followUp" },
          );
        },
      });
      const instance = manager.getInstance(id);

      if (!instance) {
        // TODO: handle this case
        throw new Error("Subagent was not spawned correctly.");
      }

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Subagent "${instance.config.name}" with id "${instance.id}".`,
              "You will be notified when this agent completes.",
              // "Use subagent_check to retrieve status/results, or subagent_steer to redirect it.",
              "Do not duplicate this agent's work.",
              `To preview session, run \`pi --session ${instance.session.sessionId}\``,
            ].join("\n"),
          },
        ],
        details: undefined,
      };
    },
  });
}
