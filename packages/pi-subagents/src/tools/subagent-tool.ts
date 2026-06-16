import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type Component } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { AgentInstancesManager } from "../domain/agent-instances-manager.js";
import type { AgentTemplatesManager } from "../domain/agent-templates-manager.js";
import type { AgentInstance } from "../domain/instance/index.js";
import type { AgentInstanceSessionEntry } from "../domain/types.js";
import { AgentsWidget } from "../ui/agents-widget.js";
import { throttle } from "../throttle.js";
import { SubagentToolParams } from "./types.js";
import { SubagentToolCallComponent } from "./components/subagent-tool-call-component.js";
import { SubagentToolResultComponent } from "./components/subagent-tool-result-component.js";

export interface SubagentToolDeps {
  pi: ExtensionAPI;
  instanceManager: AgentInstancesManager;
  templatesManager: AgentTemplatesManager;
}

export function createSubagentTool(deps: SubagentToolDeps) {
  const { pi, instanceManager, templatesManager } = deps;
  const widget = new AgentsWidget(() => instanceManager.listInstances());

  return defineTool<typeof SubagentToolParams, AgentInstanceSessionEntry>({
    name: "subagent",
    label: "Subagent",
    description: `Spawn a specialized subagent to handle a task autonomously.`,
    promptSnippet:
      "Spawn a specialized subagent to handle a task autonomously in an isolated session",
    promptGuidelines: [
      "Use subagent to delegate self-contained tasks that don't require back-and-forth.",
    ],
    parameters: Type.Object({
      name: Type.String({
        description: `Name of subagent to spawn.`,
      }),
      description: Type.String({
        description: "Short description of the task (shown in UI).",
      }),
      prompt: Type.String({
        description:
          "Task prompt for subagent. Should contain all information needed for subagent to work independetly.",
      }),
    }),
    executionMode: "parallel",
    execute: async (_toolCallId, params, signal, onUpdate, ctx) => {
      const template = templatesManager.getTemplateOrDefault(params.name);
      const availableTools = pi.getActiveTools();

      let last: AgentInstance | undefined;
      const lifetime = instanceManager.spawn(ctx, template, {
        prompt: params.prompt,
        description: params.description,
        availableTools: availableTools,
        signal,
      });

      const onUpdateThrottled = onUpdate ? throttle(onUpdate, 100) : undefined;

      // ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg("dim", "●")] });
      // ctx.ui.setWorkingMessage("Waiting for subagents");

      // (async () => {

      for await (const instance of lifetime) {
        last = instance;
        onUpdateThrottled?.({ content: [], details: instance.toEntry() });

      }


      // })();

      // const running = instanceManager.listInstances("running");
      // if (running.length === 0) {
      //   ctx.ui.setWorkingIndicator();
      //   ctx.ui.setWorkingMessage();
      // }

      if (!last) {
        // TODO improve this case
        throw new Error("Unknown error during subagent spawn.");
      }
      if (last.status !== "done") {
        // TODO improve this case
        throw new Error("Unexpected status of subagent.");
      }

      return {
        content: [
          {
            type: "text",
            text: [
              `Subagent "${last.config.name}" with id "${last.id}" ${last.reason === "completed" ? "finished" : last.reason === "stopped" ? "was cancelled" : "errored"}.`,
              last.reason === "completed"
                ? last.result
                  ? `Result:\n${last.result}`
                  : "No results."
                : last.error
                  ? `Error: ${last.error}`
                  : "No output",
            ].join("\n"),
          },
        ],
        details: last.toEntry(),
      };
    },
    /** Custom rendering for tool call display */
    renderCall(params, theme, context): Component {
      if (!(context.lastComponent instanceof SubagentToolCallComponent)) {
        return new SubagentToolCallComponent(params, theme, context.expanded);
      }
      context.lastComponent.update(params, theme, context.expanded);
      return context.lastComponent;
    },
    /** Custom rendering for tool result display */
    renderResult(result, options, theme, context): Component {
      if (!(context.lastComponent instanceof SubagentToolResultComponent)) {
        return new SubagentToolResultComponent(
          result.details,
          theme,
          context.expanded,
          context.invalidate,
        );
      }
      context.lastComponent.update(result.details, theme, context.expanded, context.invalidate);
      return context.lastComponent;
    },
  });
}
