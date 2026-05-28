import { extractTreeSitterNodes, loadParser, wasmResolver } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = wasmResolver("tree-sitter-go", "tree-sitter-go.wasm");

export const go: LanguageDefinition = {
  supportedExtensions: ["go"],
  async extractCommentNodes(content, signal) {
    const parser = await loadParser(wasmPath(), signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
