import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type ExtensionAPI,
  isEditToolResult,
  isToolCallEventType,
  isWriteToolResult,
} from "@earendil-works/pi-coding-agent";
import { getFenceComments, removeFenceComments } from "./fence.js";
import { getLanguageDefinition } from "./languages/index.js";
import { buildBlockReason, buildRemoveText, buildWarnText } from "./messages.js";
import type { CommentNode, FencesFinding } from "./types.js";

const PROMPT_INSTRUCTIONS = `
Do not insert decorative fence or divider comments like:
  // ---- section ----
  // ===== Title =====
  // *** helpers ***
  # ################
Use named functions, classes, or blank lines to separate code sections instead.
`.trim();

type FenceMode = "warn" | "block" | "remove";

function getMode(pi: ExtensionAPI): FenceMode {
  const flag = pi.getFlag("pi-fence-mode");
  if (flag === "block" || flag === "warn" || flag === "remove") {
    return flag;
  }
  // alias for remove
  if (flag === "delete") {
    return "remove";
  }
  return "warn";
}

export default function piFence(pi: ExtensionAPI) {
  pi.registerFlag("pi-fence-mode", {
    type: "string",
    description: "How to handle fence/divider comments: warn (default), block, or remove",
    default: "warn",
  });

  pi.on("before_agent_start", async (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${PROMPT_INSTRUCTIONS}`,
  }));

  // Findings detected in tool_call (before the write), keyed by toolCallId.
  // Consumed in tool_result (after the write) to append the warning inline.
  // Reset on turn_start to guard against aborted turns leaking state.
  const pendingFindings = new Map<string, FencesFinding>();

  pi.on("turn_start", () => {
    pendingFindings.clear();
  });

  pi.on("tool_call", async (event, ctx) => {
    const { signal } = ctx;
    const mode = getMode(pi);

    if (isToolCallEventType("write", event)) {
      const { path, content: newContent } = event.input;
      const def = getLanguageDefinition(path);
      if (!def) {
        return undefined;
      }
      const fences = await getFenceComments(newContent, def, signal);
      if (fences.length === 0) {
        return undefined;
      }
      if (mode === "remove") {
        event.input.content = removeFenceComments(event.input.content, fences);
        pendingFindings.set(event.toolCallId, { path: path, fences });
        return undefined;
      }
      if (mode === "block") {
        return { block: true, reason: buildBlockReason([{ path, fences }]) };
      }

      pendingFindings.set(event.toolCallId, { path: path, fences });
      return undefined;
    }

    if (isToolCallEventType("edit", event)) {
      const { path, edits } = event.input;
      const def = getLanguageDefinition(path);
      if (!def) {
        return undefined;
      }

      const oldContent = await readExisting(resolve(ctx.cwd, path), signal);
      if (signal?.aborted) {
        return undefined;
      }

      // One pass: compute per-edit fence findings (lines relative to each fragment).
      const perEdit: { edit: (typeof edits)[number]; fences: CommentNode[] }[] = [];
      for (const edit of edits) {
        if (signal?.aborted) {
          return undefined;
        }
        const fences = await getFenceComments(edit.newText, def, signal);
        if (fences.length > 0) {
          perEdit.push({ edit, fences });
        }
      }

      if (perEdit.length === 0) {
        return undefined;
      }

      // Flatten fences with file-level line offsets for all modes.
      const allFences = perEdit.flatMap(({ fences, edit }) => {
        const lineOffset = oldContent ? findStartLine(oldContent, edit.oldText) - 1 : 0;
        return fences.map((c) => ({ ...c, startLine: c.startLine + lineOffset }));
      });

      switch (mode) {
        case "warn":
          pendingFindings.set(event.toolCallId, { path, fences: allFences });
          return undefined;
        case "block":
          return { block: true, reason: buildBlockReason([{ path, fences: allFences }]) };
        case "remove":
          for (const { edit, fences } of perEdit) {
            edit.newText = removeFenceComments(edit.newText, fences);
          }
          pendingFindings.set(event.toolCallId, { path, fences: allFences });
          return undefined;
      }
    }
  });

  pi.on("tool_result", async (event) => {
    if (!isWriteToolResult(event) && !isEditToolResult(event)) {
      return undefined;
    }

    const finding = pendingFindings.get(event.toolCallId);
    if (!finding) {
      return undefined;
    }

    pendingFindings.delete(event.toolCallId);

    // Append the warning to the tool result content so the model sees it
    // inline, alongside the write confirmation, without a separate turn.
    const mode = getMode(pi);
    switch (mode) {
      case "remove":
        return { content: [...event.content, { type: "text", text: buildRemoveText([finding]) }] };
      case "warn":
        return { content: [...event.content, { type: "text", text: buildWarnText([finding]) }] };
      case "block":
        return undefined;
    }
  });
}

async function readExisting(absolutePath: string, signal?: AbortSignal): Promise<string | null> {
  try {
    return await readFile(absolutePath, { encoding: "utf8", signal });
  } catch {
    return null;
  }
}

/** Line number (1-indexed) where `needle` first appears in `haystack`. */
function findStartLine(haystack: string, needle: string): number {
  const idx = haystack.indexOf(needle);
  if (idx === -1) {
    return 1;
  }
  return haystack.slice(0, idx).split("\n").length;
}
