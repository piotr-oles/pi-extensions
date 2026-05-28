import { extractTreeSitterNodes, loadParser, resolveTreeSitterWasm } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const tsWasmPath = resolveTreeSitterWasm("tree-sitter-typescript", "tree-sitter-typescript.wasm");
const tsxWasmPath = resolveTreeSitterWasm("tree-sitter-typescript", "tree-sitter-tsx.wasm");

export const typescript: LanguageDefinition = {
  supportedExtensions: ["ts", "cts", "mts"],
  async extractCommentNodes(content, signal) {
    const parser = await loadParser(tsWasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};

export const typescriptTsx: LanguageDefinition = {
  supportedExtensions: ["tsx"],
  async extractCommentNodes(content, signal) {
    const parser = await loadParser(tsxWasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
