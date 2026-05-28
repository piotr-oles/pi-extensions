import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type ExtensionAPI,
  isEditToolResult,
  isToolCallEventType,
  isWriteToolResult,
} from "@earendil-works/pi-coding-agent";
import { applyEdits } from "./edit.js";
import { getFenceComments, removeFenceComments } from "./fence.js";
import { getLanguageDefinition } from "./languages/index.js";
import { buildBlockReason, buildRemoveText, buildWarnText } from "./messages.js";
import { getMode } from "./mode.js";
import type { CommentNode, FencesFinding } from "./types.js";

const PROMPT_INSTRUCTIONS = `
Do not insert decorative fence comments like:
  // ---- section ----
  // ===== Title =====
  // *** helpers ***
  # ################
Code-smell, if needed, extract to function or file instead. 
`.trim();

export default function piFence(pi: ExtensionAPI) {
  pi.registerFlag("pi-fence-mode", {
    type: "string",
    description: "How to handle fence/divider comments: warn (default), block, or remove",
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

      // Detect fence comments per edit. When the file exists we parse the
      // full patched content so tree-sitter has complete surrounding context
      // (string literals, template literals, block comments), preventing
      // false positives from fragments that only look like comments in
      // isolation. When the file cannot be read we fall back to parsing each
      // newText fragment individually.
      //
      // perEditFences[i] holds fences whose line numbers are 0-indexed
      // relative to the start of edits[i].newText.
      // fileLineOffset[i] is the 0-indexed line in the file where newText starts,
      // used to build the file-level positions shown in messages.
      const perEditFences: CommentNode[][] = edits.map(() => []);
      const fileLineOffset: number[] = edits.map(() => 0);

      if (oldContent !== null) {
        const { content: patchedContent, editRanges } = applyEdits(oldContent, edits);

        const allFencesInPatched = await getFenceComments(patchedContent, def, signal);
        if (signal?.aborted) {
          return undefined;
        }

        for (let i = 0; i < edits.length; i++) {
          const r = editRanges[i];
          fileLineOffset[i] = r.startLine;
          perEditFences[i] = allFencesInPatched
            .filter((f) => f.startLine >= r.startLine && f.startLine <= r.endLine)
            .map((f) => ({
              ...f,
              startLine: f.startLine - r.startLine,
              endLine: f.endLine - r.startLine,
            }));
        }
      } else {
        for (let i = 0; i < edits.length; i++) {
          if (signal?.aborted) {
            return undefined;
          }
          perEditFences[i] = await getFenceComments(edits[i].newText, def, signal);
        }
      }

      if (perEditFences.every((fences) => fences.length === 0)) {
        return undefined;
      }

      // Lift per-edit fences to file-level positions for reporting.
      const allFences = edits.flatMap((_, i) =>
        perEditFences[i].map((f) => ({ ...f, startLine: f.startLine + fileLineOffset[i] })),
      );

      switch (mode) {
        case "warn":
          pendingFindings.set(event.toolCallId, { path, fences: allFences });
          return undefined;
        case "block":
          return { block: true, reason: buildBlockReason([{ path, fences: allFences }]) };
        case "remove":
          for (let i = 0; i < edits.length; i++) {
            if (perEditFences[i].length > 0) {
              edits[i].newText = removeFenceComments(edits[i].newText, perEditFences[i]);
            }
          }
          pendingFindings.set(event.toolCallId, { path, fences: allFences });
          return undefined;
      }
    }
  });

  pi.on("tool_result", async (event, ctx) => {
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
      case "remove": {
        const n = finding.fences.length;
        ctx.ui.notify(
          `Removed ${n} fence ${n === 1 ? "comment" : "comments"}, agent notified.`,
          "info",
        );
        return { content: [...event.content, { type: "text", text: buildRemoveText([finding]) }] };
      }
      case "warn": {
        const n = finding.fences.length;
        ctx.ui.notify(
          `Detected ${n} fence ${n === 1 ? "comment" : "comments"}, agent asked to remove.`,
          "info",
        );
        return { content: [...event.content, { type: "text", text: buildWarnText([finding]) }] };
      }
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
