import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { IgnoreMode } from "./find.js";

export function parseIgnoreMode(value: string | undefined): IgnoreMode | null {
  if (value === "ignore" || value === "no-ignore" || value === "auto") {
    return value;
  }
  return null;
}

export function getIgnoreMode(pi: ExtensionAPI): IgnoreMode {
  const flag = pi.getFlag("pi-reflag-ignore-mode");
  return (
    parseIgnoreMode(typeof flag === "string" ? flag : undefined) ??
    parseIgnoreMode(process.env.PI_REFLAG_IGNORE_MODE) ??
    "auto"
  );
}
