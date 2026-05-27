import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isFenceComment } from "./fence.js";
import { type CommentNode, extractComments } from "./parse.js";
import { loadMode } from "./settings.js";

// ─── System prompt ────────────────────────────────────────────────────────────

const PROMPT_INSTRUCTIONS = `
Do not insert decorative fence or divider comments such as:
  // ---- section ----
  // ===== Title =====
  // *** helpers ***
  # ################
Use named functions, classes, or blank lines to separate code sections instead.
`.trim();

// ─── Per-turn batch accumulator ───────────────────────────────────────────────

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

function buildWarnMessage(findings: Finding[]): string {
  const lines = ["⚠ fence-pi: fence/divider comments detected in added code:"];
  for (const { relativePath, fences } of findings) {
    lines.push(`  ${relativePath}:`);
    lines.push(...fences.map(formatFinding));
  }
  lines.push("Please remove them.");
  return lines.join("\n");
}

// ─── Extension ────────────────────────────────────────────────────────────────

export default function fencePi(pi: ExtensionAPI) {
  pi.registerFlag("fence-pi-block", {
    type: "boolean",
    description: "Block writes/edits that introduce fence/divider comments (default: warn only)",
    default: false,
  });

  pi.on("before_agent_start", async (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${PROMPT_INSTRUCTIONS}`,
  }));

  // Per-turn batch accumulator for warn mode.
  // tool_call handlers for a single turn can fire concurrently, so we collect
  // all findings and flush them in one steer message via a setTimeout(0).
  let pendingFindings: Finding[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleFlush(): void {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (pendingFindings.length === 0) return;
      const message = buildWarnMessage(pendingFindings);
      pendingFindings = [];
      pi.sendUserMessage(message, { deliverAs: "steer" });
    }, 0);
  }

  // Reset batch at the start of each new turn.
  pi.on("turn_start", () => {
    pendingFindings = [];
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return undefined;

    const relativePath = event.input.path as string;
    const absolutePath = resolve(ctx.cwd, relativePath);
    const mode = await loadMode(pi, ctx.cwd);

    // ── write ──────────────────────────────────────────────────────────────
    if (event.toolName === "write") {
      const newContent = event.input.content as string;
      const oldContent = await readExisting(absolutePath);

      // Build set of comment texts that already exist in the file.
      const existingTexts = new Set(
        oldContent ? (await extractComments(oldContent, relativePath)).map((c) => c.text) : [],
      );

      const allComments = await extractComments(newContent, relativePath);
      const fences = allComments.filter(
        (c) => !existingTexts.has(c.text) && isFenceComment(c.text),
      );

      if (fences.length === 0) return undefined;

      if (mode === "block") {
        return { block: true, reason: buildBlockReason([{ relativePath, fences }]) };
      }

      pendingFindings.push({ relativePath, fences });
      scheduleFlush();
      return undefined;
    }

    // ── edit ───────────────────────────────────────────────────────────────
    const edits = (event.input as { edits: Array<{ oldText: string; newText: string }> }).edits;
    const oldContent = await readExisting(absolutePath);
    const fences: CommentNode[] = [];

    for (const edit of edits) {
      const newComments = await extractComments(edit.newText, relativePath);
      const oldTexts = new Set(
        (await extractComments(edit.oldText, relativePath)).map((c) => c.text),
      );

      // Compute absolute line offset from where oldText sits in the file.
      const lineOffset = oldContent ? findStartLine(oldContent, edit.oldText) - 1 : 0;

      for (const c of newComments) {
        if (!oldTexts.has(c.text) && isFenceComment(c.text)) {
          fences.push({ ...c, startLine: c.startLine + lineOffset });
        }
      }
    }

    if (fences.length === 0) return undefined;

    if (mode === "block") {
      return { block: true, reason: buildBlockReason([{ relativePath, fences }]) };
    }

    pendingFindings.push({ relativePath, fences });
    scheduleFlush();
    return undefined;
  });
}
