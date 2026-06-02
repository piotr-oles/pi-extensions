# pi-caveman

A [pi coding agent](https://github.com/earendil-works/pi) extension that makes the agent respond in caveman mode — cutting ~75% of output tokens while keeping full technical accuracy.

Inspired by [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman).

## Install

```bash
pi install npm:@oles/pi-caveman
```

## Usage

Control via the `--pi-caveman` CLI flag (takes precedence) or the `PI_CAVEMAN` environment variable:

```bash
pi --pi-caveman full     # default: drop articles, fragments ok
pi --pi-caveman lite     # drop filler, keep grammar (professional)
pi --pi-caveman ultra    # maximum compression, telegraphic
pi --pi-caveman off      # disable

PI_CAVEMAN=full pi       # same, via env variable
```

Default level when flag is not set: **full**.

## Levels

| Level | Behavior | Example |
|-------|----------|---------|
| **lite** | Keep grammar. Drop filler and pleasantries. | "Add the dependency." |
| **full** | Drop articles, filler, pleasantries. Fragments ok. | "New object ref each render. Wrap in `useMemo`." |
| **ultra** | Maximum compression. Symbols over words. | "Inline obj prop → new ref → re-render. useMemo." |

## How it works

Injects the level's instruction file into the system prompt at session start. Instructions are imperative directives telling the agent exactly how to respond. Level is immutable for the entire session.

Code blocks, error messages, and technical terms are always written normally regardless of level.

This extension is very lite on context - adds only a few lines of text to the system prompt.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm check
```

To test changes manually, pass the source entry point directly to pi:

```bash
pi -e packages/pi-caveman/src/index.ts
```
