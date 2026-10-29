import {
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
  isBashToolResult,
} from "@earendil-works/pi-coding-agent";
import { detectBackground } from "./background.js";
import { isPrCreateCommand } from "./command.js";
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
  const controllers = new Set<AbortController>();

  const abort = () => {
    for (const controller of controllers) {
      controller.abort();
    }
    controllers.clear();
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    abort();
  };

  const poll = async (ctx: ExtensionContext) => {
    if (controllers.size !== 0) {
      // Abort pending requests before starting new one
      abort();
    }
    const controller = new AbortController();
    try {
      controllers.add(controller);
      const pr = await fetchPullRequest(pi, controller.signal);
      if (!controller.signal.aborted) {
        ctx.ui.setStatus(
          STATUS_KEY,
          pr ? renderStatus(pr, ctx.ui.theme, detectBackground()) : undefined,
        );
      }
    } finally {
      controllers.delete(controller);
    }
  };

  pi.on("session_start", (_event, ctx) => {
    stop();
    void poll(ctx);
    const ms = intervalMs(pi);
    timer = setInterval(() => void poll(ctx), ms);
  });

  pi.on("session_shutdown", () => stop());

  // Refresh right after the agent opens a PR so the footer updates immediately.
  pi.on("tool_result", (event, ctx) => {
    if (isBashToolResult(event) && isPrCreateCommand(String(event.input.command ?? ""))) {
      void poll(ctx);
    }
  });

  pi.registerCommand("pr", {
    description: "Open the current branch's PR in the browser and refresh its status",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      await pi.exec("gh", ["pr", "view", "--web"], { timeout: 5_000 }).catch(() => {});
      await poll(ctx);
    },
  });
}

function intervalMs(pi: ExtensionAPI): number {
  const raw = Number(pi.getFlag("pi-pr-interval"));
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INTERVAL_SECONDS;
  return Math.max(MIN_INTERVAL_SECONDS, seconds) * 1000;
}
