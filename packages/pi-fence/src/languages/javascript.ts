import { extractTreeSitterNodes, loadParser, wasmResolver } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = wasmResolver("tree-sitter-javascript", "tree-sitter-javascript.wasm");

export const javascript: LanguageDefinition = {
  supportedExtensions: ["js", "jsx", "mjs", "cjs"],
  async extractCommentNodes(content, signal) {
    const parser = await loadParser(wasmPath(), signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
