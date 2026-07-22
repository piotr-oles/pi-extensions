import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";

export default function piCwd(pi: ExtensionAPI) {
  pi.on("before_agent_start", (event) => {
    return {
      systemPrompt: [
        event.systemPrompt,
        "",
        "",
        "Every tool call (including bash, read, write, edit) runs from the initial cwd. A `cd` in one bash call does NOT persist to the next call — each starts fresh from the initial cwd. Do not repeat `cd`. Use relative paths.",
      ].join("\n"),
    };
  });

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

    return {
      block: true,
      reason: "Tool call blocked — absolute cwd path detected. Use relative paths in tool calls.",
    };
  });
}
