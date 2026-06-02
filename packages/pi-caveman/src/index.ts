/**
 * Pi Caveman Extension
 *
 * Inspired by https://github.com/JuliusBrussee/caveman
 * Makes the agent speak like a caveman — cutting ~75% of output tokens
 * while keeping full technical accuracy.
 *
 * Usage:
 * - `/caveman`       — toggle caveman mode on/off
 * - `/caveman lite`  — drop filler, keep grammar (professional)
 * - `/caveman full`  — default caveman mode (drop articles, fragments ok)
 * - `/caveman ultra` — maximum compression, telegraphic
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type CavemanLevel = "off" | "lite" | "full" | "ultra";

const ACTIVE_LEVELS = ["lite", "full", "ultra"] as const;
type ActiveLevel = (typeof ACTIVE_LEVELS)[number];

const instructionsDir = path.join(import.meta.dirname, "..", "instructions");

const instructions: Record<ActiveLevel, string> = Object.fromEntries(
  ACTIVE_LEVELS.map((level) => [
    level,
    fs.readFileSync(path.join(instructionsDir, `${level}.md`), "utf-8"),
  ]),
) as Record<ActiveLevel, string>;

function isActiveLevel(value: string): value is ActiveLevel {
  return (ACTIVE_LEVELS as readonly string[]).includes(value);
}

function formatNotification(level: CavemanLevel): string {
  switch (level) {
    case "off":
      return "Caveman go away.";
    case "lite":
      return "Caveman Lite active. Drop filler, keep grammar.";
    case "full":
      return "Caveman mode active. Drop articles, fragments ok.";
    case "ultra":
      return "Caveman Ultra active. Maximum compression.";
  }
}

export default function piCaveman(pi: ExtensionAPI) {
  let currentLevel: CavemanLevel = "full";

  pi.registerCommand("caveman", {
    description: "Toggle caveman mode — speak like caveman, fewer tokens",
    getArgumentCompletions: (prefix) => {
      const levels: CavemanLevel[] = ["lite", "full", "ultra", "off"];
      return levels.map((l) => ({ value: l, label: l })).filter((i) => i.value.startsWith(prefix));
    },
    handler: async (args, ctx) => {
      const arg =
        args
          ?.trim()
          .toLowerCase()
          .split(/\s+/)[0]
          .replace(/[^a-z]/g, "") ?? "";

      if (!arg) {
        currentLevel = currentLevel === "off" ? "full" : "off";
      } else if (arg === "off") {
        currentLevel = "off";
      } else if (isActiveLevel(arg)) {
        currentLevel = arg;
      } else {
        ctx.ui.notify(`Unknown level: ${args}. Use lite, full, ultra, or off.`, "error");
        return;
      }

      ctx.ui.notify(formatNotification(currentLevel), "info");
    },
  });

  pi.on("before_agent_start", async (event) => {
    if (currentLevel === "off") {
      return undefined;
    }

    return {
      systemPrompt: `${event.systemPrompt}\n\n${instructions[currentLevel]}`,
    };
  });

  pi.on("session_start", async () => {
    currentLevel = "full";
  });

  pi.on("input", async (event, ctx) => {
    const text = event.text.toLowerCase();

    const stopTriggers = ["stop caveman", "normal mode"];
    for (const stop of stopTriggers) {
      if (text.includes(stop)) {
        currentLevel = "off";
        ctx.ui.notify(formatNotification("off"), "info");
        return;
      }
    }

    const activeTriggers = [
      "caveman mode",
      "talk like caveman",
      "use caveman",
      "less tokens",
      "be brief",
      "fewer tokens",
    ];
    for (const trigger of activeTriggers) {
      if (text.includes(trigger)) {
        currentLevel = text.includes("lite") ? "lite" : text.includes("ultra") ? "ultra" : "full";
        ctx.ui.notify(formatNotification(currentLevel), "info");
        return;
      }
    }
  });
}
