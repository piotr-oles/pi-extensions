import {
  type ExtensionAPI,
  isToolCallEventType,
} from "@earendil-works/pi-coding-agent";

const PROMPT_INSTRUCTIONS =
  "Every tool, including bash, read, write, edit, runs in respect to cwd. Use relative paths in tool calls.";

export default function piCwd(pi: ExtensionAPI) {
  pi.registerFlag("pi-cwd", {
    type: "boolean",
    default: true,
    description: "Enable reminders to use relative paths based on current working directory",
  });

  pi.on("before_agent_start", (event) => {
    if (!pi.getFlag("pi-cwd")) {
      return undefined;
    }
    return { systemPrompt: `${event.systemPrompt}\n\n${PROMPT_INSTRUCTIONS}` };
  });

  const absoluteToolCalls = new Set<string>();

  pi.on("tool_call", (event, ctx) => {
    if (!pi.getFlag("pi-cwd")) {
      return undefined;
    }

    const hasAbsCwdPath =
      ((isToolCallEventType("read", event) ||
        isToolCallEventType("write", event) ||
        isToolCallEventType("edit", event)) &&
        event.input.path.startsWith(ctx.cwd)) ||
      (isToolCallEventType("bash", event) && event.input.command.includes(ctx.cwd));

    if (hasAbsCwdPath) {
      absoluteToolCalls.add(event.toolCallId);
    }
  });

  pi.on("tool_result", (event, ctx) => {
    if (absoluteToolCalls.has(event.toolCallId)) {
      absoluteToolCalls.delete(event.toolCallId);

      return {
        content: [
          ...(event.content ?? []),
          { type: "text", text: `Tip: Use relative paths in tool calls. Current cwd: ${ctx.cwd}` },
        ],
      };
    }
  });
}
