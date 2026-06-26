import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { generateSessionTitle } from "./title.js";

export const MAX_TITLE_LENGTH = 40;
export const MIN_PROMPT_LENGTH = 60;

interface SessionTitleState {
  hasNamed: boolean;
  currentTitle: string | undefined;
  autoGenController: AbortController | null;
  cmdController: AbortController | null;
}

function createSessionState(): SessionTitleState {
  return {
    hasNamed: false,
    currentTitle: undefined,
    autoGenController: null,
    cmdController: null,
  };
}

export default function piTitle(pi: ExtensionAPI) {
  const state = createSessionState();

  pi.registerCommand("title", {
    description: "Regenerate session title from recent prompts",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const userPrompts = getRecentUserPrompts(ctx, MIN_PROMPT_LENGTH);

      if (userPrompts.length === 0) {
        throw new Error("No prompts yet — can't generate title.");
      }

      state.autoGenController?.abort();
      state.cmdController?.abort();
      state.cmdController = new AbortController();
      const { signal } = state.cmdController;

      try {
        const title = await generateSessionTitle({
          userPrompts,
          maxLength: MAX_TITLE_LENGTH,
          model: getModel(ctx),
          signal,
          previousTitle: state.currentTitle,
        });
        if (!title) {
          throw new Error("Model returned empty title.");
        }
        state.currentTitle = title;
        pi.setSessionName(title);
        ctx.ui.notify(`Title set: "${title}"`);
        state.hasNamed = true;
      } catch (error) {
        if (!signal.aborted) {
          throw error;
        }
      }
    },
  });

  pi.on("before_agent_start", (event, ctx) => {
    const userPrompt = event.prompt.trim();
    if (!userPrompt || state.hasNamed) {
      return;
    }

    const userPrompts = [...getRecentUserPrompts(ctx, MIN_PROMPT_LENGTH), userPrompt];

    state.autoGenController?.abort();
    state.autoGenController = new AbortController();
    const { signal } = state.autoGenController;
    void (async () => {
      try {
        const title = await generateSessionTitle({
          userPrompts,
          maxLength: MAX_TITLE_LENGTH,
          model: getModel(ctx),
          signal,
          previousTitle: state.currentTitle,
        });
        if (title) {
          state.currentTitle = title;
          pi.setSessionName(title);
        }
      } catch (error) {
        if (!signal.aborted) {
          ctx.ui.notify(
            `Couldn't auto-generate session title: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    })();

    const totalLength = userPrompts.reduce((sum, p) => sum + p.length, 0);
    if (totalLength >= MAX_TITLE_LENGTH) {
      state.hasNamed = true;
    }
  });
}

function getModel(ctx: ExtensionContext): Model<Api> {
  const model = ctx.model;
  if (!model) {
    throw new Error("No model in the context.");
  }
  return model;
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
