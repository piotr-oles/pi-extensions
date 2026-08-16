# pi-reflag (fork)

A fork of [@piotr-oles/pi-reflag](https://github.com/piotr-oles/pi-extensions/tree/main/packages/pi-reflag) that adds **error notifications** when `find`/`grep` commands can't be translated to `fd`/`rg`.

## What's different from upstream

The original extension silently passes through commands when translation fails. This fork **notifies the user** with a warning message when:

- A `find` command contains unsupported flags (e.g., `-printf`, `-perm`, `-delete`)
- A `grep` command contains unsupported flags (e.g., `--binary-files=text`, `-U`, `-z`)

This helps users understand why their command wasn't optimized and suggests using `fd`/`rg` directly.

## Demo

![pi-reflag demo](demo/pi-reflag-demo.gif)

The demo shows:
- ✅ Commands 1,3: Translated to `fd`/`rg` (supported flags)
- ⚠️ Commands 2,4,5: Skipped translation with warning (unsupported flags: `-printf`, `--binary-files`, `-perm`)

## Install

```bash
pi install npm:@piotr-oles/pi-reflag
# or use this fork directly
pi install git:https://github.com/YOUR_USERNAME/pi-extensions#packages/pi-reflag
```

Requires `rg` and `fd` on `$PATH`:

```bash
brew install ripgrep fd      # macOS
apt install ripgrep fd-find  # Debian/Ubuntu
dnf install ripgrep fd-find  # Fedora
```

## How it works

Intercepts `bash` tool calls in the `tool_call` event. When a command segment starts with `grep`, `find`, or `xargs grep`/`xargs find` (including piped commands), it translates the arguments to their `rg`/`fd` equivalents and rewrites the command in place before execution.

**When translation fails:** A warning notification is shown explaining that the command couldn't be translated and suggesting to use `fd` or `rg` directly.

## Verbose mode

See exactly how each command was rewritten in the UI:

```bash
pi --pi-reflag-verbose

PI_REFLAG_VERBOSE=true pi
```

## Flag translation tables

### grep → rg

| grep flag | rg equivalent |
| --- | --- |
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

### find → fd

| find expression | fd equivalent |
| --- | --- |
| (always) | `-H` added — fd excludes hidden files by default |
| `-name <glob>` | `-g <glob>` |
| `-iname <glob>` | `-i -g <glob>` |
| `-type f/d/l` | `-t f/d/l` |
| `-maxdepth N` | `-d N` |
| `-mindepth N` | `--min-depth N` |
| `-exec cmd {} \;` | `-x cmd {}` |
| `-exec cmd {} +` | `-X cmd {}` |
| `-print0` | `-0` |
| `-L` / `-follow` | `-L` |
| `-path <pat> -prune` | `-E <pat>` |
| `-path <pat>` | `-p <pat>` |
| `-regex <pat>` | `<pat>` |
| `-size <spec>` | `-S <spec>` |
| `-newer <file>` | `--newer <file>` |
| `-mtime -N` | `--changed-within Nd` |

## Thanks

- [ripgrep](https://github.com/BurntSushi/ripgrep) by Andrew Gallant
- [fd](https://github.com/sharkdp/fd) by David Peter
- [greprip-rs](https://github.com/kaofelix/greprip-rs) by kaofelix — grep→rg and find→fd translation logic ported from this project (MIT)
- [reflag](https://github.com/kluzzebass/reflag) by kluzzebass — additional find→fd flag mappings referenced from this project (MIT)
- [@piotr-oles/pi-extensions](https://github.com/piotr-oles/pi-extensions) — original extension
