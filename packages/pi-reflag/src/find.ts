/**
 * Translate find command-line arguments to fd equivalents.
 *
 * Ported from:
 *   - kaofelix/greprip-rs src/fnd.rs (MIT)
 *   - kluzzebass/reflag translator/find2fd/translator.go (MIT)
 */
import type { CommandRewrite } from "./types.js";
import { xargs } from "./xargs.js";

export type IgnoreMode = "ignore" | "no-ignore" | "auto";

export const KNOWN_IGNORED_DIRS: string[] = [
  // Node.js / JavaScript package managers
  "node_modules",
  ".yarn",
  ".pnpm-store",

  // Bundler / tool caches
  ".parcel-cache",
  ".turbo",
  ".vite",
  ".cache",
  ".eslintcache",
  ".stylelintcache",

  // Framework build outputs
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".vuepress",
  ".output",
  ".docusaurus",
  ".temp",
  ".serverless",
  ".firebase",

  // Generic build outputs
  "dist",
  "build",
  "out",
  "target",
  "debug",
  "obj",
  "artifacts",
  "_deps",
  "CMakeFiles",

  // Test coverage
  "coverage",
  ".nyc_output",
  ".hypothesis",

  // Python
  "__pycache__",
  ".pytest_cache",
  ".tox",
  ".nox",
  ".venv",
  "venv",
  ".ipynb_checkpoints",

  // Ruby / PHP
  "vendor",
  ".bundle",

  // JVM build tools
  ".gradle",
  ".mvn",

  // Elixir
  "_build",
  "deps",

  // Version control internals
  ".git",
];

export function shouldDisableIgnore(paths: string[], mode: IgnoreMode): boolean {
  if (mode === "no-ignore") {
    return true;
  }
  if (mode === "ignore") {
    return false;
  }
  const ignoredSet = new Set(KNOWN_IGNORED_DIRS);
  return paths.some((p) => p.split(/[/\\]/).some((component) => ignoredSet.has(component)));
}

export function createFind(ignoreMode: IgnoreMode): CommandRewrite {
  return xargs((command) => {
    if (command.name === "find") {
      const args = translateFindArgs(command.args, ignoreMode);
      if (args) {
        return { name: "fd", args };
      }
    }
  });
}

function translateDuration(val: string, unit: "d" | "min"): string[] | undefined {
  if (val.startsWith("-")) {
    return ["--changed-within", `${val.slice(1)}${unit}`];
  }
  if (val.startsWith("+")) {
    return ["--changed-before", `${val.slice(1)}${unit}`];
  }
  // Unsigned means "exactly N days/mins ago" — fd has no equivalent, bail
  return undefined;
}

function translateSize(val: string): string | undefined {
  // find 'c' = bytes; fd 'b' = bytes
  if (val.endsWith("c")) {
    return `${val.slice(0, -1)}b`;
  }
  // find 'k' = 512-byte blocks; fd 'k' = 1024 bytes — semantically different, bail
  if (val.endsWith("k")) {
    return undefined;
  }
  return val;
}

function parseExecArgs(
  args: string[],
  startIndex: number,
): { execArgs: string[]; isBatch: boolean; endIndex: number } {
  const execArgs: string[] = [];
  let i = startIndex;
  let isBatch = false;
  while (i < args.length) {
    if (args[i] === ";" || args[i] === "\\;") {
      i++;
      break;
    }
    if (args[i] === "+") {
      isBatch = true;
      i++;
      break;
    }
    execArgs.push(args[i]);
    i++;
  }
  return { execArgs, isBatch, endIndex: i };
}

function collectLeadingOptions(args: string[]): { options: string[]; cursor: number } {
  const options: string[] = [];
  let cursor = 0;
  while (cursor < args.length) {
    const arg = args[cursor];
    if (arg === "-L" || arg === "-follow") {
      options.push("-L");
      cursor++;
    } else if (arg === "-H" || arg === "-P") {
      cursor++;
    } else {
      break;
    }
  }
  return { options, cursor };
}

function collectPaths(args: string[], cursor: number): { paths: string[]; cursor: number } {
  const paths: string[] = [];
  while (cursor < args.length) {
    const arg = args[cursor];
    if (arg.startsWith("-") || arg === "!" || arg === "(" || arg === ")") {
      break;
    }
    // skip "." — fd defaults to current directory
    if (arg !== ".") {
      paths.push(arg);
    }
    cursor++;
  }
  return { paths, cursor };
}

interface ExpressionResult {
  translated: string[];
  globPatterns: string[];
  regexPattern: string | null;
  execArgs: string[];
  caseInsensitive: boolean;
  hasIname: boolean;
  hasName: boolean;
}

function translateExpressions(args: string[], cursor: number): ExpressionResult | undefined {
  const translated: string[] = [];
  const globPatterns: string[] = [];
  let regexPattern: string | null = null;
  const execArgs: string[] = [];
  let caseInsensitive = false;
  let hasIname = false;
  let hasName = false;

  let i = cursor;

  while (i < args.length) {
    const arg = args[i];

    if (
      arg === "(" ||
      arg === ")" ||
      arg === "-o" ||
      arg === "-or" ||
      arg === "-a" ||
      arg === "-and"
    ) {
      i++;
      continue;
    }

    // ! -name PAT or -not -name PAT → exclude glob pattern
    if ((arg === "!" || arg === "-not") && i + 2 < args.length && args[i + 1] === "-name") {
      translated.push("-E", args[i + 2]);
      i += 3;
      continue;
    }

    // ! -path PAT or -not -path PAT → strip glob anchors and exclude
    if ((arg === "!" || arg === "-not") && i + 2 < args.length && args[i + 1] === "-path") {
      const pat = args[i + 2]
        .replace(/^\.\//, "")
        .replace(/^\*\//, "")
        .replace(/\/\*$/, "")
        .replace(/\*$/, "");
      translated.push("-E", pat);
      i += 3;
      continue;
    }

    // ! or -not followed by anything other than -name/-path → bail
    if (arg === "!" || arg === "-not") {
      return undefined;
    }

    if (arg === "-name" && i + 1 < args.length) {
      hasName = true;
      globPatterns.push(args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-iname" && i + 1 < args.length) {
      hasIname = true;
      caseInsensitive = true;
      globPatterns.push(args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-regex" && i + 1 < args.length) {
      regexPattern = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === "-iregex" && i + 1 < args.length) {
      caseInsensitive = true;
      regexPattern = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === "-type" && i + 1 < args.length) {
      translated.push("-t", args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-maxdepth" && i + 1 < args.length) {
      translated.push("-d", args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-mindepth" && i + 1 < args.length) {
      translated.push("--min-depth", args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-size" && i + 1 < args.length) {
      const sizeVal = translateSize(args[i + 1]);
      if (sizeVal === undefined) {
        return undefined;
      }
      translated.push("-S", sizeVal);
      i += 2;
      continue;
    }

    if (arg === "-newer" && i + 1 < args.length) {
      translated.push("--newer", args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-mtime" && i + 1 < args.length) {
      const dur = translateDuration(args[i + 1], "d");
      if (!dur) {
        return undefined;
      }
      translated.push(...dur);
      i += 2;
      continue;
    }

    // -atime and -ctime track access/inode-change time; fd only tracks mtime → bail
    if (arg === "-atime" || arg === "-ctime") {
      return undefined;
    }

    if (arg === "-mmin" && i + 1 < args.length) {
      const dur = translateDuration(args[i + 1], "min");
      if (!dur) {
        return undefined;
      }
      translated.push(...dur);
      i += 2;
      continue;
    }

    // -amin and -cmin track access/inode-change time; fd only tracks mtime → bail
    if (arg === "-amin" || arg === "-cmin") {
      return undefined;
    }

    if (arg === "-user" && i + 1 < args.length) {
      translated.push("--owner", args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-group" && i + 1 < args.length) {
      translated.push("--owner", `:${args[i + 1]}`);
      i += 2;
      continue;
    }

    if (arg === "-path" && i + 1 < args.length) {
      if (i + 2 < args.length && args[i + 2] === "-prune") {
        // -path PAT -prune → exclude directory: strip leading ./, */ and trailing /*, *
        const pat = args[i + 1]
          .replace(/^\.\//, "")
          .replace(/^\*\//, "")
          .replace(/\/\*$/, "")
          .replace(/\*$/, "");
        translated.push("-E", pat);
        i += 3;
        if (i < args.length && (args[i] === "-o" || args[i] === "-or")) {
          i++;
        }
      } else {
        translated.push("-p", args[i + 1]);
        i += 2;
      }
      continue;
    }

    if (arg === "-perm" && i + 1 < args.length) {
      // no fd equivalent — silently dropping would change semantics → bail
      return undefined;
    }

    // -delete has no fd equivalent and silently dropping it would be wrong → bail
    if (arg === "-delete") {
      return undefined;
    }

    if (arg === "-exec" || arg === "-execdir") {
      const { execArgs: cmdArgs, isBatch, endIndex } = parseExecArgs(args, i + 1);
      execArgs.push(isBatch ? "-X" : "-x", ...cmdArgs);
      i = endIndex;
      continue;
    }

    if (arg === "-print0") {
      translated.push("-0");
      i++;
      continue;
    }
    if (arg === "-print") {
      i++;
      continue;
    }
    if (arg === "-L" || arg === "-follow") {
      translated.push("-L");
      i++;
      continue;
    }
    if (arg === "-H" || arg === "-P") {
      i++;
      continue;
    }
    if (arg === "-empty") {
      translated.push("-t", "e");
      i++;
      continue;
    }
    if (arg === "-executable") {
      translated.push("-t", "x");
      i++;
      continue;
    }
    if (arg === "-xdev" || arg === "-mount") {
      translated.push("--one-file-system");
      i++;
      continue;
    }
    if (arg === "-quit") {
      translated.push("-1");
      i++;
      continue;
    }
    if (arg === "-prune" || arg === "-depth" || arg === "-daystart") {
      i++;
      continue;
    }

    // unknown expression - bail
    if (arg.startsWith("-")) {
      return undefined;
    }
    i++;
  }

  return { translated, globPatterns, regexPattern, execArgs, caseInsensitive, hasIname, hasName };
}

export function translateFindArgs(
  args: string[],
  ignoreMode: IgnoreMode = "auto",
): string[] | undefined {
  const result: string[] = ["-H"];

  const leadingForPaths = collectLeadingOptions(args);
  const pathsForDetection = collectPaths(args, leadingForPaths.cursor).paths;
  if (shouldDisableIgnore(pathsForDetection, ignoreMode)) {
    result.push("--no-ignore");
  }

  const leading = collectLeadingOptions(args);
  result.push(...leading.options);

  const pathsResult = collectPaths(args, leading.cursor);
  const { paths } = pathsResult;

  const exprResult = translateExpressions(args, pathsResult.cursor);
  if (!exprResult) {
    return undefined;
  }

  const { translated, globPatterns, regexPattern, execArgs, caseInsensitive, hasIname, hasName } =
    exprResult;

  // fd can't do per-pattern case sensitivity → bail when -iname and -name are mixed
  if (hasIname && hasName) {
    return undefined;
  }

  // Comma in any pattern would corrupt brace expansion → bail
  if (globPatterns.some((p) => p.includes(","))) {
    return undefined;
  }

  result.push(...translated);

  if (caseInsensitive) {
    result.push("-i");
  }

  // glob patterns take priority over regex pattern
  if (globPatterns.length === 1) {
    result.push("-g", globPatterns[0]);
  } else if (globPatterns.length > 1) {
    result.push("-g", `{${globPatterns.join(",")}}`);
  } else if (regexPattern !== null) {
    result.push(regexPattern);
  } else if (paths.length > 0) {
    // fd requires a pattern before path args; "." matches everything
    result.push(".");
  }

  result.push(...paths);
  result.push(...execArgs);

  return result;
}
