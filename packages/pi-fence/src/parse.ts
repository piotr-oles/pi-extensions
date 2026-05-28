import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Language, Parser, type Node as SyntaxNode } from "web-tree-sitter";
import { getLanguageConfig } from "./languages.js";

const _require = createRequire(import.meta.url);

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

const grammarCache = new Map<string, Language>();
const parserCache = new Map<Language, Parser>();

async function loadGrammar(wasmPath: string): Promise<Language> {
  const cached = grammarCache.get(wasmPath);
  if (cached) {
    return cached;
  }
  const bytes = new Uint8Array(await readFile(wasmPath));
  const lang = await Language.load(bytes);
  grammarCache.set(wasmPath, lang);
  return lang;
}

/**
 * Return a Parser already configured for `lang`, creating one on first use.
 *
 * Parser construction and setLanguage() have non-trivial overhead — especially
 * with the WASM backend — so we keep one instance per Language object and
 * reuse it across calls.  This is safe because Parser.parse() is synchronous
 * in web-tree-sitter: after the two await points above (ensureInitialized +
 * loadGrammar), the hot path runs without yielding, so concurrent callers
 * never race on the same Parser instance.
 */
function getParser(lang: Language): Parser {
  const cached = parserCache.get(lang);
  if (cached) {
    return cached;
  }
  const parser = new Parser();
  parser.setLanguage(lang);
  parserCache.set(lang, parser);
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
 */
export async function extractComments(content: string, filePath: string): Promise<CommentNode[]> {
  const config = getLanguageConfig(filePath);
  if (!config) {
    return [];
  }

  await ensureInitialized();
  const lang = await loadGrammar(config.wasmPath());

  const parser = getParser(lang);
  const tree = parser.parse(content);
  if (!tree) {
    return [];
  }

  const results: CommentNode[] = [];
  collectComments(tree.rootNode, config.commentNodeTypes, results);
  tree.delete();
  return results;
}
