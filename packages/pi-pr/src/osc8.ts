const ST = "\x1b\\";

/**
 * Wrap `text` in an OSC 8 terminal hyperlink pointing at `url`.
 *
 * Produces `ESC ]8;;URL ST TEXT ESC ]8;; ST`, the standard open/close pair.
 * Kept terminal-agnostic and side-effect free so it is unit-testable.
 */
export function hyperlink(url: string, text: string): string {
  return `\x1b]8;;${url}${ST}${text}\x1b]8;;${ST}`;
}
