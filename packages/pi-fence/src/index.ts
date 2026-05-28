import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type ExtensionAPI,
  isEditToolResult,
  isToolCallEventType,
  isWriteToolResult,
} from "@earendil-works/pi-coding-agent";
import { isFenceComment, removeFenceComments } from "./fence.js";
import { buildBlockReason, buildRemoveText, buildWarnText } from "./messages.js";
import { type CommentNode, extractComments, getCommentHash } from "./parse.js";
import type { Finding } from "./types.js";

const PROMPT_INSTRUCTIONS = `
Do not insert decorative fence or divider comments like:
  // ---- section ----
  // ===== Title =====
  // *** helpers ***
  # ################
Use named functions, classes, or blank lines to separate code sections instead.
`.trim();

type FenceMode = "warn" | "block" | "remove";

function resolveMode(flag: boolean | string | undefined): FenceMode {
  if (flag === "block" || flag === "warn" || flag === "remove") {
    return flag;
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
  const pendingFindings = new Map<string, Finding>();

  pi.on("turn_start", () => {
    pendingFindings.clear();
  });

  pi.on("tool_call", async (event, ctx) => {
    const { signal } = ctx;
    const mode = resolveMode(pi.getFlag("pi-fence-mode"));

    if (isToolCallEventType("write", event)) {
      const { path: relativePath, content: newContent } = event.input;
      const absolutePath = resolve(ctx.cwd, relativePath);
      const oldContent = await readExisting(absolutePath, signal);
      if (signal?.aborted) {
        return undefined;
      }

      // Key existing fences by "text:::line" so that a fence copied or moved
      // to a different line is treated as newly introduced.  Pure text matching
      // would silently ignore any fence whose text already appeared anywhere in
      // the old file, even at a completely different location.
      const existingKeys = new Set(
        oldContent
          ? (await extractComments(oldContent, relativePath, signal)).map(getCommentHash)
          : [],
      );
      if (signal?.aborted) {
        return undefined;
      }
      const fences = (await extractComments(newContent, relativePath, signal)).filter(
        (c) => !existingKeys.has(getCommentHash(c)) && isFenceComment(c.text),
      );

      if (fences.length === 0) {
        return undefined;
      }
      if (mode === "remove") {
        event.input.content = removeFenceComments(event.input.content, fences);
        pendingFindings.set(event.toolCallId, { relativePath, fences });
        return undefined;
      }
      if (mode === "block") {
        return { block: true, reason: buildBlockReason([{ relativePath, fences }]) };
      }

      pendingFindings.set(event.toolCallId, { relativePath, fences });
      return undefined;
    }

    if (isToolCallEventType("edit", event)) {
      const { path: relativePath, edits } = event.input;
      const absolutePath = resolve(ctx.cwd, relativePath);
      const oldContent = await readExisting(absolutePath, signal);
      if (signal?.aborted) {
        return undefined;
      }

      // One pass: compute per-edit fence findings (lines relative to each fragment).
      const perEdit: { edit: (typeof edits)[number]; fences: CommentNode[] }[] = [];
      for (const edit of edits) {
        if (signal?.aborted) {
          return undefined;
        }
        const newComments = await extractComments(edit.newText, relativePath, signal);
        const oldTexts = new Set(
          (await extractComments(edit.oldText, relativePath, signal)).map((c) => c.text),
        );
        const fences = newComments.filter((c) => !oldTexts.has(c.text) && isFenceComment(c.text));
        if (fences.length > 0) {
          perEdit.push({ edit, fences });
        }
      }

      if (perEdit.length === 0) {
        return undefined;
      }

      // Flatten fences with file-level line offsets for all modes.
      const allFences: CommentNode[] = [];
      for (const { edit, fences } of perEdit) {
        const lineOffset = oldContent ? findStartLine(oldContent, edit.oldText) - 1 : 0;
        for (const c of fences) {
          allFences.push({ ...c, startLine: c.startLine + lineOffset });
        }
      }

      if (mode === "remove") {
        for (const { edit, fences } of perEdit) {
          edit.newText = removeFenceComments(edit.newText, fences);
        }
        pendingFindings.set(event.toolCallId, { relativePath, fences: allFences });
        return undefined;
      }

      if (mode === "block") {
        return { block: true, reason: buildBlockReason([{ relativePath, fences: allFences }]) };
      }

      pendingFindings.set(event.toolCallId, { relativePath, fences: allFences });
      return undefined;
    }

    return undefined;
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
    const mode = resolveMode(pi.getFlag("pi-fence-mode"));
    const text = mode === "remove" ? buildRemoveText([finding]) : buildWarnText([finding]);
    const warning: { type: "text"; text: string } = {
      type: "text",
      text,
    };
    return { content: [...event.content, warning] };
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
