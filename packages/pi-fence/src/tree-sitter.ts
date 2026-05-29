import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Language, Parser, type Node as SyntaxNode } from "web-tree-sitter";
import type { CommentNode } from "./types.js";

const vendorDir = join(dirname(fileURLToPath(import.meta.url)), "../vendor");

export function resolveVendoredWasm(filename: string): string {
  return join(vendorDir, filename);
}

let runtimeReady: Promise<void> | null = null;

function ensureTreeSitterRuntimeInitialized(): Promise<void> {
  if (runtimeReady) {
    return runtimeReady;
  }
  runtimeReady = (async () => {
    const wasmBinary = await readFile(join(vendorDir, "web-tree-sitter.wasm"));
    await Parser.init({ wasmBinary });
  })();
  return runtimeReady;
}

const parserCache = new Map<string, Parser>();

/**
 * Load (or return a cached) Parser for the given grammar WASM path.
 *
 * Combines grammar loading and parser construction into a single step keyed
 * by wasmPath.  Parser.parse() is synchronous in web-tree-sitter, so cached
 * parsers are safe to reuse: concurrent callers complete their await points
 * before reaching the synchronous parse call, never racing on the same instance.
 *
 * Returns `null` if the signal is aborted at any point during loading.
 * Cache hits are returned immediately without a signal check.
 */
export async function loadTreeSitterParser(
  wasmPath: string,
  signal?: AbortSignal,
): Promise<Parser | null> {
  const cached = parserCache.get(wasmPath);
  if (cached) {
    return cached;
  }
  await ensureTreeSitterRuntimeInitialized();
  if (signal?.aborted) {
    return null;
  }
  const bytes = new Uint8Array(await readFile(wasmPath));
  if (signal?.aborted) {
    return null;
  }
  const lang = await Language.load(bytes);
  if (signal?.aborted) {
    return null;
  }
  const parser = new Parser();
  parser.setLanguage(lang);
  parserCache.set(wasmPath, parser);
  return parser;
}

/**
 * Walk `parser`'s parse tree for `content` and return every node whose type
 * is listed in `commentNodeTypes`.
 */
export function extractTreeSitterNodes(
  content: string,
  parser: Parser,
  commentNodeTypes: ReadonlyArray<string>,
): CommentNode[] {
  const tree = parser.parse(content);
  if (!tree) {
    return [];
  }
  const results: CommentNode[] = [];
  collectNodes(tree.rootNode, commentNodeTypes, results);
  tree.delete();
  return results;
}

function collectNodes(
  node: SyntaxNode,
  commentTypes: ReadonlyArray<string>,
  out: CommentNode[],
): void {
  if (commentTypes.includes(node.type)) {
    out.push({
      text: node.text,
      startLine: node.startPosition.row,
      startCol: node.startPosition.column,
      endLine: node.endPosition.row,
      endCol: node.endPosition.column,
    });
    return; // comments never nest
  }
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      collectNodes(child, commentTypes, out);
    }
  }
}
