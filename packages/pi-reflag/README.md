# pi-reflag

A [pi coding agent](https://github.com/earendil-works/pi) extension that transparently rewrites `grep` commands to [`rg`](https://github.com/BurntSushi/ripgrep) (ripgrep) and `find` commands to [`fd`](https://github.com/sharkdp/fd) before they execute — faster searches with zero agent behavior change.

## Install

```bash
pi install npm:@piotr-oles/pi-reflag
```

Requires `rg` and `fd` on `$PATH`:

```bash
brew install ripgrep fd      # macOS
apt install ripgrep fd-find  # Debian/Ubuntu
```

## How it works

Intercepts `bash` tool calls in the `tool_call` event. When a command segment starts with `grep`, `find`, or `xargs grep`/`xargs find` (including piped commands), it translates the arguments to their `rg`/`fd` equivalents and rewrites the command in place before execution. The agent never sees the rewrite.

Subshell constructs (`$(…)`, `(…)`) and commands with variable assignments are left untouched to avoid misinterpreting nested or complex commands.

## grep → rg

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

## find → fd

**What gets translated:**

| find expression | fd equivalent |
|---|---|
| (always) | `-H` added — fd excludes hidden files by default, find doesn't |
| (auto mode) | `--no-ignore` added when searching inside a known ignored directory |
| `-name <glob>` | `-g <glob>` |
| `-iname <glob>` | `-i -g <glob>` |
| `-name a -o -name b` | `-g {a,b}` (brace expansion) |
| `! -name <glob>` / `-not -name <glob>` | `-E <glob>` |
| `-type f/d/l` | `-t f/d/l` |
| `-maxdepth N` | `-d N` |
| `-mindepth N` | `--min-depth N` |
| `-exec cmd {} \;` | `-x cmd {}` |
| `-exec cmd {} +` | `-X cmd {}` |
| `-print0` | `-0` |
| `-print` | dropped (fd default) |
| `-L` / `-follow` | `-L` |
| `-path <pat> -prune` | `-E <pat>` (exclude directory) |
| `-path <pat>` | `-p <pat>` (full-path match) |
| `-regex <pat>` | `<pat>` (fd regex) |
| `-iregex <pat>` | `-i <pat>` |
| `-size <spec>` | `-S <spec>` |
| `-newer <file>` | `--newer <file>` |
| `-mtime`/`-atime`/`-ctime -N` | `--changed-within Nd` |
| `-mtime`/`-atime`/`-ctime +N` | `--changed-before Nd` |
| `-mmin`/`-amin`/`-cmin -N` | `--changed-within Nmin` |
| `-mmin`/`-amin`/`-cmin +N` | `--changed-before Nmin` |
| `-user <name>` | `--owner <name>` |
| `-group <name>` | `--owner :<name>` |
| `-empty` | `-t e` |
| `-executable` | `-t x` |
| `-xdev` / `-mount` | `--one-file-system` |
| `-quit` | `-1` |

## Ignore mode

Controls when `--no-ignore` is passed to `fd` (so it searches inside `.gitignore`d directories):

| Mode | Behaviour |
|---|---|
| `auto` (default) | adds `--no-ignore` when the search path contains a known ignored directory (e.g. `node_modules`, `.venv`, `.yarn`, `dist`, `target`, …) |
| `no-ignore` | always adds `--no-ignore` |
| `ignore` | never adds `--no-ignore` |

```bash
pi --pi-reflag-ignore-mode=no-ignore

PI_REFLAG_IGNORE_MODE=no-ignore pi
```

<details>
<summary>Full list of directories that trigger auto mode</summary>

`node_modules`, `.yarn`, `.pnpm-store`, `.parcel-cache`, `.turbo`, `.vite`, `.cache`, `.eslintcache`, `.stylelintcache`, `.next`, `.nuxt`, `.svelte-kit`, `.vuepress`, `.output`, `.docusaurus`, `.temp`, `.serverless`, `.firebase`, `dist`, `build`, `out`, `target`, `debug`, `obj`, `artifacts`, `_deps`, `CMakeFiles`, `coverage`, `.nyc_output`, `.hypothesis`, `__pycache__`, `.pytest_cache`, `.tox`, `.nox`, `.venv`, `venv`, `.ipynb_checkpoints`, `vendor`, `.bundle`, `.gradle`, `.mvn`, `_build`, `deps`, `.git`

</details>

## Verbose mode

See exactly how each command was rewritten in the UI:

```bash
pi --pi-reflag-verbose

PI_REFLAG_VERBOSE=true pi
```

## Thanks

- [ripgrep](https://github.com/BurntSushi/ripgrep) by Andrew Gallant
- [fd](https://github.com/sharkdp/fd) by David Peter
- [greprip-rs](https://github.com/kaofelix/greprip-rs) by kaofelix — grep→rg and find→fd translation logic ported from this project (MIT)
- [reflag](https://github.com/kluzzebass/reflag) by kluzzebass — additional find→fd flag mappings referenced from this project (MIT)

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
