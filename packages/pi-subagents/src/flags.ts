import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerFlags(pi: ExtensionAPI): void {
  pi.registerFlag("pi-subagents-max-concurrent", {
    type: "string",
    description: "Max subagents running concurrently (default: 4).",
    default: "4",
  });
  pi.registerFlag("pi-subagents-grace-turns", {
    type: "string",
    description: "Extra turns allowed after max-turns limit is hit (default: 5).",
    default: "5",
  });
  pi.registerFlag("pi-subagents-default-max-turns", {
    type: "string",
    description: "Default max turns per subagent, 0 = unlimited (default: 0).",
    default: "0",
  });
}

export function getMaxConcurrent(pi: ExtensionAPI): number {
  const val = Number(pi.getFlag("pi-subagents-max-concurrent"));
  return Number.isInteger(val) && val >= 1 ? val : 4;
}

export function getGraceTurns(pi: ExtensionAPI): number {
  const val = Number(pi.getFlag("pi-subagents-grace-turns"));
  return Number.isInteger(val) && val >= 1 ? val : 5;
}

export function getDefaultMaxTurns(pi: ExtensionAPI): number | undefined {
  const val = Number(pi.getFlag("pi-subagents-default-max-turns"));
  return Number.isInteger(val) && val > 0 ? val : undefined;
}
