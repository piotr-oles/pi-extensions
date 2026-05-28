import { extractTreeSitterNodes, loadParser, wasmResolver } from "../parse.js";
import type { LanguageDefinition } from "./index.js";

const wasmPath = wasmResolver("tree-sitter-css", "tree-sitter-css.wasm");

export const css: LanguageDefinition = {
  supportedExtensions: ["css"],
  async extractCommentNodes(content, signal) {
    const parser = await loadParser(wasmPath(), signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
