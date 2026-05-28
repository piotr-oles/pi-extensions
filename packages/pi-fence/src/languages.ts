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

const tsConfig: LanguageConfig = {
  wasmPath: wasmResolver("tree-sitter-typescript", "tree-sitter-typescript.wasm"),
  commentNodeTypes: ["comment"],
};

const tsxConfig: LanguageConfig = {
  wasmPath: wasmResolver("tree-sitter-typescript", "tree-sitter-tsx.wasm"),
  commentNodeTypes: ["comment"],
};

const jsConfig: LanguageConfig = {
  wasmPath: wasmResolver("tree-sitter-javascript", "tree-sitter-javascript.wasm"),
  commentNodeTypes: ["comment"],
};

const LANGUAGE_MAP: Record<string, LanguageConfig> = {
  ts: tsConfig,
  cts: tsConfig,
  mts: tsConfig,
  tsx: tsxConfig,
  js: jsConfig,
  jsx: jsConfig,
  mjs: jsConfig,
  cjs: jsConfig,
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
  rb: {
    wasmPath: wasmResolver("tree-sitter-ruby", "tree-sitter-ruby.wasm"),
    commentNodeTypes: ["comment"],
  },
  java: {
    wasmPath: wasmResolver("tree-sitter-java", "tree-sitter-java.wasm"),
    commentNodeTypes: ["line_comment", "block_comment"],
  },
  sh: {
    wasmPath: wasmResolver("tree-sitter-bash", "tree-sitter-bash.wasm"),
    commentNodeTypes: ["comment"],
  },
  bash: {
    wasmPath: wasmResolver("tree-sitter-bash", "tree-sitter-bash.wasm"),
    commentNodeTypes: ["comment"],
  },
  c: {
    wasmPath: wasmResolver("tree-sitter-c", "tree-sitter-c.wasm"),
    commentNodeTypes: ["comment"],
  },
  h: {
    wasmPath: wasmResolver("tree-sitter-c", "tree-sitter-c.wasm"),
    commentNodeTypes: ["comment"],
  },
  css: {
    wasmPath: wasmResolver("tree-sitter-css", "tree-sitter-css.wasm"),
    commentNodeTypes: ["comment"],
  },
};

/** Returns the language config for a given file path, or undefined if unsupported. */
export function getLanguageConfig(filePath: string): LanguageConfig | undefined {
  const ext = extname(filePath).replace(/^\./, "").toLowerCase();
  return LANGUAGE_MAP[ext];
}
