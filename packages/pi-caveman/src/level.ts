import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type CavemanLevel = "off" | "lite" | "full" | "ultra";

export function parseLevel(value: string | undefined): CavemanLevel | null {
  if (value === "off" || value === "lite" || value === "full" || value === "ultra") {
    return value;
  }
  return null;
}

export function getLevel(pi: ExtensionAPI): CavemanLevel {
  const flag = pi.getFlag("pi-caveman");
  return (
    parseLevel(typeof flag === "string" ? flag : undefined) ??
    parseLevel(process.env.PI_CAVEMAN) ??
    "full"
  );
}
