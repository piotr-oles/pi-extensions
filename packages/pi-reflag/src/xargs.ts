import type { CommandRewrite } from "./types.js";

/**
 * Higher-order command rewrite to handle xargs case
 * @param rewrite Basic command rewrite
 * @returns Command rewrite that supports xargs
 */
export function xargs(rewrite: CommandRewrite): CommandRewrite {
  return function rewriteXargs(command) {
    if (command.name === "xargs" && typeof command.args[0] === "string") {
      const result = rewrite({ name: command.args[0], args: command.args.slice(1) });
      if (result) {
        return { name: "xargs", args: [result.name, ...result.args] };
      }
      return undefined;
    }
    return rewrite(command);
  };
}
