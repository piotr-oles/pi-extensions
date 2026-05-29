import {
  extractTreeSitterNodes,
  loadTreeSitterParser,
  resolveVendoredWasm,
} from "../tree-sitter.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = resolveVendoredWasm("tree-sitter-c.wasm");

export const c: LanguageDefinition = {
  supportedExtensions: ["c", "h"],
  async extractCommentNodes(content, signal) {
    const parser = await loadTreeSitterParser(wasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
