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

export interface RewriteResult {
  rewritten: string;
  untranslatable: Array<{ name: string; args: string[] }>;
}

export async function rewriteBash(
  bash: string,
  ignoreMode: IgnoreMode = "auto",
): Promise<RewriteResult> {
  let parser: Parser | undefined;
  try {
    parser = await loadBashParser();
  } catch {
    return { rewritten: bash, untranslatable: [] };
  }

  const tree = parser.parse(bash);
  if (!tree) {
    return { rewritten: bash, untranslatable: [] };
  }

  let newBash = bash;
  const untranslatable: Array<{ name: string; args: string[] }> = [];

  const rewrites = [grep, createFind(ignoreMode)];

  for (const command of extractCommands(tree.rootNode)) {
    // Only check find and grep for untranslatable detection
    const isFindOrGrep = command.name === "find" || command.name === "grep";
    
    // Try to translate the command
    let translatedCommand: Command | undefined;
    for (const rewrite of rewrites) {
      const result = rewrite(command);
      if (result) {
        translatedCommand = result;
        break;
      }
    }
    
    if (translatedCommand) {
      // Command was translated - apply the rewrite
      newBash =
        newBash.slice(0, command.startIndex) +
        stringifyCommand(translatedCommand) +
        newBash.slice(command.endIndex);
    } else if (isFindOrGrep) {
      // find/grep command couldn't be translated - track it
      untranslatable.push({ name: command.name, args: command.args });
    }
  }
  tree.delete();

  return { rewritten: newBash, untranslatable };
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
