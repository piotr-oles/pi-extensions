import {
  extractTreeSitterNodes,
  loadTreeSitterParser,
  resolveTreeSitterWasm,
} from "../tree-sitter.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = resolveTreeSitterWasm("tree-sitter-rust", "tree-sitter-rust.wasm");

export const rust: LanguageDefinition = {
  supportedExtensions: ["rs"],
  async extractCommentNodes(content, signal) {
    const parser = await loadTreeSitterParser(wasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["line_comment", "block_comment"]);
  },
};
