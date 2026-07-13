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

const CI_COLOR: Record<PullRequest["ci"], ThemeColor> = {
  success: "success",
  failure: "error",
  running: "warning",
  none: "dim",
};

// Theme tokens have no "purple"; merged falls back to "muted" to stay distinct
// from open (accent), closed (error) and draft (dim). See README.
const LIFECYCLE_COLOR: Record<PullRequest["lifecycle"], ThemeColor> = {
  draft: "dim",
  open: "text",
  merged: "muted",
  closed: "error",
};

/**
 * Render a footer string for a {@link PullRequest}: a clickable `#n` link
 * (colored by lifecycle) followed by the CI glyph `●` (always shown, `none`
 * dim so its position stays stable), then two conditional glyphs that appear
 * only in specific states — a red conflict `‼` when the PR can't merge, and a
 * review verdict (`✓` green approved, `✗` red changes-requested; nothing for
 * `review_required`/`none`).
 */
export function renderStatus(pr: PullRequest, theme: ThemeLike): string {
  const link = renderLink(pr, theme);
  const dots = [renderCI(pr, theme), renderConflict(pr, theme), renderReview(pr, theme)].join("");

  return [link, dots].join(" ");
}

function renderLink(pr: PullRequest, theme: ThemeLike) {
  const label = theme.fg(LIFECYCLE_COLOR[pr.lifecycle], `#${pr.number}`);
  return hyperlink(pr.url, label);
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
