import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { getIgnoreMode } from "./ignore-mode.js";
import { rewriteBash } from "./shell.js";

export default function piReflag(pi: ExtensionAPI): void {
  pi.registerFlag("pi-reflag-verbose", {
    type: "boolean",
    description: "Render how command was reflagged in the ui.",
  });

  pi.registerFlag("pi-reflag-timeout", {
    type: "string",
    description: "Timeout in seconds for untranslatable find/grep commands. Set to '0' to disable timeout.",
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
    const { rewritten, untranslatable } = await rewriteBash(original, getIgnoreMode(pi));

    // For untranslatable find/grep commands, wrap with timeout and suggest fd/rg
    if (untranslatable.length > 0) {
      for (const cmd of untranslatable) {
        ctx.ui.notify(
          `pi-reflag: '${cmd.name}' has unsupported flags and will run with 1s timeout.\nConsider using 'fd' or 'rg' directly for better performance.`,
          "warning",
        );
      }
      // Wrap untranslatable commands with timeout
      const wrapped = original.replace(
        /^(find|grep)\b/,
        `timeout ${getTimeout(pi)} $1`
      );
      event.input.command = wrapped;
      return undefined;
    }

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

function getTimeout(pi: ExtensionAPI): number {
  const val = pi.getFlag("pi-reflag-timeout");
  return val ? Number(val) : 1;
}

function isVerbose(pi: ExtensionAPI) {
  return pi.getFlag("pi-reflag-verbose");
}
