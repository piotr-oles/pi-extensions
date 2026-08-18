# pi-steer

A [pi coding agent](https://github.com/earendil-works/pi) extension that steers model behavior by composing system-prompt instruction sections from individual files. Each instruction lives in its own file under `instructions/`, so you pick which ones to load and in what order.

> **Subjective.** The bundled sections reflect the author's personal coding-agent preferences, not universal best practice. Fork and edit `instructions/*.md` to match your own taste.

## Install

```bash
pi install npm:@piotr-oles/pi-steer
```

## Usage

Control via the `--pi-steer` CLI flag (takes precedence) or the `PI_STEER` environment variable. Value is a comma-separated list of section names:

```bash
pi --pi-steer think-in-code,parallel-calls   # only these two, in this order
pi --pi-steer off                             # disable entirely
PI_STEER=commands,technical-writing pi        # same, via env variable
pi                                            # default: all sections, file order
```

Default when flag is not set: **all sections** in file order.

## Sections

| Name | File |
|------|------|
| `think-in-code` | `instructions/think-in-code.md` |
| `parallel-calls` | `instructions/parallel-calls.md` |
| `ask-dont-assume` | `instructions/ask-dont-assume.md` |
| `attention-to-quality` | `instructions/attention-to-quality.md` |
| `top-down-code-layout` | `instructions/top-down-code-layout.md` |
| `commands` | `instructions/commands.md` |
| `technical-writing` | `instructions/technical-writing.md` |

Unknown names are dropped. Duplicates are collapsed. Empty or all-unknown input falls through to the default (all sections).

## How it works

Reads each selected `instructions/<name>.md` at load, joins them with blank lines, and appends the result to the system prompt at session start via `before_agent_start`. Selection is immutable for the session.

This extension is lite on context — adds only the chosen sections to the system prompt.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm check
```

To test changes manually, pass the source entry point directly to pi:

```bash
pi -e packages/pi-steer/src/index.ts
```
