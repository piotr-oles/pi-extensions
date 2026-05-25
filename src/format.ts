import type { SemContextResult, SemEntity, SemImpactResult } from "./sem.js";

// ---------------------------------------------------------------------------
// sem entities → compact tree
// ---------------------------------------------------------------------------

export function formatEntities(entities: SemEntity[]): string {
  if (entities.length === 0) return "(no entities found)";

  // Build id → entity map. sem uses "file::type::name" as parent_id.
  // We don't have explicit ids in the entities list, so derive them from
  // the parent_id references that children carry.
  const roots: SemEntity[] = [];
  const children = new Map<string | null, SemEntity[]>();

  for (const e of entities) {
    const bucket = children.get(e.parent_id) ?? [];
    bucket.push(e);
    children.set(e.parent_id, bucket);
    if (e.parent_id === null) roots.push(e);
  }

  const lines: string[] = [];

  function render(list: SemEntity[], indent: string) {
    for (const e of list) {
      const range =
        e.start_line === e.end_line ? `L${e.start_line}` : `L${e.start_line}–${e.end_line}`;
      lines.push(`${indent}${e.type} ${e.name} (${range})`);

      // Derive the id key children use as parent_id.
      // sem parent_id format observed: "file::type::name" — but since we
      // only have terminal nodes in the flat list we reconstruct by matching
      // the entity name against children's parent_id suffix.
      const childList = findChildren(entities, e);
      if (childList.length > 0) render(childList, `${indent}  `);
    }
  }

  function findChildren(all: SemEntity[], parent: SemEntity): SemEntity[] {
    // parent_id ends with "::type::name"
    const suffix = `::${parent.type}::${parent.name}`;
    return all.filter((e) => e.parent_id?.endsWith(suffix) ?? false);
  }

  render(roots, "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// sem context → LLM-friendly output
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

// ---------------------------------------------------------------------------
// sem impact → LLM-friendly output
// ---------------------------------------------------------------------------

function entityRef(e: {
  name: string;
  type: string;
  file: string;
  lines: [number, number];
}): string {
  const range = e.lines[0] === e.lines[1] ? `L${e.lines[0]}` : `L${e.lines[0]}–${e.lines[1]}`;
  return `${e.type} \`${e.name}\` (${e.file} ${range})`;
}

export function formatImpact(result: SemImpactResult): string {
  const lines: string[] = [
    `Impact analysis: ${result.entity.type} \`${result.entity.name}\``,
    `File: ${result.entity.file}  Lines: ${result.entity.lines[0]}–${result.entity.lines[1]}`,
    "",
  ];

  if (result.dependencies.length > 0) {
    lines.push(`## Dependencies (${result.dependencies.length})`);
    for (const d of result.dependencies) lines.push(`  • ${entityRef(d)}`);
    lines.push("");
  }

  if (result.dependents.length > 0) {
    lines.push(`## Direct dependents (${result.dependents.length})`);
    for (const d of result.dependents) lines.push(`  • ${entityRef(d)}`);
    lines.push("");
  }

  if (result.impact.entities.length > 0) {
    lines.push(`## Transitive impact (depth ${result.impact.depth}, total ${result.impact.total})`);
    for (const e of result.impact.entities) {
      lines.push(`  ${"  ".repeat(e.depth - 1)}• [d${e.depth}] ${entityRef(e)}`);
    }
    lines.push("");
  }

  if (result.tests.length > 0) {
    lines.push(`## Affected tests (${result.tests.length})`);
    for (const t of result.tests) lines.push(`  • ${entityRef(t)}`);
    lines.push("");
  }

  if (
    result.dependencies.length === 0 &&
    result.dependents.length === 0 &&
    result.impact.entities.length === 0 &&
    result.tests.length === 0
  ) {
    lines.push("(no impact found)");
  }

  return lines.join("\n").trimEnd();
}
