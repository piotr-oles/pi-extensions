import { useEffect, useState } from "react";
import { fetchContent } from "../api";

const SAMPLE_MARKDOWN = `# Markdown Reviewer

This is a **proof-of-concept** for the Pi markdown reviewer app. Select any text to leave an inline comment that flows back to the agent.

## Architecture

The stack consists of:

- \`react-markdown\` + \`remark-gfm\` for rendering
- Text selection anchoring with a floating toolbar
- Sidebar comment threads with "Send all to Agent" action
- Express backend receiving comments via HTTP POST

## Data Flow

When a user selects text and adds a comment, the following happens:

1. Browser captures \`window.getSelection()\` range
2. Comment is stored locally (localStorage, keyed by file path)
3. On "Send all", a single \`POST /api/comments\` request is made with all unsent comments
4. The Pi extension receives the payload and calls \`pi.sendUserMessage()\`
5. The agent processes inline feedback and responds

## Code Example

\`\`\`typescript
// Pi extension handler
pi.registerCommand("review", {
  description: "Open markdown reviewer for a file",
  handler: async (args, ctx) => {
    const filePath = path.resolve(ctx.cwd, args.trim());
    await launchReviewerServer(filePath, pi);
    ctx.ui.notify(\`Reviewer opened: \${filePath}\`, "info");
  },
});
\`\`\`

## Trade-offs

| Approach | Pro | Con |
|---|---|---|
| \`react-markdown\` | Lightweight, annotation-friendly | Read-only |
| TipTap | Full editor | Heavy, overkill |
| BlockNote | Notion-like | Block format mismatch |

## Edge Cases

- Large files (10k+ lines): use \`@tanstack/virtual\` for virtualized rendering
- Overlapping ranges: layered highlight colors with \`mix-blend-mode: multiply\`
- Session closed: fall back to temp file write + \`fs.watch\` on next session

> **Note:** This PoC validates the UI/UX approach. The Pi extension integration layer wraps this app and handles the \`pi.sendUserMessage()\` callback.
`;

interface UseMarkdownResult {
  markdown: string;
  loading: boolean;
  error: string | null;
}

export function useMarkdown(file: string | null): UseMarkdownResult {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchContent(file, controller.signal)
      .then((content) => {
        setMarkdown(content);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load file");
      })
      .finally(() => {
        setLoading(false);
      });
    return () => controller.abort();
  }, [file]);

  return { markdown, loading, error };
}
