/**
 * True when a bash command runs `gh pr create` (possibly chained with `&&`,
 * `||`, `;`, or pipes, and with any surrounding flags/args).
 *
 * Used to trigger a one-off status refresh right after the agent opens a PR,
 * so the footer updates without waiting for the next poll tick.
 */
export function isPrCreateCommand(command: string): boolean {
  return /(^|[\s;&|(])gh\s+pr\s+create(\s|$)/.test(command);
}
