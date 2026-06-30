import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { generateSessionTitle } from "./title.js";

export const MAX_TITLE_LENGTH = 40;
export const MIN_PROMPT_LENGTH = 60;
export const PI_TITLE_CUSTOM_TYPE = "pi-title";

export default function piTitle(pi: ExtensionAPI) {
  let autoGenController: AbortController | null;
  let cmdController: AbortController | null;

  pi.on("session_shutdown", () => {
    autoGenController?.abort();
    cmdController?.abort();
    autoGenController = null;
    cmdController = null;
  });

  pi.registerCommand("title", {
    description: "Regenerate session title from recent prompts",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const userPrompts = getRecentUserPrompts(ctx, MIN_PROMPT_LENGTH);

      if (userPrompts.length === 0) {
        throw new Error("No prompts yet — can't generate title.");
      }

      autoGenController?.abort();
      cmdController?.abort();
      cmdController = new AbortController();
      const { signal } = cmdController;

      try {
        const { model, apiKey, headers } = await getModel(ctx);
        const title = await generateSessionTitle({
          userPrompts,
          maxLength: MAX_TITLE_LENGTH,
          model,
          apiKey,
          headers,
          signal,
          previousTitle: pi.getSessionName(),
        });
        if (!title) {
          throw new Error("Model returned empty title.");
        }
        pi.setSessionName(title);
        pi.appendEntry(PI_TITLE_CUSTOM_TYPE, { title });
        ctx.ui.notify(`Title set: "${title}"`);
      } catch (error) {
        if (!signal.aborted) {
          throw error;
        }
      }
    },
  });

  pi.on("before_agent_start", (event, ctx) => {
    const userPrompt = event.prompt.trim();
    if (!userPrompt || isLocked(ctx)) {
      return;
    }

    const userPrompts = [...getRecentUserPrompts(ctx, MIN_PROMPT_LENGTH), userPrompt];
    const totalLength = userPrompts.reduce((sum, p) => sum + p.length, 0);
    const shouldLock = totalLength >= MAX_TITLE_LENGTH;

    autoGenController?.abort();
    autoGenController = new AbortController();
    const { signal } = autoGenController;
    void (async () => {
      try {
        const { model, apiKey, headers } = await getModel(ctx);
        const title = await generateSessionTitle({
          userPrompts,
          maxLength: MAX_TITLE_LENGTH,
          model,
          apiKey,
          headers,
          signal,
          previousTitle: pi.getSessionName(),
        });
        if (title && !signal.aborted) {
          pi.setSessionName(title);
          if (shouldLock) {
            pi.appendEntry(PI_TITLE_CUSTOM_TYPE, { title });
          }
        }
      } catch (error) {
        if (!signal.aborted) {
          ctx.ui.notify(
            `Couldn't auto-generate session title: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    })();
  });
}

interface GetModelResult {
  model: Model<Api>;
  apiKey?: string;
  headers?: Record<string, string>;
}
async function getModel(ctx: ExtensionContext): Promise<GetModelResult> {
  const model = ctx.model;
  if (!model) {
    throw new Error("No model in the context.");
  }
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) {
    throw new Error(`Cannot authenticate the model ${model.provider}/${model.name}.`);
  }

  return { model, apiKey: auth.apiKey, headers: auth.headers };
}

function getRecentUserPrompts(ctx: ExtensionContext, minLength: number): string[] {
  const entries = ctx.sessionManager.getEntries();
  const recent: string[] = [];
  let total = 0;

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type !== "message" || entry.message.role !== "user") {
      continue;
    }

    const text =
      typeof entry.message.content === "string"
        ? entry.message.content
        : entry.message.content
            .filter((content) => content.type === "text")
            .map((content) => content.text)
            .join("\n");

    if (text) {
      recent.push(text);
      total += text.length;
      if (total >= minLength) {
        break;
      }
    }
  }

  return recent.reverse();
}

/**
 * Whether pi-title has finished naming the current session. Derived from the
 * session itself (a persisted custom entry) so it resets automatically on /new,
 * /resume, and /fork instead of leaking across sessions via closure state.
 */
function isLocked(ctx: ExtensionContext): boolean {
  return ctx.sessionManager
    .getEntries()
    .some((entry) => entry.type === "custom" && entry.customType === PI_TITLE_CUSTOM_TYPE);
}
