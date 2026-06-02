import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getLevel } from "./level.js";

const instructionsDir = path.join(import.meta.dirname, "..", "instructions");

const instructions = {
  lite: fs.readFileSync(path.join(instructionsDir, "lite.md"), "utf-8"),
  full: fs.readFileSync(path.join(instructionsDir, "full.md"), "utf-8"),
  ultra: fs.readFileSync(path.join(instructionsDir, "ultra.md"), "utf-8"),
};

export default function piCaveman(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const level = getLevel(pi);
    if (level !== "off") {
      ctx.ui.notify(`Caveman mode: ${ctx.ui.theme.bold(level)}`, "info");
    }
  });

  pi.registerFlag("pi-caveman", {
    type: "string",
    description: "Caveman mode level: lite, full (default), or ultra. Set to off to disable.",
  });

  pi.on("before_agent_start", async (event) => {
    const level = getLevel(pi);
    if (level === "off") {
      return undefined;
    }
    return {
      systemPrompt: `${event.systemPrompt}\n\n${instructions[level]}`,
    };
  });
}
