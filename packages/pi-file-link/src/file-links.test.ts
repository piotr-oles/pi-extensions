import { describe, expect, it } from "vitest";
import { rewriteFileLinks } from "./file-links.js";

describe("rewriteFileLinks", () => {
  const cwd = "/work/repo";

  it("resolves destinations against the working directory and retains labels and titles", () => {
    expect(
      rewriteFileLinks('> [**source**](src/index.ts "title") and [root](/tmp/README.md)', cwd),
    ).toBe(
      '> [**source**](file:///work/repo/src/index.ts "title") and [root](file:///tmp/README.md)',
    );
  });

  it("retains line and column jumps in Zed format", () => {
    expect(rewriteFileLinks("[relative](src/index.ts#L10) [bare](index.ts:20:4)", cwd)).toBe(
      "[relative](file:///work/repo/src/index.ts:10) [bare](file:///work/repo/index.ts:20:4)",
    );
  });

  it("escapes path characters without double-encoding percent escapes", () => {
    expect(
      rewriteFileLinks(
        "[spaces](<docs/My notes.md>) [escaped](docs/My%20notes.md) [punctuation](docs/a\\).md)",
        cwd,
      ),
    ).toBe(
      "[spaces](<file:///work/repo/docs/My%20notes.md>) [escaped](file:///work/repo/docs/My%20notes.md) [punctuation](file:///work/repo/docs/a%29.md)",
    );
  });

  it.each([
    "[file](file:///tmp/file.ts#L10)",
    "[web](https://example.com/file.ts#L10) [cdn](//example.com/index.ts)",
    "[phone](tel:1234) [mail](mailto:test@example.com)",
    "[section](#heading) [query](?page=2) [empty]()",
    "[docs](README.md#installation) [query](search?q=pi)",
    "[reference][file]\n\n[file]: src/index.ts",
    "[unfinished](src/index.ts",
  ])("leaves %s unchanged", (markdown) => {
    expect(rewriteFileLinks(markdown, cwd)).toBe(markdown);
  });

  it("leaves code examples and images unchanged", () => {
    const code = ["`[example](src/index.ts)`", "", "```md", "[example](src/index.ts)", "```"].join(
      "\n",
    );
    expect(rewriteFileLinks(`${code}\n\n[![alt](image.png)](README.md)`, cwd)).toBe(
      `${code}\n\n[![alt](image.png)](file:///work/repo/README.md)`,
    );
  });
});
