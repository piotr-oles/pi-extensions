# AGENTS.md

Guidelines for AI coding agents working in this repository.

## What this repo is

A pnpm monorepo of [pi coding agent](https://github.com/earendil-works/pi) extensions. Each package under `packages/` is a self-contained pi extension that can be installed by users into their pi config.

## Packages

### `pi-fence` (`packages/pi-fence`)
Hooks into pi's `tool_call` / `tool_result` events to detect decorative fence/divider comments being written (e.g. `// ---- section ----`, `// ===== Title =====`). Operates in three modes controlled by the `pi-fence-mode` flag:

- **warn** (default) - appends a warning to the tool result after writing
- **block** - returns `{ block: true }` before the write happens
- **remove** - strips the fence comments from the content before writing

Uses [tree-sitter](https://tree-sitter.github.io/) to parse comment nodes. Supports JS/TS, Python, Go, and Rust.

### `pi-caveman` (`packages/pi-caveman`)
Makes the agent respond in caveman mode - cuts ~75% of output tokens while keeping full technical accuracy. Injects a level-specific instruction file into the system prompt at session start. Level is controlled by the `pi-caveman` flag (`lite`, `full`, `ultra`, or `off`; default: `full`).

### `pi-yagni` (`packages/pi-yagni`)
Injects YAGNI ("You Aren't Gonna Need It") discipline into the system prompt at session start. Gives the agent a decision ladder (build only if needed, reuse before writing, stdlib/platform/existing-dep before new code, one line if possible) plus rules against speculative generality and premature abstraction. No configuration — enabled whenever installed. Structured like `pi-caveman` (single instruction file injected via `before_agent_start`) but with no level flag.

### `pi-plan` (`packages/pi-plan`)
Adds a `review-plan` tool that writes a named markdown plan to `~/.pi/plan/<repo>/<name>.md`, commits it to a git repo inside `~/.pi/plan/`, and shows an interactive terminal widget so the user can confirm, request changes, or reply freely before the agent proceeds. The widget also offers an **Open in [Editor]** option (Zed, VS Code, Cursor, Windsurf) detected automatically via `TERM_PROGRAM`; selecting it opens the file in the IDE and re-shows the widget without notifying the agent.

### `pi-cwd` (`packages/pi-cwd`)
Detects absolute cwd paths in `read`, `write`, `edit`, and `bash` tool calls. Appends tip to tool result reminding agent to use relative paths and showing current `cwd`. Also injects `PROMPT_INSTRUCTIONS` into system prompt at session start.

Controlled by `pi-cwd` boolean flag (default: `true`).

### `pi-subagents` (`packages/pi-subagents`)
Lets the agent spawn specialized subagents — each in its own isolated session with its own model, tools, skills, and instructions. Templates are markdown files with YAML frontmatter stored in `~/.pi/agents/subagents/<name>.md` (global) or `.pi/subagents/<name>.md` (project). A project template overrides a global one with the same name.

Exposes a single `subagent` tool:
- **spawn**: call with `name`, `description`, `prompt` — blocks until the subagent finishes, returns its result
- **follow-up**: call again with the same `id` from a previous result plus a new `prompt` to continue the session

Subagents cannot spawn further subagents. Concurrency is capped at `pi-subagents-max-concurrent` (default: 4); excess agents queue and start as slots free.

Frontmatter fields: `description`, `model`, `thinking`, `max_turns`, `grace_turns`, `included_tools`, `included_skills`, `included_subagents`, `enabled`.

List fields (`included_tools`, `included_skills`, `included_subagents`) accept YAML array syntax (preferred) or CSV string (backward compat):

```yaml
# preferred — idiomatic YAML
included_tools:
  - edit
  - write
  - bash

# also accepted — flow array
included_tools: [edit, write, bash]

# also accepted — CSV string (legacy)
included_tools: edit, write, bash
```

The `subagent:templates` command opens an interactive terminal menu listing all loaded templates with their source and model.

### `pi-title` (`packages/pi-title`)
Generates short session title from user messages. Hooks `before_agent_start`, accumulates recent user prompts, calls `complete()` with active model in background (non-blocking), sets name via `pi.setSessionName()`. Title locks once total accumulated user prompt content (current + previous messages) reaches 40 chars. Max title length: 40 chars.

Lock state is derived from the session, not in-memory closure state: when the title locks, a `custom` session entry (`customType: "pi-title"`) is persisted via `pi.appendEntry()`. "Already named?" is recomputed each turn by scanning `ctx.sessionManager.getEntries()` for that entry, so `/new`, `/resume`, and `/fork` reset cleanly (a fresh session has no marker) without leaking title state across sessions. `previousTitle` (for refinement) is read from `pi.getSessionName()`. A `session_shutdown` handler aborts in-flight generation so a late title never lands in the next session.

Exposes `/title` command to manually regenerate title from recent session context.

No flags — constants are hardcoded (`MAX_TITLE_LENGTH = 40`, `MIN_PROMPT_LENGTH = 60`).

### `pi-reflag` (`packages/pi-reflag`)
Intercepts `bash` tool calls and rewrites `grep` → `rg` (ripgrep) and `find` → `fd` transparently before execution. Shows a user-visible toast notification on rewrite - agent never sees it.

- **grep → rg**: drops `-r`/`-R`/`-E`, maps long flags, converts `--include`/`--exclude` to `-g` globs, converts BRE patterns to ERE.
- **find → fd**: translates `-name`/`-iname` to `-g` globs (OR patterns become brace expansion), `-type`, `-maxdepth`/`-mindepth`, `-exec`/`-execdir`, `-mtime`/`-size`/`-user`/`-group` and more. Always adds `-H` (fd excludes hidden files by default, find doesn't). Adds `--no-ignore` based on `pi-reflag-ignore-mode`.
- **xargs**: `xargs grep`/`xargs find` rewrites are also supported.

Skips commands with subshells or variable assignments.

Flags:
- `pi-reflag-verbose` (boolean, default: false) — show a toast with original and rewritten command in the UI
- `pi-reflag-ignore-mode` (string, default: `'auto'`) — controls when `--no-ignore` is passed to `fd`: `'auto'` adds it when the search path contains a known ignored directory (node_modules, .venv, .yarn, dist, target, …); `'no-ignore'` always adds it; `'ignore'` never adds it

### `pi-pr` (`packages/pi-pr`)
Shows the current branch's GitHub PR in the footer via `ctx.ui.setStatus("pi-pr", …)`: a lifecycle letter (`D` draft, `O` open, `M` merged, `C` closed) and a clickable `#n` link (OSC 8 hyperlink to the PR URL, both colored by lifecycle — closed is red, merged uses a raw 256-color purple tuned to the terminal background via `COLORFGBG`, brighter on dark, since no theme token is purple). For active PRs (draft/open) it also shows a diff stat (`+42-10`, additions green / deletions red, hidden when the PR has no changes), a `●` CI-rollup glyph (always shown, colored by state, `none` dim so its position stays stable) and two conditional glyphs in fixed order: a red `‼` conflict glyph only when the PR has merge conflicts, and a review verdict only when decided (`✓` green approved, `✗` red changes-requested). Merged and closed PRs are terminal states: they drop the diff stat, conflict, and review glyphs and show the CI glyph only when CI failed. Polls on a timer and also fires a one-off refresh when a `tool_result` shows the agent ran `gh pr create`, so a newly opened PR shows up immediately.

Flags:
- `pi-pr-interval` (string numeric, default: `30`) — poll interval in seconds, floored at 5s (registered as a string flag because pi flags are boolean or string only; parsed as a number at use)

### `pi-bash-timeout` (`packages/pi-bash-timeout`)
Intercepts `bash` tool calls via `tool_call` and injects a default `timeout` (seconds) when the model omits it or passes `<= 0`, mutating `event.input` in place (uses the upstream `isToolCallEventType("bash", event)` guard). Appends a "Bash Tool Timeout Policy" section to the system prompt via `before_agent_start` so the model sets explicit timeouts for long-running commands.

Timeout values resolve with precedence **flag > env var > built-in**; invalid or non-positive values fall through to the next source. `maxSeconds` is advisory only (shown in prompt guidance) and is never a hard cap — explicit timeouts always pass through; it is raised to the default when lower. Flags register **without** a `default` on purpose: `getFlag` returns the registered default immediately once set, so a default would permanently shadow the env var — leaving it unset lets `getFlag` return `undefined` and the env layer take over.

Ported and adapted from [`code-yeongyu/pi-bash-timeout`](https://github.com/code-yeongyu/pi-bash-timeout).

Flags:
- `pi-bash-timeout-default` (string numeric, no default; falls back to `PI_BASH_DEFAULT_TIMEOUT_SECONDS` env, then built-in `120`)
- `pi-bash-timeout-max` (string numeric, no default; falls back to `PI_BASH_MAX_TIMEOUT_SECONDS` env, then built-in `600`)

## Tech stack

- **Runtime**: Node.js ≥ 22.19.0, ESM throughout (`"type": "module"`)
- **Language**: TypeScript 5, strict
- **Package manager**: pnpm 10 with workspaces
- **Linter/formatter**: Biome
- **Tests**: Vitest
- **Releases**: Changesets

## Development commands

```bash
pnpm install                  # install workspace deps
pnpm test                     # run all tests across packages
pnpm typecheck                # tsc --noEmit across packages
pnpm fix                      # check and auto-fix
pnpm validate:release         # dry-run semantic-release for all packages
```

## Git hooks

Pre-commit runs biome check, typecheck, and tests in parallel via Lefthook (`lefthook.yml` at root). Hook config is committed; the `.git/hooks/pre-commit` wrapper is not (lives outside version control).

After clone:

```bash
mkdir -p .git/hooks && printf '#!/usr/bin/env bash\nset -euo pipefail\npnpm lefthook run pre-commit\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

Run hooks manually:

```bash
pnpm lefthook run pre-commit
```

> A global `core.hooksPath` may intercept hooks and delegate to `.git/hooks/` via a `run-local-hooks` shim. Lefthook cannot auto-install into a custom hooks path, so the wrapper is created manually.

## Conventions

### No fence/divider comments
`pi-fence` itself is active in this repo. Do not write decorative separator comments like:

```ts
// ---- helpers ----
// ===== Section =====
// *** utilities ***
```

Use named functions, classes, or blank lines to separate logical sections instead.

### ESM imports require `.js` extensions
All local imports must use `.js` extensions (compiled output convention), even though the source files are `.ts`:

```ts
import { isFenceComment } from "./fence.js";  // correct
import { isFenceComment } from "./fence.ts";  // wrong
import { isFenceComment } from "./fence";     // wrong
```

### Biome for formatting and linting
Do not configure Prettier or ESLint. All formatting and linting goes through Biome (`biome.json` at root).

## Extension entry point contract

Each package's `src/index.ts` must `export default` a function with the signature:

```ts
export default function myExtension(pi: ExtensionAPI): void { ... }
```

This is what pi loads from the `"pi": { "extensions": [...] }` field in `package.json`.

## Testing approach

Tests live in `src/` inside each package. Vitest is the test runner.

`pi-fence` uses the [`@marcfargas/pi-test-harness`](https://www.npmjs.com/package/@marcfargas/pi-test-harness) package to simulate pi events against the extension.

## Adding a new package

1. `mkdir packages/<name>`
2. `packages/<name>/package.json` - include:
   - `"type": "module"`
   - `"pi": { "extensions": ["./src/index.ts"] }`
   - scripts: `test`, `typecheck`, `check`, `fix`
3. `packages/<name>/tsconfig.json` - extend `../../tsconfig.base.json`
4. `packages/<name>/src/index.ts` - default-export a function `(pi: ExtensionAPI) => void`
5. CI picks it up automatically via `pnpm -r`

For publishable packages, also add `"publishConfig": { "access": "public" }` and `"files"` to `package.json`. Private packages set `"private": true`.

## CI

`.github/workflows/ci.yml` - runs `test`, `typecheck`, `check`, and dry-run release on every PR.
`.github/workflows/release.yml` - semantic-release on push to `main`; each package releases independently.

## Releases

Releases are automated via semantic-release on push to `main`. Each package releases independently based on commits that touch it.

Conventional commit format is required and enforced by commitlint (commit-msg hook via lefthook):

- `fix:` → patch
- `feat:` → minor
- `feat!:` / `BREAKING CHANGE:` → major
- `chore:`, `docs:`, `refactor:`, `test:` → no release

Tag format: `@piotr-oles/<pkg>@<version>`. Each package gets its own `CHANGELOG.md`.

Dry run (no publish, no tags): `pnpm validate:release`
