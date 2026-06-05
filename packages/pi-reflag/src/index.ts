import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { rewriteCommand } from "./shell.js";

export default function piReflag(pi: ExtensionAPI): void {
  pi.registerFlag("pi-reflag-grep", {
    type: "string",
    description: "grep → rg rewriting: on (default) or off",
  });

  pi.registerFlag("pi-reflag-find", {
    type: "string",
    description: "find → fd rewriting: on (default) or off",
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) {
      return undefined;
    }

    const rewriteGrep = pi.getFlag("pi-reflag-grep") !== "off";
    const rewriteFind = pi.getFlag("pi-reflag-find") !== "off";
    if (!rewriteGrep && !rewriteFind) {
      return undefined;
    }

    const original = event.input.command;
    const { rewritten, changed } = rewriteCommand(original, { rewriteGrep, rewriteFind });
    if (!changed) {
      return undefined;
    }

    event.input.command = rewritten;
    ctx.ui.notify(`pi-reflag: \`${original}\` → \`${rewritten}\``, "info");
    return undefined;
  });
}
