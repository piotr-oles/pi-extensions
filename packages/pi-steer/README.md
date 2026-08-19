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
pi --pi-steer executable-reasoning,craftsmanship # only these two, in this order
pi --pi-steer=-craftsmanship                     # all except craftsmanship
pi --pi-steer off                                # disable entirely
PI_STEER=yagni,ste100 pi                         # same, via env variable
pi                                               # default: all sections, file order
```

Default when flag is not set: **all sections** in file order. Selection and composed text are captured once per session. Resumed sessions restore their snapshot and ignore current flag, environment, and instruction-file changes.

## Sections

| Name | File |
|------|------|
| `escalate-ambiguity` | `instructions/escalate-ambiguity.md` |
| `executable-reasoning` | `instructions/executable-reasoning.md` |
| `yagni` | `instructions/yagni.md` |
| `craftsmanship` | `instructions/craftsmanship.md` |
| `progressive-disclosure` | `instructions/progressive-disclosure.md` |
| `ste100` | `instructions/ste100.md` |

Prefix a name with `-` to exclude it. An exclusion-only list starts with all sections. Use `=` after `--pi-steer` when value starts with `-`, as shown above. When inclusions and exclusions are mixed, inclusions define the initial selection and exclusions remove from it.

Unknown names are dropped. Duplicates are collapsed. Empty or all-unknown input falls through to the default (all sections).

## How it works

At session start, reads selected `instructions/<name>.md` files and stores section names plus composed text in a custom session entry. Reloaded and resumed sessions restore this exact snapshot. Before each agent run, the extension appends stored text to the system prompt.

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
