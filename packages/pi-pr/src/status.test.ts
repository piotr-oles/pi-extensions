import { describe, expect, it } from "vitest";
import type { PullRequest } from "./gh.js";
import { renderStatus, type ThemeLike } from "./status.js";

// Fake theme: fg(token, text) => `[token]text`, so assertions can read both the
// color token and the glyph it wraps.
const theme: ThemeLike = {
  fg: (color, text) => `[${color}]${text}`,
};

const base: PullRequest = {
  number: 42,
  url: "https://example.com/pr/42",
  lifecycle: "open",
  ci: "success",
  merge: "clean",
  review: "approved",
  additions: 42,
  deletions: 10,
};

function pr(overrides: Partial<PullRequest>): PullRequest {
  return { ...base, ...overrides };
}

describe("renderStatus", () => {
  function render(input: PullRequest, background: "dark" | "light" = "dark"): string {
    return renderStatus(input, theme, background);
  }

  it("renders CI before the review verdict", () => {
    const out = render(base);
    const ci = out.indexOf("●");
    const review = out.indexOf("✓");
    expect(ci).toBeGreaterThan(-1);
    expect(ci).toBeLessThan(review);
  });

  it("colors CI and the approved verdict; omits conflict glyph when not conflicting", () => {
    const out = render(base);
    expect(out).toContain("[success]●");
    expect(out).toContain("[success]✓");
    expect(out).not.toContain("‼");
  });

  it("maps CI states to color tokens", () => {
    expect(render(pr({ ci: "failure" }))).toContain("[error]●");
    expect(render(pr({ ci: "running" }))).toContain("[warning]●");
    expect(render(pr({ ci: "none" }))).toContain("[dim]●");
  });

  it("shows the red conflict glyph only on conflict, between CI and review", () => {
    const conflicting = render(pr({ merge: "conflict" }));
    expect(conflicting).toContain("[error]‼");
    expect(conflicting.indexOf("●")).toBeLessThan(conflicting.indexOf("‼"));
    expect(conflicting.indexOf("‼")).toBeLessThan(conflicting.indexOf("✓"));

    expect(render(pr({ merge: "clean" }))).not.toContain("‼");
    expect(render(pr({ merge: "unknown" }))).not.toContain("‼");
  });

  it("shows the review verdict only for approved / changes_requested", () => {
    expect(render(pr({ review: "approved" }))).toContain("[success]✓");

    const changes = render(pr({ review: "changes_requested" }));
    expect(changes).toContain("[error]✗");
    expect(changes).not.toContain("✓");

    for (const review of ["review_required", "none"] as const) {
      const out = render(pr({ review }));
      expect(out).not.toContain("✓");
      expect(out).not.toContain("✗");
    }
  });

  it("orders conflict before the review verdict", () => {
    const out = render(pr({ merge: "conflict", review: "changes_requested" }));
    expect(out.indexOf("●")).toBeLessThan(out.indexOf("‼"));
    expect(out.indexOf("‼")).toBeLessThan(out.indexOf("✗"));
  });

  it("shows a lifecycle letter and #n link, both colored by lifecycle", () => {
    const draft = render(pr({ lifecycle: "draft" }));
    expect(draft).toContain("[dim]D");
    expect(draft).toContain("[dim]#42");

    const open = render(pr({ lifecycle: "open" }));
    expect(open).toContain("[text]O");
    expect(open).toContain("[text]#42");

    const closed = render(pr({ lifecycle: "closed" }));
    expect(closed).toContain("[error]C");
    expect(closed).toContain("[error]#42");
  });

  it("tunes the merged purple to the terminal background", () => {
    // Merged uses a raw 256-color purple, not a theme token: brighter on dark.
    const dark = render(pr({ lifecycle: "merged" }), "dark");
    expect(dark).toContain("\x1b[38;5;141mM\x1b[0m");
    expect(dark).toContain("\x1b[38;5;141m#42\x1b[0m");
    expect(render(pr({ lifecycle: "merged" }), "light")).toContain("\x1b[38;5;92m#42\x1b[0m");
  });

  it("drops diff stat/conflict/review glyphs for terminal states and shows CI only when broken", () => {
    for (const lifecycle of ["merged", "closed"] as const) {
      const green = render(pr({ lifecycle, ci: "success", merge: "conflict", review: "approved" }));
      expect(green).not.toContain("●");
      expect(green).not.toContain("‼");
      expect(green).not.toContain("✓");
      expect(green).not.toContain("+42");

      const broken = render(pr({ lifecycle, ci: "failure" }));
      expect(broken).toContain("[error]●");
    }
  });

  it("shows the diff stat for active PRs, additions green and deletions red", () => {
    const out = render(pr({ lifecycle: "open", additions: 42, deletions: 10 }));
    expect(out).toContain("[toolDiffAdded]+42");
    expect(out).toContain("[toolDiffRemoved]-10");
    // between the link and the CI dot
    expect(out.indexOf("+42")).toBeLessThan(out.indexOf("●"));
    expect(render(pr({ lifecycle: "draft" }))).toContain("[toolDiffAdded]+42");
  });

  it("omits the diff stat when a PR has no changes", () => {
    expect(render(pr({ additions: 0, deletions: 0 }))).not.toContain("+0");
  });

  it("wraps #n in an OSC 8 link to the PR url, with the glyph outside the link", () => {
    const out = render(base);
    expect(out).toContain(`\x1b]8;;${base.url}\x1b\\`);
    expect(out).toContain("[text]O ");
    expect(out).toContain("[text]#42");
    expect(out).toContain("\x1b]8;;\x1b\\");
  });
});
