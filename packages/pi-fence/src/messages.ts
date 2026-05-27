import type { CommentNode } from "./parse.js";
import type { Finding } from "./types.js";

export function formatFinding(f: CommentNode): string {
  return `    line ${f.startLine}, col ${f.startCol + 1}: ${f.text.trim()}`;
}

export function buildFindingLines(findings: Finding[]): string[] {
  const lines: string[] = [];
  for (const { relativePath, fences } of findings) {
    lines.push(`  ${relativePath}:`);
    lines.push(...fences.map(formatFinding));
  }
  return lines;
}

export function buildBlockReason(findings: Finding[]): string {
  return [
    "Write blocked — fence/divider comments in added code:",
    ...buildFindingLines(findings),
    "Remove these comments and retry.",
  ].join("\n");
}

export function buildWarnText(findings: Finding[]): string {
  return [
    "⚠ pi-fence: fence/divider comments detected in added code:",
    ...buildFindingLines(findings),
    "Please remove them.",
  ].join("\n");
}

export function buildRemoveText(findings: Finding[]): string {
  return [
    "ℹ pi-fence: fence/divider comments were automatically removed:",
    ...buildFindingLines(findings),
    "Do not add them back.",
  ].join("\n");
}
