import {
  extractTreeSitterNodes,
  loadTreeSitterParser,
  resolveTreeSitterWasm,
} from "../tree-sitter.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = resolveTreeSitterWasm("tree-sitter-go", "tree-sitter-go.wasm");

export const go: LanguageDefinition = {
  supportedExtensions: ["go"],
  async extractCommentNodes(content, signal) {
    const parser = await loadTreeSitterParser(wasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
