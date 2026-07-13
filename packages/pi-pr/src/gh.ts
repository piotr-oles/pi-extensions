import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface PullRequest {
  number: number;
  url: string;
  lifecycle: "open" | "draft" | "merged" | "closed";
  ci: "success" | "failure" | "running" | "none";
  merge: "clean" | "conflict" | "unknown";
  review: "approved" | "changes_requested" | "review_required" | "none";
}

/** Minimal surface of `ExtensionAPI` needed to run gh — lets tests inject a fake. */
export type GhExec = Pick<ExtensionAPI, "exec">;

const GH_FIELDS =
  "number,url,state,isDraft,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup";

const FAILURE_CONCLUSIONS = new Set([
  "FAILURE",
  "TIMED_OUT",
  "CANCELLED",
  "ACTION_REQUIRED",
  "STARTUP_FAILURE",
  "ERROR",
]);

const RUNNING_STATUSES = new Set(["QUEUED", "IN_PROGRESS", "PENDING", "WAITING"]);

/**
 * Resolve the current branch's GitHub PR via `gh pr view` and map it to a
 * {@link PullRequest}.
 *
 * Returns `null` for every non-success path — no PR for the branch, not a git
 * repo, gh missing/unauthenticated, non-zero exit, or malformed output. The
 * caller treats `null` as "nothing to show" and stays silent.
 */
export async function fetchPullRequest(
  pi: GhExec,
  signal: AbortSignal,
): Promise<PullRequest | null> {
  let stdout: string;
  try {
    const result = await pi.exec("gh", ["pr", "view", "--json", GH_FIELDS], {
      signal,
      timeout: 10_000,
    });
    if (result.code !== 0) {
      return null;
    }
    stdout = result.stdout;
  } catch {
    return null;
  }

  return parsePullRequest(stdout);
}

interface GhCheck {
  status?: string;
  conclusion?: string;
  state?: string;
}

interface GhPullRequest {
  number?: number;
  url?: string;
  state?: string;
  isDraft?: boolean;
  mergeable?: string;
  reviewDecision?: string | null;
  statusCheckRollup?: GhCheck[];
}

export function parsePullRequest(json: string): PullRequest | null {
  let raw: GhPullRequest;
  try {
    raw = JSON.parse(json) as GhPullRequest;
  } catch {
    return null;
  }

  if (typeof raw.number !== "number" || typeof raw.url !== "string") {
    return null;
  }

  return {
    number: raw.number,
    url: raw.url,
    lifecycle: parseLifecycle(raw),
    ci: parseCi(raw.statusCheckRollup),
    merge: parseMerge(raw.mergeable),
    review: parseReview(raw.reviewDecision),
  };
}

function parseLifecycle(raw: GhPullRequest): PullRequest["lifecycle"] {
  if (raw.state === "MERGED") {
    return "merged";
  }
  if (raw.state === "CLOSED") {
    return "closed";
  }
  if (raw.isDraft) {
    return "draft";
  }
  return "open";
}

function parseCi(checks: GhCheck[] | undefined): PullRequest["ci"] {
  if (!Array.isArray(checks) || checks.length === 0) {
    return "none";
  }

  const hasFailure = checks.some(
    (check) =>
      FAILURE_CONCLUSIONS.has(check.conclusion ?? "") || FAILURE_CONCLUSIONS.has(check.state ?? ""),
  );
  if (hasFailure) {
    return "failure";
  }

  const hasRunning = checks.some(
    (check) => RUNNING_STATUSES.has(check.status ?? "") || RUNNING_STATUSES.has(check.state ?? ""),
  );
  if (hasRunning) {
    return "running";
  }

  return "success";
}

function parseMerge(mergeable: string | undefined): PullRequest["merge"] {
  if (mergeable === "CONFLICTING") {
    return "conflict";
  }
  if (mergeable === "MERGEABLE") {
    return "clean";
  }
  return "unknown";
}

function parseReview(decision: string | null | undefined): PullRequest["review"] {
  switch (decision) {
    case "APPROVED":
      return "approved";
    case "CHANGES_REQUESTED":
      return "changes_requested";
    case "REVIEW_REQUIRED":
      return "review_required";
    default:
      return "none";
  }
}
