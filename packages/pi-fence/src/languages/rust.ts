import { extractTreeSitterNodes, loadParser, resolveTreeSitterWasm } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = resolveTreeSitterWasm("tree-sitter-rust", "tree-sitter-rust.wasm");

export const rust: LanguageDefinition = {
  supportedExtensions: ["rs"],
  async extractCommentNodes(content, signal) {
    const parser = await loadParser(wasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["line_comment", "block_comment"]);
  },
};
