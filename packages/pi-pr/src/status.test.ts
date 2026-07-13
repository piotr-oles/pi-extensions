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
};

function pr(overrides: Partial<PullRequest>): PullRequest {
  return { ...base, ...overrides };
}

describe("renderStatus", () => {
  it("renders CI before the review verdict", () => {
    const out = renderStatus(base, theme);
    const ci = out.indexOf("●");
    const review = out.indexOf("✓");
    expect(ci).toBeGreaterThan(-1);
    expect(ci).toBeLessThan(review);
  });

  it("colors CI and the approved verdict; omits conflict glyph when not conflicting", () => {
    const out = renderStatus(base, theme);
    expect(out).toContain("[success]●");
    expect(out).toContain("[success]✓");
    expect(out).not.toContain("‼");
  });

  it("maps CI states to color tokens", () => {
    expect(renderStatus(pr({ ci: "failure" }), theme)).toContain("[error]●");
    expect(renderStatus(pr({ ci: "running" }), theme)).toContain("[warning]●");
    expect(renderStatus(pr({ ci: "none" }), theme)).toContain("[dim]●");
  });

  it("shows the red conflict glyph only on conflict, between CI and review", () => {
    const conflicting = renderStatus(pr({ merge: "conflict" }), theme);
    expect(conflicting).toContain("[error]‼");
    expect(conflicting.indexOf("●")).toBeLessThan(conflicting.indexOf("‼"));
    expect(conflicting.indexOf("‼")).toBeLessThan(conflicting.indexOf("✓"));

    expect(renderStatus(pr({ merge: "clean" }), theme)).not.toContain("‼");
    expect(renderStatus(pr({ merge: "unknown" }), theme)).not.toContain("‼");
  });

  it("shows the review verdict only for approved / changes_requested", () => {
    expect(renderStatus(pr({ review: "approved" }), theme)).toContain("[success]✓");

    const changes = renderStatus(pr({ review: "changes_requested" }), theme);
    expect(changes).toContain("[error]✗");
    expect(changes).not.toContain("✓");

    for (const review of ["review_required", "none"] as const) {
      const out = renderStatus(pr({ review }), theme);
      expect(out).not.toContain("✓");
      expect(out).not.toContain("✗");
    }
  });

  it("orders conflict before the review verdict", () => {
    const out = renderStatus(pr({ merge: "conflict", review: "changes_requested" }), theme);
    expect(out.indexOf("●")).toBeLessThan(out.indexOf("‼"));
    expect(out.indexOf("‼")).toBeLessThan(out.indexOf("✗"));
  });

  it("colors #n by lifecycle", () => {
    expect(renderStatus(pr({ lifecycle: "draft" }), theme)).toContain("[dim]#42");
    expect(renderStatus(pr({ lifecycle: "open" }), theme)).toContain("[text]#42");
    expect(renderStatus(pr({ lifecycle: "merged" }), theme)).toContain("[muted]#42");
    expect(renderStatus(pr({ lifecycle: "closed" }), theme)).toContain("[error]#42");
  });

  it("wraps #n in an OSC 8 link to the PR url", () => {
    const out = renderStatus(base, theme);
    expect(out).toContain(`\x1b]8;;${base.url}\x1b\\`);
    expect(out).toContain("[text]#42");
    expect(out).toContain("\x1b]8;;\x1b\\");
  });
});
