import type { CommentNode, FencesFinding } from "./types.js";

export function buildFindingLines(findings: FencesFinding[]): string[] {
  function formatFinding({ startLine, text }: CommentNode): string {
    return `${startLine + 1}: ${text.trimEnd()}`;
  }

  const lines: string[] = [];
  for (const { path, fences } of findings) {
    if (fences.length === 1) {
      lines.push(`  ${path}:${formatFinding(fences[0])}`);
    } else {
      lines.push(`  ${path}:`);
      lines.push(...fences.map((f) => `    ${formatFinding(f)}`));
    }
  }
  return lines;
}

export function buildBlockReason(findings: FencesFinding[]): string {
  return [
    "Write blocked — fence comments in added code:",
    ...buildFindingLines(findings),
    "Remove these comments and retry.",
  ].join("\n");
}

export function buildWarnText(findings: FencesFinding[]): string {
  return [
    "Fence comments detected in added code:",
    ...buildFindingLines(findings),
    "Please remove them.",
  ].join("\n");
}

export function buildRemoveText(findings: FencesFinding[]): string {
  return [
    "Fence comments were automatically removed:",
    ...buildFindingLines(findings),
    "Do not add them back.",
  ].join("\n");
}
