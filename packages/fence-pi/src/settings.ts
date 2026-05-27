import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type FenceMode = "warn" | "block";

async function readJson(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractMode(settings: Record<string, unknown> | null): FenceMode | null {
  if (!settings) return null;
  const sf = settings["fencePi"];
  if (!sf || typeof sf !== "object") return null;
  const mode = (sf as Record<string, unknown>)["mode"];
  if (mode === "block" || mode === "warn") return mode;
  return null;
}

/**
 * Resolve the active fence mode.
 *
 * Precedence (highest → lowest):
 *   1. --fence-pi-block CLI flag
 *   2. fencePi.mode in .pi/settings.json  (project)
 *   3. fencePi.mode in ~/.pi/agent/settings.json  (global)
 *   4. "warn"  (built-in default)
 */
export async function loadMode(pi: ExtensionAPI, cwd: string): Promise<FenceMode> {
  if (pi.getFlag("fence-pi-block") === true) return "block";

  const project = await readJson(join(cwd, ".pi", "settings.json"));
  const projectMode = extractMode(project);
  if (projectMode) return projectMode;

  const global_ = await readJson(join(homedir(), ".pi", "agent", "settings.json"));
  const globalMode = extractMode(global_);
  if (globalMode) return globalMode;

  return "warn";
}
