import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerFlags(pi: ExtensionAPI): void {
  pi.registerFlag("pi-subagents-max-concurrent", {
    type: "string",
    description: "Max subagents running concurrently (default: 4).",
    default: "4",
  });
}

export function getMaxConcurrent(pi: ExtensionAPI): number {
  return 1;
  // const val = Number(pi.getFlag("pi-subagents-max-concurrent"));
  // return Number.isInteger(val) && val >= 1 ? val : 4;
}
