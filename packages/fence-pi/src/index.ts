import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type ExtensionAPI,
  isEditToolResult,
  isToolCallEventType,
  isWriteToolResult,
} from "@earendil-works/pi-coding-agent";
import { isFenceComment } from "./fence.js";
import { type CommentNode, extractComments } from "./parse.js";

// ─── System prompt ────────────────────────────────────────────────────────────

const PROMPT_INSTRUCTIONS = `
Do not insert decorative fence or divider comments such as:
  // ---- section ----
  // ===== Title =====
  // *** helpers ***
  # ################
Use named functions, classes, or blank lines to separate code sections instead.
`.trim();

// ─── Types ────────────────────────────────────────────────────────────────────

interface Finding {
  relativePath: string;
  fences: CommentNode[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readExisting(absolutePath: string): Promise<string | null> {
  try {
    return await readFile(absolutePath, "utf8");
  } catch {
    return null;
  }
}

/** Line number (1-indexed) where `needle` first appears in `haystack`. */
function findStartLine(haystack: string, needle: string): number {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return 1;
  return haystack.slice(0, idx).split("\n").length;
}

function formatFinding(f: CommentNode): string {
  return `    line ${f.startLine}, col ${f.startCol + 1}: ${f.text.trim()}`;
}

function buildBlockReason(findings: Finding[]): string {
  const lines = ["Write blocked — fence/divider comments in added code:"];
  for (const { relativePath, fences } of findings) {
    lines.push(`  ${relativePath}:`);
    lines.push(...fences.map(formatFinding));
  }
  lines.push("Remove these comments and retry.");
  return lines.join("\n");
}

function buildWarnText(findings: Finding[]): string {
  const lines = ["⚠ fence-pi: fence/divider comments detected in added code:"];
  for (const { relativePath, fences } of findings) {
    lines.push(`  ${relativePath}:`);
    lines.push(...fences.map(formatFinding));
  }
  lines.push("Please remove them.");
  return lines.join("\n");
}

export default function fencePi(pi: ExtensionAPI) {
  pi.registerFlag("fence-pi-block", {
    type: "boolean",
    description: "Block writes/edits that introduce fence/divider comments (default: warn only)",
    default: false,
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
    const isBlockMode = pi.getFlag("fence-pi-block") === true;

    // ── write ──────────────────────────────────────────────────────────────
    if (isToolCallEventType("write", event)) {
      const { path: relativePath, content: newContent } = event.input;
      const absolutePath = resolve(ctx.cwd, relativePath);
      const oldContent = await readExisting(absolutePath);

      const existingTexts = new Set(
        oldContent ? (await extractComments(oldContent, relativePath)).map((c) => c.text) : [],
      );
      const fences = (await extractComments(newContent, relativePath)).filter(
        (c) => !existingTexts.has(c.text) && isFenceComment(c.text),
      );

      if (fences.length === 0) return undefined;
      if (isBlockMode) return { block: true, reason: buildBlockReason([{ relativePath, fences }]) };

      pendingFindings.set(event.toolCallId, { relativePath, fences });
      return undefined;
    }

    // ── edit ───────────────────────────────────────────────────────────────
    if (isToolCallEventType("edit", event)) {
      const { path: relativePath, edits } = event.input;
      const absolutePath = resolve(ctx.cwd, relativePath);
      const oldContent = await readExisting(absolutePath);
      const fences: CommentNode[] = [];

      for (const edit of edits) {
        const newComments = await extractComments(edit.newText, relativePath);
        const oldTexts = new Set(
          (await extractComments(edit.oldText, relativePath)).map((c) => c.text),
        );
        const lineOffset = oldContent ? findStartLine(oldContent, edit.oldText) - 1 : 0;

        for (const c of newComments) {
          if (!oldTexts.has(c.text) && isFenceComment(c.text)) {
            fences.push({ ...c, startLine: c.startLine + lineOffset });
          }
        }
      }

      if (fences.length === 0) return undefined;
      if (isBlockMode) return { block: true, reason: buildBlockReason([{ relativePath, fences }]) };

      pendingFindings.set(event.toolCallId, { relativePath, fences });
      return undefined;
    }

    return undefined;
  });

  pi.on("tool_result", async (event) => {
    if (!isWriteToolResult(event) && !isEditToolResult(event)) return undefined;

    const finding = pendingFindings.get(event.toolCallId);
    if (!finding) return undefined;

    pendingFindings.delete(event.toolCallId);

    // Append the warning to the tool result content so the model sees it
    // inline, alongside the write confirmation, without a separate turn.
    const warning: { type: "text"; text: string } = {
      type: "text",
      text: buildWarnText([finding]),
    };
    return { content: [...event.content, warning] };
  });
}
