import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { getMode } from "./mode.js";

export default function piCwd(pi: ExtensionAPI) {
  pi.registerFlag("pi-cwd-mode", {
    type: "string",
    description: "How to handle absolute cwd paths: warn (default) or block",
  });

  pi.on("before_agent_start", (event) => {
    return {
      systemPrompt: [
        event.systemPrompt,
        "",
        "",
        "Every tool call (inlcuding bash, read, write, edit) runs from the initial cwd. A `cd` in one bash call does NOT persist to the next call — each starts fresh from the initial cwd. Do not repeat `cd`. Use relative paths.",
      ].join("\n"),
    };
  });

  const toolCallIdsWithAbsCwd = new Set<string>();

  pi.on("tool_call", (event, ctx) => {
    const hasAbsCwd =
      ((isToolCallEventType("read", event) ||
        isToolCallEventType("write", event) ||
        isToolCallEventType("edit", event)) &&
        event.input.path.startsWith(ctx.cwd)) ||
      (isToolCallEventType("bash", event) && event.input.command.includes(ctx.cwd));

    if (!hasAbsCwd) {
      return undefined;
    }

    const mode = getMode(pi);

    if (mode === "block") {
      return {
        block: true,
        reason: "Tool call blocked — absolute cwd path detected. Use relative paths in tool calls.",
      };
    }

    toolCallIdsWithAbsCwd.add(event.toolCallId);
    return undefined;
  });

  pi.on("tool_result", (event, ctx) => {
    if (toolCallIdsWithAbsCwd.has(event.toolCallId)) {
      toolCallIdsWithAbsCwd.delete(event.toolCallId);

      return {
        content: [
          ...(event.content ?? []),
          {
            type: "text",
            text: `Absolute cwd path detected — use relative paths. Each tool call starts from the initial cwd (${ctx.cwd}); a \`cd\` does not persist across calls, so don't repeat it.`,
          },
        ],
      };
    }
  });
}
