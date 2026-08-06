# pi-bell

A [pi coding agent](https://github.com/earendil-works/pi) extension that sends a terminal bell when an interactive agent run finishes. Terminal hosts such as Zed can use the bell to notify you that pi is ready.

## Install

```bash
pi install npm:@piotr-oles/pi-bell
```

## Usage

No configuration. Bell is emitted after `agent_end` only when `ctx.hasUI` is true.

Sessions without UI—including SDK-created subagent sessions, print mode, and JSON mode—do not emit a bell.

## Development

```bash
pnpm install
pnpm --filter @piotr-oles/pi-bell test
pnpm --filter @piotr-oles/pi-bell typecheck
pnpm --filter @piotr-oles/pi-bell check
```

To test extension manually:

```bash
pi -e packages/pi-bell/src/index.ts
```
