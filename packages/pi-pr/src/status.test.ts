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
  function render(input: PullRequest): string {
    const out = renderStatus(input, theme);
    if (out === undefined) {
      throw new Error("expected a rendered status");
    }
    return out;
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

  it("shows a lifecycle glyph before #n, colored by lifecycle", () => {
    expect(render(pr({ lifecycle: "draft" }))).toContain("[dim]◇ #42");
    expect(render(pr({ lifecycle: "open" }))).toContain("[text]◆ #42");
    expect(render(pr({ lifecycle: "merged" }))).toContain("[muted]◈ #42");
  });

  it("renders nothing for a closed PR", () => {
    expect(renderStatus(pr({ lifecycle: "closed" }), theme)).toBeUndefined();
  });

  it("wraps #n in an OSC 8 link to the PR url", () => {
    const out = render(base);
    expect(out).toContain(`\x1b]8;;${base.url}\x1b\\`);
    expect(out).toContain("[text]◆ #42");
    expect(out).toContain("\x1b]8;;\x1b\\");
  });
});
