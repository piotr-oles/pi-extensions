import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type CwdMode = "warn" | "block";

export function parseMode(value: string | undefined): CwdMode | null {
  if (value === "warn" || value === "block") {
    return value;
  }
  return null;
}

export function getMode(pi: ExtensionAPI): CwdMode {
  const flag = pi.getFlag("pi-cwd-mode");
  return (
    parseMode(typeof flag === "string" ? flag : undefined) ??
    parseMode(process.env.PI_CWD_MODE) ??
    "warn"
  );
}
