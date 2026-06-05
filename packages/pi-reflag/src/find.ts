/**
 * Translate find command-line arguments to fd equivalents.
 *
 * Ported from:
 *   - kaofelix/greprip-rs src/fnd.rs (MIT)
 *   - kluzzebass/reflag translator/find2fd/translator.go (MIT)
 */

function translateDays(val: string): string[] {
  if (val.startsWith("-")) return ["--changed-within", `${val.slice(1)}d`];
  if (val.startsWith("+")) return ["--changed-before", `${val.slice(1)}d`];
  return ["--changed-within", `${val}d`];
}

function translateMins(val: string): string[] {
  if (val.startsWith("-")) return ["--changed-within", `${val.slice(1)}min`];
  if (val.startsWith("+")) return ["--changed-before", `${val.slice(1)}min`];
  return ["--changed-within", `${val}min`];
}

export function translateFindArgs(args: string[]): { args: string[]; unknownFlags: string[] } {
  const result: string[] = [];
  const unknownFlags: string[] = [];
  const paths: string[] = [];
  const globPatterns: string[] = [];
  let regexPattern: string | null = null;
  const execArgs: string[] = [];
  let caseInsensitive = false;

  // fd excludes hidden files by default; find includes them
  result.push("-H");

  let i = 0;

  // Phase 1: leading find-level options before path args (-L, -H, -P)
  while (i < args.length) {
    const arg = args[i];
    if (arg === "-L" || arg === "-follow") {
      result.push("-L");
      i++;
    } else if (arg === "-H" || arg === "-P") {
      // -H (find) = follow command-line symlinks; already added fd's -H above
      // -P = no symlink follow (fd default)
      i++;
    } else {
      break;
    }
  }

  // Phase 2: collect path arguments (stop at first expression)
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith("-") || arg === "!" || arg === "(" || arg === ")") {
      break;
    }
    // skip "." — fd defaults to current directory
    if (arg !== ".") {
      paths.push(arg);
    }
    i++;
  }

  // Phase 3: process expressions
  while (i < args.length) {
    const arg = args[i];

    if (arg === "(" || arg === ")" || arg === "-o" || arg === "-or" || arg === "-a" || arg === "-and") {
      i++;
      continue;
    }

    // ! -name PAT or -not -name PAT → exclude pattern
    if ((arg === "!" || arg === "-not") && i + 2 < args.length && args[i + 1] === "-name") {
      result.push("-E", args[i + 2]);
      i += 3;
      continue;
    }

    if (arg === "!" || arg === "-not") {
      i++;
      continue;
    }

    if (arg === "-name" && i + 1 < args.length) {
      globPatterns.push(args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-iname" && i + 1 < args.length) {
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
      result.push("-t", args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-maxdepth" && i + 1 < args.length) {
      result.push("-d", args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-mindepth" && i + 1 < args.length) {
      result.push("--min-depth", args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-size" && i + 1 < args.length) {
      result.push("-S", args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-newer" && i + 1 < args.length) {
      result.push("--newer", args[i + 1]);
      i += 2;
      continue;
    }

    if ((arg === "-mtime" || arg === "-atime" || arg === "-ctime") && i + 1 < args.length) {
      result.push(...translateDays(args[i + 1]));
      i += 2;
      continue;
    }

    if ((arg === "-mmin" || arg === "-amin" || arg === "-cmin") && i + 1 < args.length) {
      result.push(...translateMins(args[i + 1]));
      i += 2;
      continue;
    }

    if (arg === "-user" && i + 1 < args.length) {
      result.push("--owner", args[i + 1]);
      i += 2;
      continue;
    }

    if (arg === "-group" && i + 1 < args.length) {
      result.push("--owner", `:${args[i + 1]}`);
      i += 2;
      continue;
    }

    if (arg === "-path" && i + 1 < args.length) {
      if (i + 2 < args.length && args[i + 2] === "-prune") {
        // -path PAT -prune → exclude directory: strip leading */ and trailing /*
        const pat = args[i + 1].replace(/^\*\//, "").replace(/\/\*$/, "").replace(/\*$/, "");
        result.push("-E", pat);
        i += 3;
        if (i < args.length && (args[i] === "-o" || args[i] === "-or")) i++;
      } else {
        result.push("-p", args[i + 1]);
        i += 2;
      }
      continue;
    }

    if (arg === "-perm" && i + 1 < args.length) {
      // no fd equivalent
      i += 2;
      continue;
    }

    if (arg === "-exec" || arg === "-execdir") {
      const cmdArgs: string[] = [];
      i++;
      let batchMode = false;
      while (i < args.length) {
        if (args[i] === ";" || args[i] === "\\;") {
          i++;
          break;
        }
        if (args[i] === "+") {
          batchMode = true;
          i++;
          break;
        }
        cmdArgs.push(args[i]);
        i++;
      }
      execArgs.push(batchMode ? "-X" : "-x", ...cmdArgs);
      continue;
    }

    if (arg === "-print0") { result.push("-0"); i++; continue; }
    if (arg === "-print") { i++; continue; }
    if (arg === "-L" || arg === "-follow") { result.push("-L"); i++; continue; }
    if (arg === "-H" || arg === "-P") { i++; continue; }
    if (arg === "-empty") { result.push("-t", "e"); i++; continue; }
    if (arg === "-executable") { result.push("-t", "x"); i++; continue; }
    if (arg === "-xdev" || arg === "-mount") { result.push("--one-file-system"); i++; continue; }
    if (arg === "-quit") { result.push("-1"); i++; continue; }
    if (arg === "-prune" || arg === "-depth" || arg === "-daystart" || arg === "-delete") { i++; continue; }

    // unknown expression
    if (arg.startsWith("-")) {
      unknownFlags.push(arg);
    }
    i++;
  }

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

  return { args: result, unknownFlags };
}
