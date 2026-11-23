import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { rewriteFileLinks } from "./file-links.js";

export default function piFileLink(pi: ExtensionAPI): void {
  let cwd = process.cwd();

  pi.on("session_start", (_event, ctx) => {
    cwd = ctx.cwd;
  });

  pi.registerMarkdownTransformer((markdown) => rewriteFileLinks(markdown, cwd), {
    messageTypes: ["assistant"],
  });
}
