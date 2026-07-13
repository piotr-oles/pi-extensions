import type { ThemeColor } from "@earendil-works/pi-coding-agent";
import type { Background } from "./background.js";
import type { PullRequest } from "./gh.js";
import { hyperlink } from "./osc8.js";

/** Minimal theme surface used for rendering — lets tests inject a fake. */
export interface ThemeLike {
  fg(color: ThemeColor, text: string): string;
}

const CI_GLYPH = "●";
const CONFLICT_GLYPH = "‼";
const APPROVED_GLYPH = "✓";
const CHANGES_GLYPH = "✗";

// Letter before `#n` describing lifecycle: D draft, O open, M merged, C closed.
const LIFECYCLE_GLYPH: Record<PullRequest["lifecycle"], string> = {
  draft: "D",
  open: "O",
  merged: "M",
  closed: "C",
};

const CI_COLOR: Record<PullRequest["ci"], ThemeColor> = {
  success: "success",
  failure: "error",
  running: "warning",
  none: "dim",
};

// No theme token is purple, but GitHub renders merged PRs purple. Emit a raw
// 256-color purple keyed to the terminal background: a bright lilac on dark,
// a deeper purple on light. draft/open/closed use theme tokens so they follow
// the active palette.
const MERGED_PURPLE: Record<Background, string> = {
  dark: "\x1b[38;5;141m", // #af87ff
  light: "\x1b[38;5;92m", // #8700d7
};
const RESET = "\x1b[0m";

// Merged and closed PRs are terminal states: nothing left to merge or review,
// so we drop the conflict and review glyphs and show CI only when it broke.
function isTerminalLifecycle(lifecycle: PullRequest["lifecycle"]): boolean {
  return lifecycle === "merged" || lifecycle === "closed";
}

function styleLabel(
  lifecycle: PullRequest["lifecycle"],
  theme: ThemeLike,
  background: Background,
  text: string,
): string {
  switch (lifecycle) {
    case "draft":
      return theme.fg("dim", text);
    case "open":
      return theme.fg("text", text);
    case "merged":
      return `${MERGED_PURPLE[background]}${text}${RESET}`;
    case "closed":
      return theme.fg("error", text);
  }
}

/**
 * Render a footer string for a {@link PullRequest}.
 *
 * Layout: a lifecycle letter (`D` draft, `O` open, `M` merged, `C` closed) then
 * a clickable `#n` link, both colored by lifecycle (merged is purple, tuned to
 * the terminal `background`; closed is red).
 *
 * For active PRs (draft/open) the link is followed by the diff stat (`+42 -10`,
 * additions green / deletions red) then the CI glyph `●` (always shown, `none`
 * dim so its position stays stable) and two conditional glyphs: a red conflict
 * `‼` when the PR can't merge, and a review verdict (`✓` green approved, `✗`
 * red changes-requested; nothing for `review_required`/`none`).
 *
 * Merged and closed PRs are terminal states, so they drop the diff stat,
 * conflict, and review glyphs and show the CI glyph only when CI failed.
 */
export function renderStatus(pr: PullRequest, theme: ThemeLike, background: Background): string {
  const link = renderLink(pr, theme, background);
  if (isTerminalLifecycle(pr.lifecycle)) {
    const brokenCI = renderBrokenCI(pr, theme);
    return brokenCI ? `${link} ${brokenCI}` : link;
  }
  const dots = [renderCI(pr, theme), renderConflict(pr, theme), renderReview(pr, theme)].join("");
  return [link, renderDiffStat(pr, theme), dots].filter(Boolean).join(" ");
}

function renderDiffStat(pr: PullRequest, theme: ThemeLike): string {
  if (pr.additions === 0 && pr.deletions === 0) {
    return "";
  }
  const added = theme.fg("toolDiffAdded", `+${pr.additions}`);
  const removed = theme.fg("toolDiffRemoved", `-${pr.deletions}`);
  return `${added} ${removed}`;
}

function renderLink(pr: PullRequest, theme: ThemeLike, background: Background) {
  const label = `${LIFECYCLE_GLYPH[pr.lifecycle]} #${pr.number}`;
  return hyperlink(pr.url, styleLabel(pr.lifecycle, theme, background, label));
}

function renderBrokenCI(pr: PullRequest, theme: ThemeLike): string {
  return pr.ci === "failure" ? renderCI(pr, theme) : "";
}

function renderCI(pr: PullRequest, theme: ThemeLike): string {
  return theme.fg(CI_COLOR[pr.ci], CI_GLYPH);
}

function renderConflict(pr: PullRequest, theme: ThemeLike): string {
  return pr.merge === "conflict" ? theme.fg("error", CONFLICT_GLYPH) : "";
}

function renderReview(pr: PullRequest, theme: ThemeLike): string {
  switch (pr.review) {
    case "approved":
      return theme.fg("success", APPROVED_GLYPH);
    case "changes_requested":
      return theme.fg("error", CHANGES_GLYPH);
    default:
      return "";
  }
}
