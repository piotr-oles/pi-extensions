import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getSelection, loadSection, SECTIONS, type Selection } from "./sections.js";

function compose(selection: Selection): string {
  if (selection.off) {
    return "";
  }
  return selection.names
    .map((name) => loadSection(name))
    .filter((text): text is string => Boolean(text))
    .join("\n\n");
}

export default function piSteer(pi: ExtensionAPI) {
  pi.registerFlag("pi-steer", {
    type: "string",
    description:
      "Steer model behavior by composing instruction sections into the system prompt (comma-separated list of section names). Default: all. Set to off to disable.",
  });

  pi.on("session_start", async (_event, ctx) => {
    const selection = getSelection(pi);
    const label = selection.off ? "off" : selection.names.join(", ") || "none";
    ctx.ui.notify(`pi-steer: ${ctx.ui.theme.bold(label)}`, "info");
  });

  pi.on("before_agent_start", async (event) => {
    const text = compose(getSelection(pi));
    if (!text) {
      return undefined;
    }
    return {
      systemPrompt: `${event.systemPrompt}\n\n${text}`,
    };
  });
}

export { SECTIONS };
