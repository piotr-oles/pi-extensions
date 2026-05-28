import { extractTreeSitterNodes, loadParser, wasmResolver } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const tsWasmPath = wasmResolver("tree-sitter-typescript", "tree-sitter-typescript.wasm");
const tsxWasmPath = wasmResolver("tree-sitter-typescript", "tree-sitter-tsx.wasm");

export const typescript: LanguageDefinition = {
  supportedExtensions: ["ts", "cts", "mts"],
  async extractCommentNodes(content, signal) {
    if (signal?.aborted) {
      return [];
    }
    const parser = await loadParser(tsWasmPath());
    if (signal?.aborted) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};

export const typescriptTsx: LanguageDefinition = {
  supportedExtensions: ["tsx"],
  async extractCommentNodes(content, signal) {
    if (signal?.aborted) {
      return [];
    }
    const parser = await loadParser(tsxWasmPath());
    if (signal?.aborted) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
