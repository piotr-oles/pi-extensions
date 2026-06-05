/**
 * Translate grep command-line arguments to rg (ripgrep) equivalents.
 *
 * Ported from greprip-rs/src/grg.rs (MIT license, kaofelix).
 */

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
  "-c",
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

export function translateGrepArgs(args: string[]): { args: string[]; unknownFlags: string[] } {
  const fixedStrings = hasFixedStringsFlag(args);
  const result: string[] = [];
  const unknownFlags: string[] = [];
  let i = 0;
  let patternSeen = false;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("-") && arg.length > 1 && /^-\d+$/.test(arg)) {
      result.push("-C", arg.slice(1));
      i++;
      continue;
    }

    if (DROP_SHORT.has(arg)) {
      i++;
      continue;
    }

    if (arg === "-s") {
      result.push("--no-messages");
      i++;
      continue;
    }

    if (arg.startsWith("--include=")) {
      result.push("-g", arg.slice("--include=".length));
      i++;
      continue;
    }

    if (arg.startsWith("--exclude=")) {
      result.push("-g", `!${arg.slice("--exclude=".length)}`);
      i++;
      continue;
    }

    if (arg.startsWith("--exclude-dir=")) {
      result.push("-g", `!${arg.slice("--exclude-dir=".length)}/`);
      i++;
      continue;
    }

    if (arg.startsWith("--regexp=")) {
      const pattern = arg.slice("--regexp=".length);
      result.push("-e", fixedStrings ? pattern : convertBreToEre(pattern));
      i++;
      continue;
    }

    if (arg === "--color") {
      result.push("--color=always");
      i++;
      continue;
    }

    if (arg.startsWith("--color=")) {
      result.push(arg);
      i++;
      continue;
    }

    if (arg.startsWith("--")) {
      if (arg === "--") {
        result.push(arg);
        i++;
        continue;
      }
      if (DROP_LONG.has(arg)) {
        i++;
        continue;
      }
      if (LONG_TO_SHORT.has(arg)) {
        const mapped = LONG_TO_SHORT.get(arg);
        if (mapped !== null && mapped !== undefined) {
          result.push(mapped);
        }
        i++;
        continue;
      }
      if (PASSTHROUGH_NO_ARG.has(arg)) {
        result.push(arg);
        i++;
        continue;
      }
      unknownFlags.push(arg);
      i++;
      continue;
    }

    if (arg.startsWith("-") && arg.length > 2 && !/^-\d/.test(arg)) {
      for (const c of arg.slice(1)) {
        const flag = `-${c}`;
        if (DROP_SHORT.has(flag)) {
          continue;
        }
        if (flag === "-s") {
          result.push("--no-messages");
          continue;
        }
        if (PASSTHROUGH_NO_ARG.has(flag)) {
          result.push(flag);
          continue;
        }
        unknownFlags.push(flag);
      }
      i++;
      continue;
    }

    if (arg === "-e") {
      result.push("-e");
      if (i + 1 < args.length) {
        i++;
        result.push(fixedStrings ? args[i] : convertBreToEre(args[i]));
      }
      i++;
      continue;
    }

    if (PASSTHROUGH_NO_ARG.has(arg)) {
      result.push(arg);
      i++;
      continue;
    }

    if (PASSTHROUGH_WITH_ARG.has(arg)) {
      result.push(arg);
      if (i + 1 < args.length) {
        i++;
        result.push(args[i]);
      }
      i++;
      continue;
    }

    if (arg.startsWith("-") && arg.length > 1) {
      unknownFlags.push(arg);
      i++;
      continue;
    }

    if (!patternSeen) {
      result.push(fixedStrings ? arg : convertBreToEre(arg));
      patternSeen = true;
    } else {
      result.push(arg);
    }
    i++;
  }

  return { args: result, unknownFlags };
}
