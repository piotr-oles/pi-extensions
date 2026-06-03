import { homedir } from "node:os";

export function toTildePath(absPath: string): string {
  const home = homedir();
  return absPath.startsWith(home) ? `~${absPath.slice(home.length)}` : absPath;
}
