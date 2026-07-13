export const BASH_DEFAULT_TIMEOUT_SECONDS = 120;
export const BASH_MAX_TIMEOUT_SECONDS = 600;

export const DEFAULT_TIMEOUT_ENV = "PI_BASH_DEFAULT_TIMEOUT_SECONDS";
export const MAX_TIMEOUT_ENV = "PI_BASH_MAX_TIMEOUT_SECONDS";

export interface BashTimeoutConfig {
  defaultSeconds: number;
  maxSeconds: number;
}

export interface BashTimeoutFlags {
  default?: boolean | string | undefined;
  max?: boolean | string | undefined;
}

type EnvLike = Record<string, string | undefined>;

function parsePositiveInt(value: boolean | string | undefined): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

/**
 * Resolve timeout defaults with precedence: flag > env var > built-in constant.
 *
 * Flags are registered without a default, so `getFlag` returns `undefined` when
 * the user did not pass one, letting the env var (senpi-mono compat) take over.
 * Invalid or non-positive values at any layer are ignored and fall through.
 * `maxSeconds` is raised to `defaultSeconds` when it would otherwise be lower.
 */
export function resolveBashTimeoutConfig(flags: BashTimeoutFlags, env: EnvLike): BashTimeoutConfig {
  const defaultSeconds =
    parsePositiveInt(flags.default) ??
    parsePositiveInt(env[DEFAULT_TIMEOUT_ENV]) ??
    BASH_DEFAULT_TIMEOUT_SECONDS;
  const rawMax =
    parsePositiveInt(flags.max) ??
    parsePositiveInt(env[MAX_TIMEOUT_ENV]) ??
    BASH_MAX_TIMEOUT_SECONDS;
  const maxSeconds = Math.max(rawMax, defaultSeconds);
  return { defaultSeconds, maxSeconds };
}

export function buildBashTimeoutPrompt(defaults: BashTimeoutConfig): string {
  return [
    "Bash Tool Timeout Policy:",
    `- Default timeout: ${defaults.defaultSeconds}s. Applied automatically when you do not set \`timeout\`.`,
    `- Maximum timeout: ${defaults.maxSeconds}s. Larger values are capped automatically.`,
    "- For long-running commands (builds, installs, test suites), set an explicit `timeout` that fits the workload. Do not assume commands run forever.",
    "- For commands that legitimately need to run beyond the recommended maximum, run them in the background via tmux or a similar mechanism instead of relying on bash timeout.",
  ].join("\n");
}
