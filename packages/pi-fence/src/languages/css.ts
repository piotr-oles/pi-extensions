import { extractTreeSitterNodes, loadParser, wasmResolver } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = wasmResolver("tree-sitter-css", "tree-sitter-css.wasm");

export const css: LanguageDefinition = {
  supportedExtensions: ["css"],
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
