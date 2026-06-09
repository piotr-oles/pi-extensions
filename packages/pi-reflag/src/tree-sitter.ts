import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Language, Parser } from "web-tree-sitter";

const vendorDir = join(dirname(fileURLToPath(import.meta.url)), "../vendor");

let parserPromise: Promise<Parser> | null = null;

export function loadBashParser(): Promise<Parser> {
  if (parserPromise) {
    return parserPromise;
  }
  parserPromise = (async () => {
    const wasmBinary = await readFile(join(vendorDir, "web-tree-sitter.wasm"));
    await Parser.init({ wasmBinary });
    const bytes = new Uint8Array(await readFile(join(vendorDir, "tree-sitter-bash.wasm")));
    const lang = await Language.load(bytes);
    const parser = new Parser();
    parser.setLanguage(lang);
    return parser;
  })();
  return parserPromise;
}
