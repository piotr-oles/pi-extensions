import {
  extractTreeSitterNodes,
  loadTreeSitterParser,
  resolveTreeSitterWasm,
} from "../tree-sitter.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = resolveTreeSitterWasm("tree-sitter-python", "tree-sitter-python.wasm");

export const python: LanguageDefinition = {
  supportedExtensions: ["py"],
  async extractCommentNodes(content, signal) {
    const parser = await loadTreeSitterParser(wasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
