import {
  extractTreeSitterNodes,
  loadTreeSitterParser,
  resolveVendoredWasm,
} from "../tree-sitter.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = resolveVendoredWasm("tree-sitter-java.wasm");

export const java: LanguageDefinition = {
  supportedExtensions: ["java"],
  async extractCommentNodes(content, signal) {
    const parser = await loadTreeSitterParser(wasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["line_comment", "block_comment"]);
  },
};
