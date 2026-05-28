import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { FenceMode } from "./types.js";

export type { FenceMode };

export function parseMode(value: string | undefined): FenceMode | null {
  if (value === "block" || value === "warn" || value === "remove") {
    return value;
  }
  if (value === "delete") {
    return "remove";
  }
  return null;
}

export function getMode(pi: ExtensionAPI): FenceMode {
  const flag = pi.getFlag("pi-fence-mode");
  return (
    parseMode(typeof flag === "string" ? flag : undefined) ??
    parseMode(process.env.PI_FENCE_MODE) ??
    "warn"
  );
}
