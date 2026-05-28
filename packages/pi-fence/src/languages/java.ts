import { extractTreeSitterNodes, loadParser, wasmResolver } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = wasmResolver("tree-sitter-java", "tree-sitter-java.wasm");

export const java: LanguageDefinition = {
  supportedExtensions: ["java"],
  async extractCommentNodes(content, signal) {
    const parser = await loadParser(wasmPath(), signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["line_comment", "block_comment"]);
  },
};
