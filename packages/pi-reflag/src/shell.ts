import type { Parser, Node as SyntaxNode } from "web-tree-sitter";
import { find } from "./find.js";
import { grep } from "./grep.js";
import { loadBashParser } from "./tree-sitter.js";
import type { Command } from "./types.js";

const COMMAND_REWRITES = [grep, find];

interface BashCommand extends Command {
  startIndex: number;
  endIndex: number;
}

export async function rewriteBash(bash: string): Promise<string> {
  let parser: Parser | undefined;
  try {
    parser = await loadBashParser();
  } catch {
    return bash;
  }

  const tree = parser.parse(bash);
  if (!tree) {
    return bash;
  }

  let rewrittenBash = bash;

  for (const command of extractCommands(tree.rootNode)) {
    const commandRewrite = COMMAND_REWRITES.find((r) => r.isMatching(command));
    if (!commandRewrite) {
      continue;
    }

    const rewrittenCommand = commandRewrite.rewrite(command);

    if (rewrittenCommand) {
      rewrittenBash =
        rewrittenBash.slice(0, command.startIndex) +
        stringifyCommand(rewrittenCommand) +
        rewrittenBash.slice(command.endIndex);
    }
  }

  tree.delete();

  return rewrittenBash;
}

const COMPLEX_ARG_TYPES = new Set([
  "expansion",
  "simple_expansion",
  "command_substitution",
  "arithmetic_expansion",
  "process_substitution",
]);

function* extractCommands(node: SyntaxNode): Generator<BashCommand> {
  switch (node.type) {
    case "subshell":
      // skip subshell
      return;

    case "command": {
      const nameNode = node.childForFieldName("name");
      const argNodes = node.childrenForFieldName("argument");

      if (node.descendantsOfType("variable_assignment").length) {
        // skip when there is a variable assignment
        return;
      }

      if (argNodes.some((argNode) => COMPLEX_ARG_TYPES.has(argNode.type))) {
        // skip when complex arg types
        return;
      }

      yield {
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        name: nameNode?.text ?? "",
        args: argNodes.map((n) => n.text),
      };
      return;
    }

    default: {
      // traverse AST from right to left
      // this way earlier positions stay valid as we replace later ones
      for (let i = node.childCount; i >= 0; i--) {
        const child = node.child(i);
        if (child) {
          yield* extractCommands(child);
        }
      }
    }
  }
}

function stringifyCommand(command: Command): string {
  return [command.name, ...command.args].join(" ");
}
