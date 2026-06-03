import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { diff } from "fast-myers-diff";

type ExecFn = ExtensionAPI["exec"];

export function getRepoName(cwd: string): string {
  return basename(cwd);
}

export async function ensureGitRepo(exec: ExecFn, dir: string): Promise<void> {
  if (!existsSync(join(dir, ".git"))) {
    await exec("git", ["init"], { cwd: dir });
    await exec("git", ["config", "user.email", "pi@local"], { cwd: dir });
    await exec("git", ["config", "user.name", "pi"], { cwd: dir });
  }
}

export async function commitFile(
  exec: ExecFn,
  dir: string,
  filename: string,
  message: string,
): Promise<boolean> {
  await exec("git", ["add", filename], { cwd: dir });
  const result = await exec("git", ["commit", "-m", message], { cwd: dir });
  return result.code === 0;
}

export async function computeGitDiff(exec: ExecFn, dir: string, filename: string): Promise<string> {
  const parentCheck = await exec("git", ["rev-parse", "HEAD~1"], { cwd: dir });
  if (parentCheck.code !== 0) {
    return "";
  }
  const oldResult = await exec("git", ["show", `HEAD~1:${filename}`], { cwd: dir });
  const newResult = await exec("git", ["show", `HEAD:${filename}`], { cwd: dir });

  return formatLineDiff(splitLines(oldResult.stdout ?? ""), splitLines(newResult.stdout ?? ""));
}

function splitLines(content: string): string[] {
  const lines = content.split("\n");
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

export function formatLineDiff(oldLines: string[], newLines: string[]): string {
  const width = String(Math.max(oldLines.length, newLines.length, 1)).length;
  const parts: string[] = [];

  for (const [sx, ex, sy, ey] of diff(oldLines, newLines)) {
    for (let i = sx; i < ex; i++) {
      parts.push(`-${String(i + 1).padStart(width)} ${oldLines[i]}`);
    }
    for (let i = sy; i < ey; i++) {
      parts.push(`+${String(i + 1).padStart(width)} ${newLines[i]}`);
    }
  }

  return parts.join("\n");
}
