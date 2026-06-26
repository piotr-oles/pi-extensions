import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { getIgnoreMode } from "./ignore-mode.js";
import { rewriteBash } from "./shell.js";

export default function piReflag(pi: ExtensionAPI): void {
  pi.registerFlag("pi-reflag-verbose", {
    type: "boolean",
    description: "Render how command was reflagged in the ui.",
  });

  pi.registerFlag("pi-reflag-ignore-mode", {
    type: "string",
    description:
      "Controls --no-ignore for fd when translating find commands. 'auto' adds --no-ignore when searching inside known ignored dirs (node_modules, .venv, etc). 'no-ignore' always adds it. 'ignore' never adds it.",
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) {
      return undefined;
    }

    const original = event.input.command;
    const rewritten = await rewriteBash(original, getIgnoreMode(pi));

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
