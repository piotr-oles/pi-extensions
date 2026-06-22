import type { CommandRewrite } from "./types.js";

// Flags that consume the next argument as their value
const XARGS_FLAGS_WITH_ARG = new Set(["-n", "-P", "-I", "-s", "-L", "-l"]);

/**
 * Scan past leading xargs flags to find the subcommand index.
 * e.g. ["-r", "-t", "grep", "pattern"] → 2
 */
function findSubcmdIndex(args: string[]): number {
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (!arg.startsWith("-")) {
      return i;
    }
    if (XARGS_FLAGS_WITH_ARG.has(arg)) {
      i += 2; // skip flag and its value argument
    } else {
      i++;
    }
  }
  return i; // not found
}

/**
 * Higher-order command rewrite to handle xargs case
 * @param rewrite Basic command rewrite
 * @returns Command rewrite that supports xargs
 */
export function xargs(rewrite: CommandRewrite): CommandRewrite {
  return function rewriteXargs(command) {
    if (command.name === "xargs") {
      const subcmdIndex = findSubcmdIndex(command.args);
      if (subcmdIndex >= command.args.length) {
        return undefined;
      }
      const xargsFlags = command.args.slice(0, subcmdIndex);
      const subcmd = command.args[subcmdIndex];
      const subcmdArgs = command.args.slice(subcmdIndex + 1);
      const result = rewrite({ name: subcmd, args: subcmdArgs });
      if (result) {
        return { name: "xargs", args: [...xargsFlags, result.name, ...result.args] };
      }
      return undefined;
    }
    return rewrite(command);
  };
}
