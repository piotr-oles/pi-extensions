import { extractTreeSitterNodes, loadParser, wasmResolver } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = wasmResolver("tree-sitter-java", "tree-sitter-java.wasm");

export const java: LanguageDefinition = {
  supportedExtensions: ["java"],
  async extractCommentNodes(content, signal) {
    if (signal?.aborted) {
      return [];
    }
    const parser = await loadParser(wasmPath());
    if (signal?.aborted) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["line_comment", "block_comment"]);
  },
};
