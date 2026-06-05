import type { ControlOperator, ParseEntry } from "shell-quote";
import { parse, quote } from "shell-quote";
import { translateFindArgs } from "./find.js";
import { translateGrepArgs } from "./grep.js";

type OpEntry = { op: ControlOperator } | { op: "glob"; pattern: string };

function isOp(entry: ParseEntry): entry is OpEntry {
  return typeof entry === "object" && "op" in entry;
}

function isString(entry: ParseEntry): entry is string {
  return typeof entry === "string";
}

function isSubshell(entry: ParseEntry): boolean {
  return isOp(entry) && (entry.op === "(" || entry.op === ")");
}

type Segment = {
  tokens: string[];
  trailingOp: ControlOperator | null;
};

function splitSegments(entries: ParseEntry[]): Segment[] | null {
  const segments: Segment[] = [];
  let current: string[] = [];

  for (const entry of entries) {
    if (isSubshell(entry)) {
      return null;
    }
    if (isOp(entry)) {
      const op = entry.op === "glob" ? null : entry.op;
      if (op === null) {
        return null;
      }
      segments.push({ tokens: current, trailingOp: op });
      current = [];
    } else if (isString(entry)) {
      current.push(entry);
    } else {
      return null;
    }
  }
  segments.push({ tokens: current, trailingOp: null });
  return segments;
}

function rewriteSegment(
  tokens: string[],
  rewriteGrep: boolean,
  rewriteFind: boolean,
): { tokens: string[]; changed: boolean; unknownFlags: string[] } {
  if (rewriteGrep && tokens[0] === "grep") {
    const { args, unknownFlags } = translateGrepArgs(tokens.slice(1));
    if (unknownFlags.length > 0) return { tokens, changed: false, unknownFlags };
    return { tokens: ["rg", ...args], changed: true, unknownFlags: [] };
  }
  if (rewriteFind && tokens[0] === "find") {
    const { args, unknownFlags } = translateFindArgs(tokens.slice(1));
    if (unknownFlags.length > 0) return { tokens, changed: false, unknownFlags };
    return { tokens: ["fd", ...args], changed: true, unknownFlags: [] };
  }
  return { tokens, changed: false, unknownFlags: [] };
}

function joinSegments(segments: Segment[]): string {
  const parts: string[] = [];
  for (const { tokens, trailingOp } of segments) {
    parts.push(quote(tokens));
    if (trailingOp !== null) {
      parts.push(trailingOp);
    }
  }
  return parts.join(" ");
}

export function rewriteCommand(
  cmd: string,
  { rewriteGrep = true, rewriteFind = true }: { rewriteGrep?: boolean; rewriteFind?: boolean } = {},
): { rewritten: string; changed: boolean; unknownFlags: string[] } {
  let entries: ParseEntry[];
  try {
    entries = parse(cmd);
  } catch {
    return { rewritten: cmd, changed: false, unknownFlags: [] };
  }

  const segments = splitSegments(entries);
  if (segments === null) {
    return { rewritten: cmd, changed: false, unknownFlags: [] };
  }

  let anyChanged = false;
  const allUnknownFlags: string[] = [];
  const rewritten = segments.map((seg) => {
    const result = rewriteSegment(seg.tokens, rewriteGrep, rewriteFind);
    if (result.changed) anyChanged = true;
    allUnknownFlags.push(...result.unknownFlags);
    return { tokens: result.tokens, trailingOp: seg.trailingOp };
  });

  if (!anyChanged) {
    return { rewritten: cmd, changed: false, unknownFlags: allUnknownFlags };
  }

  return { rewritten: joinSegments(rewritten), changed: true, unknownFlags: allUnknownFlags };
}
