import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { rewriteBash } from "./shell.js";

export default function piReflag(pi: ExtensionAPI): void {
  pi.registerFlag("pi-reflag-verbose", {
    type: "boolean",
    description: "Render how command was reflagged in the ui.",
  });

  pi.registerFlag("pi-reflag-no-ignore", {
    type: "boolean",
    description: "Pass --no-ignore to fd when translating find commands.",
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) {
      return undefined;
    }

    const original = event.input.command;
    const rewritten = await rewriteBash(original, !!pi.getFlag("pi-reflag-no-ignore"));

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
  return pi.getFlag("pi-reflag-verbose");
}
