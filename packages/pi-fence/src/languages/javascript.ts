import {
  extractTreeSitterNodes,
  loadTreeSitterParser,
  resolveVendoredWasm,
} from "../tree-sitter.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = resolveVendoredWasm("tree-sitter-javascript.wasm");

export const javascript: LanguageDefinition = {
  supportedExtensions: ["js", "jsx", "mjs", "cjs"],
  async extractCommentNodes(content, signal) {
    const parser = await loadTreeSitterParser(wasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
