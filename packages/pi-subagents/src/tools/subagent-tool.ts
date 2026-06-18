import type { TextContent } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import type { DoneSubagent } from "../domain/instance/done-subagent.js";
import type { SubagentInstancesManager } from "../domain/subagent-instances-manager.js";
import type { SubagentTemplatesManager } from "../domain/subagent-templates-manager.js";
import type { SubagentSessionEntry } from "../domain/types.js";
import { throttle } from "../throttle.js";
import { SubagentToolCallComponent } from "./components/subagent-tool-call-component.js";
import { SubagentToolResultComponent } from "./components/subagent-tool-result-component.js";
import { SubagentToolParams } from "./types.js";

export interface SubagentToolDeps {
  pi: ExtensionAPI;
  instanceManager: SubagentInstancesManager;
  templatesManager: SubagentTemplatesManager;
}

export function createSubagentTool(deps: SubagentToolDeps) {
  const { pi, instanceManager, templatesManager } = deps;

  return defineTool<typeof SubagentToolParams, SubagentSessionEntry>({
    name: "subagent",
    label: "Subagent",
    description: `Spawn a specialized subagent to handle a task autonomously.`,
    promptGuidelines: [
      "Use subagent tool to delegate self-contained tasks that don't require back-and-forth.",
      "If asked to spawn multiple subagents, spawn all of them in the same turn, as they will block next turn until done.",
      "You can follow-up on subagent that finished by calling subagent tool again, but this time with returned id and follow-up prompt.",
    ],
    parameters: SubagentToolParams,
    executionMode: "parallel",
    execute: async (toolCallId, params, signal, onUpdate, ctx) => {
      const availableTools = pi.getActiveTools();
      const resolvedId = params.id ?? instanceManager.id(toolCallId);
      const onUpdateThrottled = onUpdate ? throttle(onUpdate, 500) : undefined;

      let promise: Promise<DoneSubagent>;

      if (params.id) {
        promise = instanceManager.followUp({
          id: resolvedId,
          prompt: params.prompt,
          description: params.description,
          signal,
          onUpdate: (instance) => {
            onUpdateThrottled?.({ content: [], details: instance.toEntry() });
          },
        });
      } else {
        promise = instanceManager.spawn({
          id: resolvedId,
          ctx,
          template: templatesManager.getTemplateOrDefault(params.name),
          prompt: params.prompt,
          description: params.description,
          availableTools,
          signal,
          onUpdate: (instance) => {
            onUpdateThrottled?.({ content: [], details: instance.toEntry() });
          },
        });
      }

      ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg("dim", "●")] });
      ctx.ui.setWorkingMessage("Waiting for subagents");

      const done = await promise;

      if (!instanceManager.isRunning()) {
        ctx.ui.setWorkingIndicator();
        ctx.ui.setWorkingMessage();
      }

      return {
        content: buildSubagentResponse(done),
        details: done.toEntry(),
      };
    },
    /** Custom rendering for tool call display */
    renderCall(params, theme, context): Component {
      const resolvedParams = params.id
        ? params
        : { ...params, id: instanceManager.id(context.toolCallId) };
      if (!(context.lastComponent instanceof SubagentToolCallComponent)) {
        return new SubagentToolCallComponent(resolvedParams, theme, context.expanded);
      }
      context.lastComponent.update(resolvedParams, theme, context.expanded);
      return context.lastComponent;
    },
    /** Custom rendering for tool result display */
    renderResult(result, _options, theme, context): Component {
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

function buildSubagentResponse(done: DoneSubagent): TextContent[] {
  const subagent = `Subagent "${done.config.name}" with id ${done.id}`;

  switch (done.result.status) {
    case "completed":
      return [
        {
          type: "text",
          text: done.result.steered
            ? `${subagent} completed but had to finish earlier due to imposed limits. Its results might be partial.`
            : `${subagent} completed.`,
        },
        {
          type: "text",
          text: done.result.message || "No result.",
        },
      ];
    case "aborted":
      return [
        {
          type: "text",
          text: `${subagent} cancelled by the user.`,
        },
      ];
    case "error":
      return [
        {
          type: "text",
          text: [`${subagent} failed.`, `Error: ${done.result.error || "unknown"}`].join("\n"),
        },
      ];
    case "exceeded_limit": {
      switch (done.result.limit.type) {
        case "turns":
          return [
            {
              type: "text",
              text: [
                `${subagent} exceeded turns limit and didn't respond after asking to wrap up.`,
              ].join("\n"),
            },
          ];
      }
    }
  }
}
