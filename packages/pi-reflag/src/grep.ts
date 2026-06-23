/**
 * Translate grep command-line arguments to rg (ripgrep) equivalents.
 *
 * Ported from greprip-rs/src/grg.rs (MIT license, kaofelix).
 */

import type { CommandRewrite } from "./types.js";
import { xargs } from "./xargs.js";

export const grep: CommandRewrite = xargs((command) => {
  if (command.name === "grep") {
    const args = translateGrepArgs(command.args);
    if (args) {
      return { name: "rg", args };
    }
  }
});

const BRE_META = new Set(["(", ")", "{", "}", "|", "+", "?"]);

function convertBreToEre(pattern: string): string {
  let result = "";
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === "\\" && i + 1 < pattern.length && BRE_META.has(pattern[i + 1])) {
      result += pattern[i + 1]; // \( in BRE → ( in ERE
      i += 2;
    } else if (BRE_META.has(pattern[i])) {
      result += `\\${pattern[i]}`; // ( in BRE → \( in ERE
      i++;
    } else {
      result += pattern[i];
      i++;
    }
  }
  return result;
}

function hasExtendedFlag(args: string[]): boolean {
  for (const arg of args) {
    if (arg === "-E" || arg === "--extended-regexp") {
      return true;
    }
    if (arg.startsWith("-") && !arg.startsWith("--") && arg.length > 1 && arg.includes("E")) {
      return true;
    }
  }
  return false;
}

function hasFixedStringsFlag(args: string[]): boolean {
  for (const arg of args) {
    if (arg === "-F" || arg === "--fixed-strings") {
      return true;
    }
    if (arg.startsWith("-") && !arg.startsWith("--") && arg.length > 1 && arg.includes("F")) {
      return true;
    }
  }
  return false;
}

type FlagAction =
  | { kind: "drop" }
  | { kind: "rename"; to: string }
  | { kind: "expand"; to: string[] };

const DROP_SHORT: ReadonlySet<string> = new Set(["-r", "-R", "-E", "-G"]);

const PASSTHROUGH_NO_ARG: ReadonlySet<string> = new Set([
  "-i",
  "-n",
  "-v",
  "-w",
  "-l",
  "-o",
  "-h",
  "-H",
  "-q",
  "-F",
  "-P",
  "--null",
]);

const PASSTHROUGH_WITH_ARG: ReadonlySet<string> = new Set(["-A", "-B", "-C", "-f", "-m"]);

const SHORT_FLAG_ACTIONS: ReadonlyMap<string, FlagAction> = new Map([
  ["-c", { kind: "expand", to: ["-c", "--include-zero"] }],
]);

const LONG_TO_FLAG: ReadonlyMap<string, FlagAction> = new Map([
  ["--ignore-case", { kind: "rename", to: "-i" }],
  ["--line-number", { kind: "rename", to: "-n" }],
  ["--invert-match", { kind: "rename", to: "-v" }],
  ["--word-regexp", { kind: "rename", to: "-w" }],
  ["--files-with-matches", { kind: "rename", to: "-l" }],
  ["--count", { kind: "expand", to: ["-c", "--include-zero"] }],
  ["--only-matching", { kind: "rename", to: "-o" }],
  ["--no-filename", { kind: "rename", to: "-h" }],
  ["--with-filename", { kind: "rename", to: "-H" }],
  ["--quiet", { kind: "rename", to: "-q" }],
  ["--silent", { kind: "rename", to: "-q" }],
  ["--fixed-strings", { kind: "rename", to: "-F" }],
  ["--perl-regexp", { kind: "rename", to: "-P" }],
  ["--extended-regexp", { kind: "drop" }],
  ["--basic-regexp", { kind: "drop" }],
  ["--recursive", { kind: "drop" }],
]);

function applyFlagAction(action: FlagAction, translated: string[]): void {
  switch (action.kind) {
    case "drop":
      break;
    case "rename":
      translated.push(action.to);
      break;
    case "expand":
      translated.push(...action.to);
      break;
    default: {
      const _never: never = action;
      throw new Error(`Unhandled FlagAction kind: ${(_never as FlagAction).kind}`);
    }
  }
}

export function translateGrepArgs(args: string[]): string[] | undefined {
  const fixedStrings = hasFixedStringsFlag(args);
  const extendedRegexp = hasExtendedFlag(args);
  const translated: string[] = [];
  let i = 0;
  let patternSeen = false;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("-") && arg.length > 1 && /^-\d+$/.test(arg)) {
      translated.push("-C", arg.slice(1));
      i++;
      continue;
    }

    if (DROP_SHORT.has(arg)) {
      i++;
      continue;
    }

    if (arg === "-s") {
      translated.push("--no-messages");
      i++;
      continue;
    }

    if (arg.startsWith("--include=")) {
      translated.push("-g", arg.slice("--include=".length));
      i++;
      continue;
    }

    if (arg.startsWith("--exclude=")) {
      translated.push("-g", `!${arg.slice("--exclude=".length)}`);
      i++;
      continue;
    }

    if (arg.startsWith("--exclude-dir=")) {
      translated.push("-g", `!${arg.slice("--exclude-dir=".length)}/`);
      i++;
      continue;
    }

    if (arg.startsWith("--regexp=")) {
      const pattern = arg.slice("--regexp=".length);
      translated.push("-e", fixedStrings || extendedRegexp ? pattern : convertBreToEre(pattern));
      i++;
      continue;
    }

    if (arg === "--color") {
      translated.push("--color=always");
      i++;
      continue;
    }

    if (arg.startsWith("--color=")) {
      translated.push(arg);
      i++;
      continue;
    }

    if (arg.startsWith("--")) {
      if (arg === "--") {
        translated.push(arg);
        i++;
        continue;
      }
      const action = LONG_TO_FLAG.get(arg);
      if (action !== undefined) {
        applyFlagAction(action, translated);
        i++;
        continue;
      }
      if (PASSTHROUGH_NO_ARG.has(arg)) {
        translated.push(arg);
        i++;
        continue;
      }

      // unknown flag - bail
      return undefined;
    }

    if (arg.startsWith("-") && arg.length > 2 && !/^-\d/.test(arg)) {
      for (const c of arg.slice(1)) {
        const flag = `-${c}`;
        if (DROP_SHORT.has(flag)) {
          continue;
        }
        if (flag === "-s") {
          translated.push("--no-messages");
          continue;
        }
        const shortAction = SHORT_FLAG_ACTIONS.get(flag);
        if (shortAction !== undefined) {
          applyFlagAction(shortAction, translated);
          continue;
        }
        if (PASSTHROUGH_NO_ARG.has(flag)) {
          translated.push(flag);
          continue;
        }

        // unknown flag - bail
        return undefined;
      }
      i++;
      continue;
    }

    if (arg === "-e") {
      translated.push("-e");
      if (i + 1 < args.length) {
        i++;
        translated.push(fixedStrings || extendedRegexp ? args[i] : convertBreToEre(args[i]));
      }
      i++;
      continue;
    }

    const shortAction = SHORT_FLAG_ACTIONS.get(arg);
    if (shortAction !== undefined) {
      applyFlagAction(shortAction, translated);
      i++;
      continue;
    }

    if (PASSTHROUGH_NO_ARG.has(arg)) {
      translated.push(arg);
      i++;
      continue;
    }

    if (PASSTHROUGH_WITH_ARG.has(arg)) {
      translated.push(arg);
      if (i + 1 < args.length) {
        i++;
        translated.push(args[i]);
      }
      i++;
      continue;
    }

    if (arg.startsWith("-") && arg.length > 1) {
      // unknown flag - bail
      return undefined;
    }

    if (!patternSeen) {
      translated.push(fixedStrings || extendedRegexp ? arg : convertBreToEre(arg));
      patternSeen = true;
    } else {
      translated.push(arg);
    }
    i++;
  }

  return translated;
}
