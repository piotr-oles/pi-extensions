# pi-reflag

A [pi coding agent](https://github.com/earendil-works/pi) extension that transparently rewrites `grep` commands to [`rg`](https://github.com/BurntSushi/ripgrep) (ripgrep) before they execute — faster searches with zero agent behavior change.

## Install

```bash
pi install npm:@piotr-oles/pi-reflag
```

Requires `rg` on `$PATH`. Install ripgrep via your package manager if needed:

```bash
brew install ripgrep      # macOS
apt install ripgrep       # Debian/Ubuntu
```

## How it works

Intercepts `bash` tool calls in the `tool_call` event. When the command starts with `grep` (including piped commands like `grep … | head`), it translates the arguments to their `rg` equivalents and rewrites the command in place before execution. The agent never sees the rewrite — only a user-visible toast notification is shown.

**What gets translated:**

| grep flag | rg equivalent |
|---|---|
| `-r`, `-R`, `--recursive` | dropped (rg is recursive by default) |
| `-i`, `--ignore-case` | `-i` |
| `-n`, `--line-number` | `-n` |
| `-v`, `--invert-match` | `-v` |
| `-w`, `--word-regexp` | `-w` |
| `-l`, `--files-with-matches` | `-l` |
| `-c`, `--count` | `-c` |
| `-o`, `--only-matching` | `-o` |
| `-E`, `--extended-regexp` | dropped (rg uses ERE by default) |
| `-G`, `--basic-regexp` | dropped, pattern converted from BRE to ERE |
| `-F`, `--fixed-strings` | `-F` |
| `-P`, `--perl-regexp` | `-P` |
| `-A`, `-B`, `-C` | passed through |
| `--include=<glob>` | `-g <glob>` |
| `--exclude=<glob>` | `-g !<glob>` |
| `--exclude-dir=<dir>` | `-g !<dir>/` |
| `-s` | `--no-messages` |
| `-N` (numeric context) | `-C N` |

Subshell constructs (`$(…)`, `(…)`) are left untouched to avoid misinterpreting nested commands.

## Usage

The extension is active by default. Disable it per-session with the `--pi-reflag-grep` flag:

```bash
pi --pi-reflag-grep off
```

## Thanks

- [ripgrep](https://github.com/BurntSushi/ripgrep) by Andrew Gallant — the fast, modern grep replacement this extension routes to
- [greprip-rs](https://github.com/kaofelix/greprip-rs) by kaofelix — the grep → rg argument translation logic is ported from that project (MIT)

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm check
```

To test changes manually:

```bash
pi -e packages/pi-reflag/src/index.ts
```
