import { extractTreeSitterNodes, loadParser, wasmResolver } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = wasmResolver("tree-sitter-go", "tree-sitter-go.wasm");

export const go: LanguageDefinition = {
  supportedExtensions: ["go"],
  async extractCommentNodes(content, signal) {
    if (signal?.aborted) {
      return [];
    }
    const parser = await loadParser(wasmPath());
    if (signal?.aborted) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
