import { describe, expect, it, vi } from "vitest";
import { fetchPullRequest, type GhExec, parsePullRequest } from "./gh.js";

function fakeExec(result: { stdout?: string; code?: number } | Error): GhExec {
  return {
    exec: vi.fn(async () => {
      if (result instanceof Error) {
        throw result;
      }
      return {
        stdout: result.stdout ?? "",
        stderr: "",
        code: result.code ?? 0,
        killed: false,
      };
    }),
  };
}

const openPr = JSON.stringify({
  number: 7,
  url: "https://example.com/pr/7",
  state: "OPEN",
  isDraft: false,
  mergeable: "MERGEABLE",
  reviewDecision: "APPROVED",
  statusCheckRollup: [{ status: "COMPLETED", conclusion: "SUCCESS" }],
});

describe("parsePullRequest", () => {
  it("maps a fully open, green, approved PR", () => {
    expect(parsePullRequest(openPr)).toEqual({
      number: 7,
      url: "https://example.com/pr/7",
      lifecycle: "open",
      ci: "success",
      merge: "clean",
      review: "approved",
    });
  });

  it("derives lifecycle from state and isDraft", () => {
    const draft = { number: 1, url: "u", state: "OPEN", isDraft: true };
    const merged = { number: 1, url: "u", state: "MERGED" };
    const closed = { number: 1, url: "u", state: "CLOSED" };
    expect(parsePullRequest(JSON.stringify(draft))?.lifecycle).toBe("draft");
    expect(parsePullRequest(JSON.stringify(merged))?.lifecycle).toBe("merged");
    expect(parsePullRequest(JSON.stringify(closed))?.lifecycle).toBe("closed");
  });

  it("aggregates CI: failure beats running beats success", () => {
    const rollup = (checks: unknown[]) =>
      parsePullRequest(JSON.stringify({ number: 1, url: "u", statusCheckRollup: checks }))?.ci;

    expect(rollup([{ conclusion: "SUCCESS" }, { conclusion: "FAILURE" }])).toBe("failure");
    expect(rollup([{ conclusion: "SUCCESS" }, { status: "IN_PROGRESS" }])).toBe("running");
    expect(rollup([{ conclusion: "SUCCESS" }, { conclusion: "SUCCESS" }])).toBe("success");
    expect(rollup([])).toBe("none");
  });

  it("treats statusContext state field for CI", () => {
    const rollup = (checks: unknown[]) =>
      parsePullRequest(JSON.stringify({ number: 1, url: "u", statusCheckRollup: checks }))?.ci;
    expect(rollup([{ state: "FAILURE" }])).toBe("failure");
    expect(rollup([{ state: "PENDING" }])).toBe("running");
    expect(rollup([{ state: "SUCCESS" }])).toBe("success");
  });

  it("maps merge states", () => {
    const merge = (mergeable: string) =>
      parsePullRequest(JSON.stringify({ number: 1, url: "u", mergeable }))?.merge;
    expect(merge("CONFLICTING")).toBe("conflict");
    expect(merge("MERGEABLE")).toBe("clean");
    expect(merge("UNKNOWN")).toBe("unknown");
  });

  it("maps review decisions, defaulting empty/null to none", () => {
    const review = (reviewDecision: unknown) =>
      parsePullRequest(JSON.stringify({ number: 1, url: "u", reviewDecision }))?.review;
    expect(review("CHANGES_REQUESTED")).toBe("changes_requested");
    expect(review("REVIEW_REQUIRED")).toBe("review_required");
    expect(review(null)).toBe("none");
    expect(review("")).toBe("none");
  });

  it("returns null for malformed json or missing identity fields", () => {
    expect(parsePullRequest("not json")).toBeNull();
    expect(parsePullRequest("{}")).toBeNull();
    expect(parsePullRequest(JSON.stringify({ number: 1 }))).toBeNull();
    expect(parsePullRequest(JSON.stringify({ url: "u" }))).toBeNull();
  });
});

describe("fetchPullRequest", () => {
  const signal = new AbortController().signal;

  it("parses gh stdout on success", async () => {
    const pi = fakeExec({ stdout: openPr, code: 0 });
    const pr = await fetchPullRequest(pi, signal);
    expect(pr?.number).toBe(7);
    expect(pi.exec).toHaveBeenCalledWith(
      "gh",
      ["pr", "view", "--json", expect.any(String)],
      expect.objectContaining({ signal }),
    );
  });

  it("returns null on non-zero exit (no PR / not a repo)", async () => {
    expect(await fetchPullRequest(fakeExec({ code: 1 }), signal)).toBeNull();
  });

  it("returns null when gh is missing (exec throws)", async () => {
    expect(await fetchPullRequest(fakeExec(new Error("ENOENT")), signal)).toBeNull();
  });

  it("returns null on malformed stdout", async () => {
    expect(await fetchPullRequest(fakeExec({ stdout: "garbage", code: 0 }), signal)).toBeNull();
  });
});
