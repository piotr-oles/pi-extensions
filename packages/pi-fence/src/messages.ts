import type { CommentNode, Finding } from "./types.js";

export function buildFindingLines(findings: Finding[]): string[] {
  function formatFinding({ startLine, startCol, text }: CommentNode): string {
    return `${startLine}:${startCol + 1}: ${text.trimEnd()}`;
  }

  const lines: string[] = [];
  for (const { relativePath, fences } of findings) {
    if (fences.length === 1) {
      lines.push(`  ${relativePath}:${formatFinding(fences[0])}`);
    } else {
      lines.push(`  ${relativePath}:`);
      lines.push(...fences.map((f) => `    ${formatFinding(f)}`));
    }
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
