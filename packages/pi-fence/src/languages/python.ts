import { extractTreeSitterNodes, loadParser, resolveTreeSitterWasm } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = resolveTreeSitterWasm("tree-sitter-python", "tree-sitter-python.wasm");

export const python: LanguageDefinition = {
  supportedExtensions: ["py"],
  async extractCommentNodes(content, signal) {
    const parser = await loadParser(wasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
