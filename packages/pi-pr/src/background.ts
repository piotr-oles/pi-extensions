export type Background = "dark" | "light";

/**
 * Best-effort terminal background detection from the `COLORFGBG` env var, which
 * terminals like iTerm2, rxvt, and Konsole set as `"fg;bg"` (or `"fg;aux;bg"`).
 * The last field is the background color index in the 16-color ANSI palette.
 *
 * Falls back to `"dark"` when the var is missing or unparseable — most
 * terminals are dark, and a bright purple on a dark background is the case the
 * user cares about most.
 *
 * pi has a richer `detectTerminalBackground` (OSC 11 query + `COLORFGBG` +
 * fallback), but it is not exported from the package entry or `./hooks`, and the
 * `exports` map blocks deep-importing it (`ERR_PACKAGE_PATH_NOT_EXPORTED`). This
 * `COLORFGBG`-only reader is a pure, dependency-free subset that needs no
 * terminal I/O, which suits a value we read on every status refresh.
 */
export function detectBackground(env: NodeJS.ProcessEnv = process.env): Background {
  const raw = env.COLORFGBG;
  if (!raw) {
    return "dark";
  }
  const fields = raw.split(";");
  const bg = Number(fields[fields.length - 1]);
  if (!Number.isInteger(bg)) {
    return "dark";
  }
  // ANSI palette: 7 (light gray) and 9–15 are light backgrounds; 0–6 and 8 dark.
  return bg === 7 || bg >= 9 ? "light" : "dark";
}
