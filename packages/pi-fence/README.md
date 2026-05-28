# pi-fence

A [pi coding agent](https://github.com/earendil-works/pi) extension that detects decorative fence/divider comments in code written by the model and warns, blocks, or removes them automatically.

## What it catches

Comments whose inner text (after stripping `//`, `#`, `/* */` markers) contains a sequence of 3 or more separator characters:

```ts
// ---- helpers ----        ← caught
// ===== Auth Module =====  ← caught
# ################          ← caught
/* ~~~ utilities ~~~ */     ← caught
// ────────────────         ← caught (Unicode box-drawing)

// TODO: fix this           ← NOT caught
// Copyright (c) 2024       ← NOT caught
```

## Supported languages

| Extension(s) | Language |
|---|---|
| `.ts`, `.tsx`, `.cts`, `.mts` | TypeScript |
| `.js`, `.jsx`, `.mjs`, `.cjs` | JavaScript |
| `.py` | Python |
| `.go` | Go |
| `.rs` | Rust |
| `.rb` | Ruby |
| `.java` | Java |
| `.sh`, `.bash` | Shell / Bash |
| `.c`, `.h` | C |
| `.css` | CSS |

Files with other extensions are passed through without inspection.

## Install

```bash
pi install npm:pi-fence
```

## Modes

Control via the `--pi-fence-mode` CLI flag:

```bash
pi --pi-fence-mode warn    # default: write proceeds, warning shown to model
pi --pi-fence-mode block   # write is blocked; model must remove fences and retry
pi --pi-fence-mode remove  # fence comments are stripped silently before writing
```

| Mode | Behavior |
|---|---|
| `warn` (default) | Write/edit proceeds. A warning is appended to the tool result so the model sees it inline and knows to stop adding them. |
| `block` | Write/edit is blocked before execution. The model receives a message listing the offending lines and must retry without them. |
| `remove` | Fence comments are stripped from the content before the write/edit executes. The model is notified of what was removed. |

## How it works

1. Injects a system-prompt instruction telling the model not to add fence comments.
2. On every `write` and `edit` tool call, parses the new content with [tree-sitter](https://tree-sitter.github.io/) to extract comment nodes.
3. Compares against the existing file — only **newly introduced** fences trigger (a fence at the same line as in the old file is not re-reported).
4. Acts according to the configured mode.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm check
```
