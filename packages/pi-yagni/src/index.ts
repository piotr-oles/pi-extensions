import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const instructions = fs.readFileSync(
  path.join(import.meta.dirname, "..", "instructions", "yagni.md"),
  "utf-8",
);

export default function piYagni(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify(`YAGNI: ${ctx.ui.theme.bold("on")}`, "info");
  });

  pi.on("before_agent_start", async (event) => {
    return {
      systemPrompt: `${event.systemPrompt}\n\n${instructions}`,
    };
  });
}
