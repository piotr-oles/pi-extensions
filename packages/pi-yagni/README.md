# pi-yagni

A [pi coding agent](https://github.com/earendil-works/pi) extension that injects YAGNI ("You Aren't Gonna Need It") discipline into the agent — build the minimum that works, reuse before writing, no speculative code.

## Install

```bash
pi install npm:@piotr-oles/pi-yagni
```

## Usage

No configuration. Enabled whenever installed. Uninstall to disable.

## How it works

Injects a YAGNI instruction block into the system prompt at session start. The block gives the agent a decision ladder — stop at the first rung that holds — before writing any code:

1. Does this need to be built at all?
2. Does it already exist in this codebase? Reuse it.
3. Does the standard library do this?
4. Does a native platform feature cover it?
5. Does an already-installed dependency solve it?
6. Can this be one line?
7. Only then: write the minimum code that works.

Plus rules against speculative generality, premature abstraction, and unrequested error handling / caching / logging.

This extension is very lite on context — adds only a few lines of text to the system prompt.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm check
```

To test changes manually, pass the source entry point directly to pi:

```bash
pi -e packages/pi-yagni/src/index.ts
```
