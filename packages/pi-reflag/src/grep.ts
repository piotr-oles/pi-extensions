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

function convertBreToEre(pattern: string): string {
  return pattern
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\|/g, "|")
    .replace(/\\\+/g, "+")
    .replace(/\\\?/g, "?")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}");
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

const DROP_SHORT: ReadonlySet<string> = new Set(["-r", "-R", "-E", "-G"]);
const DROP_LONG: ReadonlySet<string> = new Set([
  "--recursive",
  "--extended-regexp",
  "--basic-regexp",
]);

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

const LONG_TO_SHORT: ReadonlyMap<string, string | null> = new Map([
  ["--ignore-case", "-i"],
  ["--line-number", "-n"],
  ["--invert-match", "-v"],
  ["--word-regexp", "-w"],
  ["--files-with-matches", "-l"],
  ["--count", "-c"],
  ["--only-matching", "-o"],
  ["--no-filename", "-h"],
  ["--with-filename", "-H"],
  ["--quiet", "-q"],
  ["--silent", "-q"],
  ["--fixed-strings", "-F"],
  ["--perl-regexp", "-P"],
  ["--extended-regexp", null],
  ["--basic-regexp", null],
  ["--recursive", null],
]);

export function translateGrepArgs(args: string[]): string[] | undefined {
  const fixedStrings = hasFixedStringsFlag(args);
  const trasnlated: string[] = [];
  let i = 0;
  let patternSeen = false;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("-") && arg.length > 1 && /^-\d+$/.test(arg)) {
      trasnlated.push("-C", arg.slice(1));
      i++;
      continue;
    }

    if (DROP_SHORT.has(arg)) {
      i++;
      continue;
    }

    if (arg === "-s") {
      trasnlated.push("--no-messages");
      i++;
      continue;
    }

    if (arg.startsWith("--include=")) {
      trasnlated.push("-g", arg.slice("--include=".length));
      i++;
      continue;
    }

    if (arg.startsWith("--exclude=")) {
      trasnlated.push("-g", `!${arg.slice("--exclude=".length)}`);
      i++;
      continue;
    }

    if (arg.startsWith("--exclude-dir=")) {
      trasnlated.push("-g", `!${arg.slice("--exclude-dir=".length)}/`);
      i++;
      continue;
    }

    if (arg.startsWith("--regexp=")) {
      const pattern = arg.slice("--regexp=".length);
      trasnlated.push("-e", fixedStrings ? pattern : convertBreToEre(pattern));
      i++;
      continue;
    }

    if (arg === "--color") {
      trasnlated.push("--color=always");
      i++;
      continue;
    }

    if (arg.startsWith("--color=")) {
      trasnlated.push(arg);
      i++;
      continue;
    }

    if (arg.startsWith("--")) {
      if (arg === "--") {
        trasnlated.push(arg);
        i++;
        continue;
      }
      if (DROP_LONG.has(arg)) {
        i++;
        continue;
      }
      if (LONG_TO_SHORT.has(arg)) {
        const mapped = LONG_TO_SHORT.get(arg);
        if (mapped === "-c") {
          trasnlated.push("-c", "--include-zero");
        } else if (mapped !== null && mapped !== undefined) {
          trasnlated.push(mapped);
        }
        i++;
        continue;
      }
      if (PASSTHROUGH_NO_ARG.has(arg)) {
        trasnlated.push(arg);
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
          trasnlated.push("--no-messages");
          continue;
        }
        if (flag === "-c") {
          trasnlated.push("-c", "--include-zero");
          continue;
        }
        if (PASSTHROUGH_NO_ARG.has(flag)) {
          trasnlated.push(flag);
          continue;
        }

        // unknown flag - bail
        return undefined;
      }
      i++;
      continue;
    }

    if (arg === "-e") {
      trasnlated.push("-e");
      if (i + 1 < args.length) {
        i++;
        trasnlated.push(fixedStrings ? args[i] : convertBreToEre(args[i]));
      }
      i++;
      continue;
    }

    if (arg === "-c") {
      trasnlated.push("-c", "--include-zero");
      i++;
      continue;
    }

    if (PASSTHROUGH_NO_ARG.has(arg)) {
      trasnlated.push(arg);
      i++;
      continue;
    }

    if (PASSTHROUGH_WITH_ARG.has(arg)) {
      trasnlated.push(arg);
      if (i + 1 < args.length) {
        i++;
        trasnlated.push(args[i]);
      }
      i++;
      continue;
    }

    if (arg.startsWith("-") && arg.length > 1) {
      // unknown flag - bail
      return undefined;
    }

    if (!patternSeen) {
      trasnlated.push(fixedStrings ? arg : convertBreToEre(arg));
      patternSeen = true;
    } else {
      trasnlated.push(arg);
    }
    i++;
  }

  return trasnlated;
}
