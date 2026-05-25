import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// JSON output types from sem CLI
// ---------------------------------------------------------------------------

export interface SemEntity {
  name: string;
  type: string;
  start_line: number;
  end_line: number;
  parent_id: string | null;
}

export interface SemContextEntry {
  entityId: string;
  file: string;
  name: string;
  type: string;
  role: "target" | "dependency" | "direct_dependent" | string;
  content: string;
  tokens: number;
}

export interface SemContextResult {
  entity: string;
  entityId: string;
  budget: number;
  total_tokens: number;
  entries: SemContextEntry[];
}

export interface SemImpactEntity {
  entityId: string;
  name: string;
  type: string;
  file: string;
  lines: [number, number];
}

export interface SemImpactTransitiveEntity extends SemImpactEntity {
  depth: number;
}

export interface SemImpactResult {
  entity: SemImpactEntity;
  dependencies: SemImpactEntity[];
  dependents: SemImpactEntity[];
  impact: {
    depth: number;
    total: number;
    entities: SemImpactTransitiveEntity[];
  };
  tests: SemImpactEntity[];
}

export interface SemDiffSummary {
  fileCount: number;
  added: number;
  modified: number;
  deleted: number;
  moved: number;
  renamed: number;
  reordered: number;
  orphan: number;
  total: number;
}

export interface SemDiffChange {
  entityId: string;
  entityName: string;
  entityType: string;
  filePath: string;
  changeType: "added" | "modified" | "deleted" | "moved" | "renamed" | "reordered";
  beforeContent: string | null;
  afterContent: string | null;
  oldEntityName: string | null;
  oldFilePath: string | null;
  author: string | null;
  commitSha: string | null;
  structuralChange: string | null;
}

export interface SemDiffResult {
  summary: SemDiffSummary;
  changes: SemDiffChange[];
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class SemError extends Error {
  constructor(
    message: string,
    public readonly stderr: string,
    public readonly code: number | null,
  ) {
    super(message);
    this.name = "SemError";
  }
}

// ---------------------------------------------------------------------------
// Exec helpers
// ---------------------------------------------------------------------------

type ExecFn = ExtensionAPI["exec"];

async function run(
  exec: ExecFn,
  args: string[],
  signal?: AbortSignal,
): Promise<string> {
  const result = await exec("sem", args, { signal, timeout: 30_000 });
  if (result.code !== 0) {
    throw new SemError(
      `sem ${args[0]} failed: ${result.stderr.trim()}`,
      result.stderr,
      result.code,
    );
  }
  return result.stdout;
}

// ---------------------------------------------------------------------------
// Typed wrappers
// ---------------------------------------------------------------------------

export async function semEntities(
  exec: ExecFn,
  path: string,
  signal?: AbortSignal,
): Promise<SemEntity[]> {
  const out = await run(exec, ["entities", "--json", path], signal);
  return JSON.parse(out) as SemEntity[];
}

export async function semContext(
  exec: ExecFn,
  entity: string,
  opts: { file?: string; budget?: number; entityId?: string },
  signal?: AbortSignal,
): Promise<SemContextResult> {
  const args = ["context", "--json", entity];
  if (opts.file) args.push("--file", opts.file);
  if (opts.budget) args.push("--budget", String(opts.budget));
  if (opts.entityId) args.push("--entity-id", opts.entityId);
  const out = await run(exec, args, signal);
  return JSON.parse(out) as SemContextResult;
}

export async function semImpact(
  exec: ExecFn,
  entity: string,
  opts: {
    file?: string;
    entityId?: string;
    deps?: boolean;
    dependents?: boolean;
    tests?: boolean;
    depth?: number;
  },
  signal?: AbortSignal,
): Promise<SemImpactResult> {
  const args = ["impact", "--json", entity];
  if (opts.file) args.push("--file", opts.file);
  if (opts.entityId) args.push("--entity-id", opts.entityId);
  if (opts.deps) args.push("--deps");
  if (opts.dependents) args.push("--dependents");
  if (opts.tests) args.push("--tests");
  if (opts.depth !== undefined) args.push("--depth", String(opts.depth));
  const out = await run(exec, args, signal);
  return JSON.parse(out) as SemImpactResult;
}

export async function semDiff(
  exec: ExecFn,
  opts: { from?: string; to?: string; staged?: boolean; format?: "markdown" | "json" },
  signal?: AbortSignal,
): Promise<string> {
  const fmt = opts.format ?? "markdown";
  const args = ["diff", "--format", fmt];
  if (opts.staged) args.push("--staged");
  if (opts.from) args.push("--from", opts.from);
  if (opts.to) args.push("--to", opts.to);
  return run(exec, args, signal);
}
