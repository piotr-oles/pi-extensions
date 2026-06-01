import type { AddressInfo } from "node:net";
import { resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import open from "open";
import { createReviewServer } from "./server.js";

const APP_DIST = resolve(import.meta.dirname, "../app-dist");

interface Session {
  url: string;
  shutdown: () => Promise<void>;
}

const sessions = new Map<string, Session>();

async function startSession(filePath: string, pi: ExtensionAPI): Promise<Session> {
  const { server, shutdown } = createReviewServer({
    filePath,
    appDistPath: APP_DIST,
    onComments(comments) {
      const formatted =
        `Review comments for \`${filePath}\`:\n\n` +
        comments
          .map((c) => `"${c.quote.slice(0, 80)}${c.quote.length > 80 ? "…" : ""}"\n→ ${c.comment}`)
          .join("\n\n");
      pi.sendUserMessage(formatted);
    },
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://localhost:${port}?file=${encodeURIComponent(filePath)}`;

  return { url, shutdown };
}

export default function piReview(pi: ExtensionAPI) {
  pi.registerCommand("review", {
    description: "Open markdown reviewer in browser. Usage: /review <file>",
    handler: async (args, ctx) => {
      const rawPath = args.trim();
      if (!rawPath) {
        ctx.ui.notify("Usage: /review <path-to-markdown-file>", "warning");
        return;
      }

      const resolved = resolve(ctx.cwd, rawPath);
      if (!resolved.startsWith(ctx.cwd + sep) && resolved !== ctx.cwd) {
        ctx.ui.notify("Path outside working directory", "error");
        return;
      }

      const existing = sessions.get(resolved);
      if (existing) {
        await open(existing.url);
        ctx.ui.notify(`Reviewer already open: ${existing.url}`, "info");
        return;
      }

      ctx.ui.notify(`Starting reviewer for ${rawPath}…`, "info");

      try {
        const session = await startSession(resolved, pi);
        sessions.set(resolved, session);
        await open(session.url);
        ctx.ui.notify(`Reviewer open at ${session.url}`, "info");
      } catch (err) {
        ctx.ui.notify(`Failed to start reviewer: ${String(err)}`, "error");
      }
    },
  });

  pi.on("session_shutdown", async () => {
    for (const session of sessions.values()) {
      await session.shutdown().catch(() => undefined);
    }
    sessions.clear();
  });
}
