import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function piBell(pi: ExtensionAPI): void {
  pi.on("agent_end", (_event, ctx) => {
    if (ctx.hasUI) {
      process.stdout.write("\x07");
    }
  });
}
