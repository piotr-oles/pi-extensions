import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Language, Parser, type Node as SyntaxNode } from "web-tree-sitter";
import { getLanguageConfig } from "./languages.js";

const _require = createRequire(import.meta.url);

/** Stable key for a comment node: combines text and line so moved/copied fences are treated as new. */
export function getCommentHash(c: CommentNode): string {
  return `${c.text}:::${c.startLine}`;
}

export interface CommentNode {
  /** Raw comment text including markers (e.g. `// ---- section ----`). */
  text: string;
  /** 1-indexed line number. */
  startLine: number;
  /** 0-indexed column. */
  startCol: number;
  /** 1-indexed end line (inclusive). */
  endLine: number;
  /** 0-indexed end column (exclusive — first column after the comment). */
  endCol: number;
}

let parserReady: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (parserReady) {
    return parserReady;
  }
  parserReady = (async () => {
    // web-tree-sitter blocks './package.json' in exports, so resolve the
    // main JS entry and derive the WASM path from its directory.
    const jsPath = _require.resolve("web-tree-sitter");
    const wasmPath = join(dirname(jsPath), "web-tree-sitter.wasm");
    const wasmBinary = await readFile(wasmPath);
    await Parser.init({ wasmBinary });
  })();
  return parserReady;
}

const parserCache = new Map<string, Parser>();

/**
 * Load (or return a cached) Parser for the given grammar WASM path.
 *
 * Combines grammar loading and parser construction into a single step keyed
 * by wasmPath.  Parser.parse() is synchronous in web-tree-sitter, so cached
 * parsers are safe to reuse: concurrent callers complete their await points
 * before reaching the synchronous parse call, never racing on the same instance.
 */
async function loadParser(wasmPath: string): Promise<Parser> {
  const cached = parserCache.get(wasmPath);
  if (cached) {
    return cached;
  }
  const bytes = new Uint8Array(await readFile(wasmPath));
  const lang = await Language.load(bytes);
  const parser = new Parser();
  parser.setLanguage(lang);
  parserCache.set(wasmPath, parser);
  return parser;
}

function collectComments(
  node: SyntaxNode,
  commentTypes: ReadonlyArray<string>,
  out: CommentNode[],
): void {
  if (commentTypes.includes(node.type)) {
    out.push({
      text: node.text,
      startLine: node.startPosition.row + 1, // tree-sitter is 0-based; we use 1-based
      startCol: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endCol: node.endPosition.column,
    });
    return; // comments never nest
  }
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      collectComments(child, commentTypes, out);
    }
  }
}

/**
 * Parse `content` as source code belonging to `filePath` and return every
 * comment node found.  Returns [] for unsupported file extensions.
 *
 * Pass an `AbortSignal` to skip the parse when the parent turn has been
 * cancelled.  Because Parser.parse() is synchronous it cannot be interrupted
 * mid-run, so the signal is checked only before parsing begins.
 */
export async function extractComments(
  content: string,
  filePath: string,
  signal?: AbortSignal,
): Promise<CommentNode[]> {
  const config = getLanguageConfig(filePath);
  if (!config) {
    return [];
  }

  await ensureInitialized();
  if (signal?.aborted) {
    return [];
  }

  const parser = await loadParser(config.wasmPath());
  if (signal?.aborted) {
    return [];
  }
  const tree = parser.parse(content);
  if (!tree) {
    return [];
  }

  const results: CommentNode[] = [];
  collectComments(tree.rootNode, config.commentNodeTypes, results);
  tree.delete();
  return results;
}
