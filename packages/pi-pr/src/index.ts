import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { fetchPullRequest } from "./gh.js";
import { renderStatus } from "./status.js";

const STATUS_KEY = "pi-pr";
const DEFAULT_INTERVAL_SECONDS = 30;
const MIN_INTERVAL_SECONDS = 5;

export default function piPr(pi: ExtensionAPI): void {
  // Flags are boolean|string only; interval is a numeric string parsed at use.
  pi.registerFlag("pi-pr-interval", {
    type: "string",
    description: `Poll interval in seconds (minimum ${MIN_INTERVAL_SECONDS}).`,
    default: String(DEFAULT_INTERVAL_SECONDS),
  });

  let timer: NodeJS.Timeout | null = null;
  let controller: AbortController | null = null;
  let polling = false;

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    controller?.abort();
    controller = null;
    polling = false;
  };

  const pollOnce = async (ctx: ExtensionContext) => {
    if (polling) {
      return;
    }
    polling = true;
    controller = new AbortController();
    try {
      const pr = await fetchPullRequest(pi, controller.signal);
      ctx.ui.setStatus(STATUS_KEY, pr ? renderStatus(pr, ctx.ui.theme) : undefined);
    } finally {
      controller = null;
      polling = false;
    }
  };

  pi.on("session_start", (_event, ctx) => {
    stop();
    void pollOnce(ctx);
    const ms = intervalMs(pi);
    timer = setInterval(() => void pollOnce(ctx), ms);
  });

  pi.on("session_shutdown", () => stop());

  pi.registerCommand("pr", {
    description: "Open the current branch's PR in the browser and refresh its status",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      await pi.exec("gh", ["pr", "view", "--web"], { timeout: 5_000 }).catch(() => {});
      await pollOnce(ctx);
    },
  });
}

function intervalMs(pi: ExtensionAPI): number {
  const raw = Number(pi.getFlag("pi-pr-interval"));
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INTERVAL_SECONDS;
  return Math.max(MIN_INTERVAL_SECONDS, seconds) * 1000;
}
