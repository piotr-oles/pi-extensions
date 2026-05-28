import { extractTreeSitterNodes, loadParser, resolveTreeSitterWasm } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = resolveTreeSitterWasm("tree-sitter-ruby", "tree-sitter-ruby.wasm");

export const ruby: LanguageDefinition = {
  supportedExtensions: ["rb"],
  async extractCommentNodes(content, signal) {
    const parser = await loadParser(wasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
