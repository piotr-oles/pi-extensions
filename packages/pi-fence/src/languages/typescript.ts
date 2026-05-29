import {
  extractTreeSitterNodes,
  loadTreeSitterParser,
  resolveVendoredWasm,
} from "../tree-sitter.js";
import type { LanguageDefinition } from "./index.js";

const tsWasmPath = resolveVendoredWasm("tree-sitter-typescript.wasm");
const tsxWasmPath = resolveVendoredWasm("tree-sitter-tsx.wasm");

export const typescript: LanguageDefinition = {
  supportedExtensions: ["ts", "cts", "mts"],
  async extractCommentNodes(content, signal) {
    const parser = await loadTreeSitterParser(tsWasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};

export const typescriptTsx: LanguageDefinition = {
  supportedExtensions: ["tsx"],
  async extractCommentNodes(content, signal) {
    const parser = await loadTreeSitterParser(tsxWasmPath, signal);
    if (!parser) {
      return [];
    }
    return extractTreeSitterNodes(content, parser, ["comment"]);
  },
};
