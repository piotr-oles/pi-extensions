# pi-fence

Pi extension. Detect decorative fence/divider comments in written code. Warn, block, or strip them.

## What it catches

```ts
// ---- helpers ----
// ===== Section =====
// *** utilities ***
# ################
```

New fences only. Pre-existing comments ignored.

## Supported languages

JS, TS, Python, Go, Rust.

## Install

```json
{
  "pi": {
    "extensions": ["pi-fence"]
  }
}
```

## Modes

Control via `pi-fence-mode` flag:

| Mode | Behavior |
|------|----------|
| `warn` (default) | Write proceeds, warning appended to tool result |
| `block` | Write blocked, model must retry without fences |
| `remove` | Fence comments stripped before write |

Set in pi config:

```json
{
  "flags": {
    "pi-fence-mode": "block"
  }
}
```

## How it works

Hooks `tool_call` / `tool_result` on `write` and `edit` tools. Parses new content with tree-sitter. Compares against existing file — only newly introduced fences trigger. Acts per mode.
