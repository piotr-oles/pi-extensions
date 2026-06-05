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
): { tokens: string[]; changed: boolean } {
  if (rewriteGrep && tokens[0] === "grep") {
    return { tokens: ["rg", ...translateGrepArgs(tokens.slice(1))], changed: true };
  }
  if (rewriteFind && tokens[0] === "find") {
    return { tokens: ["fd", ...translateFindArgs(tokens.slice(1))], changed: true };
  }
  return { tokens, changed: false };
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
): { rewritten: string; changed: boolean } {
  let entries: ParseEntry[];
  try {
    entries = parse(cmd);
  } catch {
    return { rewritten: cmd, changed: false };
  }

  const segments = splitSegments(entries);
  if (segments === null) {
    return { rewritten: cmd, changed: false };
  }

  let anyChanged = false;
  const rewritten = segments.map((seg) => {
    const result = rewriteSegment(seg.tokens, rewriteGrep, rewriteFind);
    if (result.changed) {
      anyChanged = true;
    }
    return { tokens: result.tokens, trailingOp: seg.trailingOp };
  });

  if (!anyChanged) {
    return { rewritten: cmd, changed: false };
  }

  return { rewritten: joinSegments(rewritten), changed: true };
}
