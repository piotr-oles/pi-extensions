import type { ThemeColor } from "@earendil-works/pi-coding-agent";
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

// Closed PRs render nothing, so only these three states are ever drawn.
type VisibleLifecycle = Exclude<PullRequest["lifecycle"], "closed">;

// Letter before `#n` describing lifecycle: D draft, O open, M merged.
const LIFECYCLE_GLYPH: Record<VisibleLifecycle, string> = {
  draft: "D",
  open: "O",
  merged: "M",
};

const CI_COLOR: Record<PullRequest["ci"], ThemeColor> = {
  success: "success",
  failure: "error",
  running: "warning",
  none: "dim",
};

// No theme token is purple, but GitHub renders merged PRs purple. Emit a raw
// 256-color purple (≈ GitHub's merged #875fff) for merged; draft/open use theme
// tokens so they follow the active palette.
const PURPLE = "\x1b[38;5;99m";
const RESET = "\x1b[0m";

function styleLabel(lifecycle: VisibleLifecycle, theme: ThemeLike, text: string): string {
  switch (lifecycle) {
    case "draft":
      return theme.fg("dim", text);
    case "open":
      return theme.fg("text", text);
    case "merged":
      return `${PURPLE}${text}${RESET}`;
  }
}

/**
 * Render a footer string for a {@link PullRequest}, or `undefined` for closed
 * PRs (nothing to act on, so the footer stays empty).
 *
 * Layout: a lifecycle letter (`D` draft, `O` open, `M` merged) then a clickable
 * `#n` link, both colored by lifecycle (merged is purple), followed by the CI
 * glyph `●` (always shown, `none` dim so its position stays stable), then two
 * conditional glyphs
 * that appear only in specific states — a red conflict `‼` when the PR can't
 * merge, and a review verdict (`✓` green approved, `✗` red changes-requested;
 * nothing for `review_required`/`none`).
 */
export function renderStatus(pr: PullRequest, theme: ThemeLike): string | undefined {
  if (pr.lifecycle === "closed") {
    return undefined;
  }
  const link = renderLink(pr, theme);
  const dots = [renderCI(pr, theme), renderConflict(pr, theme), renderReview(pr, theme)].join("");

  return [link, dots].join(" ");
}

function renderLink(pr: PullRequest, theme: ThemeLike) {
  // Closed PRs are filtered out in renderStatus, so the cast is safe here.
  const lifecycle = pr.lifecycle as VisibleLifecycle;
  const label = `${LIFECYCLE_GLYPH[lifecycle]} #${pr.number}`;
  return hyperlink(pr.url, styleLabel(lifecycle, theme, label));
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
