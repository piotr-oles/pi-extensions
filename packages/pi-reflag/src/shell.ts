import type { Parser, Node as SyntaxNode } from "web-tree-sitter";
import { createFind, type IgnoreMode } from "./find.js";
import { grep } from "./grep.js";
import { loadBashParser } from "./tree-sitter.js";
import type { Command } from "./types.js";

const REDIRECT_NODE_TYPES = new Set(["file_redirect", "heredoc_redirect", "herestring_redirect"]);

interface BashCommand extends Command {
  startIndex: number;
  endIndex: number;
}

export async function rewriteBash(bash: string, ignoreMode: IgnoreMode = "auto"): Promise<string> {
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

  let newBash = bash;

  const rewrites = [grep, createFind(ignoreMode)];

  for (const command of extractCommands(tree.rootNode)) {
    for (const rewrite of rewrites) {
      const newCommand = rewrite(command);

      if (newCommand) {
        newBash =
          newBash.slice(0, command.startIndex) +
          stringifyCommand(newCommand) +
          newBash.slice(command.endIndex);
        break;
      }
    }
  }
  tree.delete();

  return newBash;
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

      if (node.children.some((child) => REDIRECT_NODE_TYPES.has(child.type))) {
        // skip commands where redirect appears inside (e.g. "> /dev/null cmd args")
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
      for (let i = node.childCount - 1; i >= 0; i--) {
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
