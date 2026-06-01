# pi-review

Pi coding agent extension: open any markdown file in a browser-based reviewer, annotate it with inline comments, and send the feedback back to the agent in one click.

## What it does

Run `/review path/to/document.md` inside pi. A local server starts and your browser opens to a rendered view of the file. Select any text to attach a comment, then hit **Send all to Agent** — the agent receives every comment as a user message and can act on the feedback immediately.

## Installation

```json
{
  "extensions": ["pi-review"]
}
```

## Usage

```
/review <path-to-markdown-file>
```

The path is resolved relative to your current working directory. Running `/review` again on the same file reopens the existing browser tab instead of starting a second server.

**Examples**

```
/review README.md
/review docs/architecture.md
/review /absolute/path/to/notes.md
```

## How it works

1. `/review` starts a local Express server that serves the built UI and the `/api` routes.
2. Your browser opens to the reviewer.
3. Select text → write a comment → repeat as needed.
4. Click **Send all to Agent** — comments are posted to `/api/comments` and forwarded to the agent via `pi.sendUserMessage()`.
5. When your pi session ends all servers are shut down automatically.

## Development

```bash
pnpm install
pnpm --filter pi-review run build:app   # build the React UI into app-dist/
pnpm --filter pi-review run test        # node + jsdom test suites
pnpm --filter pi-review run typecheck   # tsc for both Node and browser sides
```
