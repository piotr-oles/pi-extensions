import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";

const _require = createRequire(import.meta.url);

export interface LanguageConfig {
  /** Returns absolute path to the grammar's .wasm file. */
  wasmPath(): string;
  /** tree-sitter node type names that represent comments for this language. */
  commentNodeTypes: ReadonlyArray<string>;
}

/**
 * Resolve a .wasm file by finding its package.json and joining the filename.
 * More robust than require.resolve() on non-JS files across all Node versions.
 */
function wasmResolver(packageName: string, wasmFile: string): () => string {
  return () => {
    const pkgJson = _require.resolve(`${packageName}/package.json`);
    return join(dirname(pkgJson), wasmFile);
  };
}

const LANGUAGE_MAP: Record<string, LanguageConfig> = {
  ts: {
    wasmPath: wasmResolver("tree-sitter-typescript", "tree-sitter-typescript.wasm"),
    commentNodeTypes: ["comment"],
  },
  tsx: {
    wasmPath: wasmResolver("tree-sitter-typescript", "tree-sitter-tsx.wasm"),
    commentNodeTypes: ["comment"],
  },
  js: {
    wasmPath: wasmResolver("tree-sitter-javascript", "tree-sitter-javascript.wasm"),
    commentNodeTypes: ["comment"],
  },
  jsx: {
    wasmPath: wasmResolver("tree-sitter-javascript", "tree-sitter-javascript.wasm"),
    commentNodeTypes: ["comment"],
  },
  mjs: {
    wasmPath: wasmResolver("tree-sitter-javascript", "tree-sitter-javascript.wasm"),
    commentNodeTypes: ["comment"],
  },
  cjs: {
    wasmPath: wasmResolver("tree-sitter-javascript", "tree-sitter-javascript.wasm"),
    commentNodeTypes: ["comment"],
  },
  py: {
    wasmPath: wasmResolver("tree-sitter-python", "tree-sitter-python.wasm"),
    commentNodeTypes: ["comment"],
  },
  go: {
    wasmPath: wasmResolver("tree-sitter-go", "tree-sitter-go.wasm"),
    commentNodeTypes: ["comment"],
  },
  rs: {
    wasmPath: wasmResolver("tree-sitter-rust", "tree-sitter-rust.wasm"),
    commentNodeTypes: ["line_comment", "block_comment"],
  },
};

/** Returns the language config for a given file path, or undefined if unsupported. */
export function getLanguageConfig(filePath: string): LanguageConfig | undefined {
  const ext = extname(filePath).replace(/^\./, "").toLowerCase();
  return LANGUAGE_MAP[ext];
}
