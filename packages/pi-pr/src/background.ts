export type Background = "dark" | "light";

/**
 * Best-effort terminal background detection from the `COLORFGBG` env var, which
 * terminals like iTerm2, rxvt, and Konsole set as `"fg;bg"` (or `"fg;aux;bg"`).
 * The last field is the background color index in the 16-color ANSI palette.
 *
 * Falls back to `"dark"` when the var is missing or unparseable — most
 * terminals are dark, and a bright purple on a dark background is the case the
 * user cares about most.
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
