import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// JSON output types — only for sem context (needs full source content)
// ---------------------------------------------------------------------------

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
// Exec helper
// ---------------------------------------------------------------------------

type ExecFn = ExtensionAPI["exec"];

async function run(exec: ExecFn, args: string[], signal?: AbortSignal): Promise<string> {
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

/** Returns the terminal-format entity tree (no --json needed). */
export async function semEntities(
  exec: ExecFn,
  path: string,
  signal?: AbortSignal,
): Promise<string> {
  return run(exec, ["entities", path], signal);
}

/** Returns JSON-parsed context (terminal format only shows 1-line previews). */
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

/**
 * Returns the terminal-format impact analysis.
 * Each mode flag is exclusive — sem only returns that section.
 * Pass no flag ("all") to get everything.
 */
export async function semImpact(
  exec: ExecFn,
  entity: string,
  opts: { file?: string; entityId?: string; mode?: string; depth?: number },
  signal?: AbortSignal,
): Promise<string> {
  const args = ["impact", entity];
  if (opts.file) args.push("--file", opts.file);
  if (opts.entityId) args.push("--entity-id", opts.entityId);
  if (opts.mode === "deps") args.push("--deps");
  else if (opts.mode === "dependents") args.push("--dependents");
  else if (opts.mode === "tests") args.push("--tests");
  // "all" (default) → no flag, sem returns all sections
  if (opts.depth !== undefined) args.push("--depth", String(opts.depth));
  return run(exec, args, signal);
}

export async function semDiff(
  exec: ExecFn,
  opts: { from?: string; to?: string; staged?: boolean },
  signal?: AbortSignal,
): Promise<string> {
  const args = ["diff", "--format", "markdown"];
  if (opts.staged) args.push("--staged");
  if (opts.from) args.push("--from", opts.from);
  if (opts.to) args.push("--to", opts.to);
  return run(exec, args, signal);
}
