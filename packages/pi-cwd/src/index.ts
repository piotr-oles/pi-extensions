import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";

const PROMPT_INSTRUCTIONS =
  "Every tool, including bash, read, write, edit, runs in respect to cwd. Use relative paths in tool calls including bash commands.";

export default function piCwd(pi: ExtensionAPI) {
  pi.on("before_agent_start", (event) => {
    return { systemPrompt: `${event.systemPrompt}\n\n${PROMPT_INSTRUCTIONS}` };
  });

  const toolCallIdsWithAbsCwd = new Set<string>();

  pi.on("tool_call", (event, ctx) => {
    const hasAbsCwd =
      ((isToolCallEventType("read", event) ||
        isToolCallEventType("write", event) ||
        isToolCallEventType("edit", event)) &&
        event.input.path.startsWith(ctx.cwd)) ||
      (isToolCallEventType("bash", event) && event.input.command.includes(ctx.cwd));

    if (hasAbsCwd) {
      toolCallIdsWithAbsCwd.add(event.toolCallId);
    }
  });

  pi.on("tool_result", (event, ctx) => {
    if (toolCallIdsWithAbsCwd.has(event.toolCallId)) {
      toolCallIdsWithAbsCwd.delete(event.toolCallId);

      return {
        content: [
          ...(event.content ?? []),
          { type: "text", text: `Tip: Use relative paths in tool calls. Current cwd: ${ctx.cwd}` },
        ],
      };
    }
  });
}
