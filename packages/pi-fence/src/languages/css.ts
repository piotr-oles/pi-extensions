import {
  extractTreeSitterNodes,
  loadTreeSitterParser,
  resolveTreeSitterWasm,
} from "../tree-sitter.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = resolveTreeSitterWasm("tree-sitter-css", "tree-sitter-css.wasm");

export const css: LanguageDefinition = {
  supportedExtensions: ["css"],
  async extractCommentNodes(content, signal) {
    const parser = await loadTreeSitterParser(wasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
