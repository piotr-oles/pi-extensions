# pi-caveman

A [pi coding agent](https://github.com/earendil-works/pi) extension that makes the agent respond in caveman mode — cutting ~75% of output tokens while keeping full technical accuracy.

Inspired by [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman).

## Install

```bash
pi install npm:pi-caveman
```

## Usage

Toggle caveman mode with the `/caveman` command or by typing a trigger phrase:

```
/caveman          — toggle on/off (default: full)
/caveman lite     — drop filler, keep grammar
/caveman full     — drop articles, fragments ok
/caveman ultra    — maximum compression, telegraphic
/caveman off      — disable
```

Trigger phrases also activate caveman mode automatically:

> "use caveman mode", "talk like caveman", "less tokens", "be brief", "fewer tokens"

To deactivate:

> "stop caveman", "normal mode"

## Levels

| Level | Behavior | Example |
|-------|----------|---------|
| **lite** | Keep grammar. Drop filler and pleasantries. | "Add the dependency." |
| **full** | Drop articles, filler, pleasantries. Fragments ok. | "New object ref each render. Wrap in `useMemo`." |
| **ultra** | Maximum compression. Symbols over words. | "Inline obj prop → new ref → re-render. useMemo." |

## How it works

On each conversation turn, injects the level's instruction file into the system prompt. Instructions are imperative directives telling the agent exactly how to respond.

Code blocks, error messages, and technical terms are always written normally regardless of level.

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
