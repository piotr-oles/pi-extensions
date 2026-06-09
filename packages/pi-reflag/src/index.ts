import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { rewriteBash } from "./shell.js";

export default function piReflag(pi: ExtensionAPI): void {
  pi.registerFlag("pi-reflag-verbose", {
    type: "boolean",
    description: "Render how command was reflagged in the ui.",
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) {
      return undefined;
    }

    const original = event.input.command;
    const rewritten = await rewriteBash(original);

    if (rewritten === original) {
      return undefined;
    }

    event.input.command = rewritten;
    if (isVerbose(pi)) {
      ctx.ui.notify(
        `pi-reflag:\n${ctx.ui.theme.fg("mdCode", original)}\n${ctx.ui.theme.fg("mdCode", rewritten)}`,
        "info",
      );
    }
  });
}

function isVerbose(pi: ExtensionAPI) {
  return pi.getFlag("pi-reflag-verbose") || process.env.PI_REFLAG_VERBOSE === "true";
}
