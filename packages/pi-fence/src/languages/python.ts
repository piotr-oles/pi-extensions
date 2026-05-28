import { extractTreeSitterNodes, loadParser, wasmResolver } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = wasmResolver("tree-sitter-python", "tree-sitter-python.wasm");

export const python: LanguageDefinition = {
  supportedExtensions: ["py"],
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
