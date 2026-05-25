import type { SemContextResult } from "./sem.js";

// ---------------------------------------------------------------------------
// sem context → LLM-friendly output (terminal format only shows 1-line previews)
// ---------------------------------------------------------------------------

export function formatContext(result: SemContextResult): string {
  const lines: string[] = [
    `Entity: ${result.entity}  [${result.total_tokens} tokens / ${result.budget} budget]`,
    "",
  ];

  for (const entry of result.entries) {
    const roleTag = entry.role === "target" ? "▶ target" : entry.role;
    lines.push(`### ${entry.name} (${entry.type}) — ${roleTag}`);
    lines.push(`File: ${entry.file}`);
    lines.push("");
    lines.push("```");
    lines.push(entry.content.trimEnd());
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
